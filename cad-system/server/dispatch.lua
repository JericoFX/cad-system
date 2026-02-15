--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Dispatch = CAD.Dispatch or {}

local units = CAD.State.Dispatch.Units
local calls = CAD.State.Dispatch.Calls
local sourceToUnit = {}

local function isDispatchEnabled()
    return CAD.Config.Dispatch.Enabled ~= false and CAD.IsFeatureEnabled('Dispatch')
end

local function canUseDispatchControl(officer)
    if not officer then
        return false
    end

    if officer.isAdmin then
        return true
    end

    local job = tostring(officer.job or ''):lower()
    if job == 'police' or job == 'sheriff' or job == 'dispatch' then
        return true
    end

    if job == 'ambulance' or job == 'ems' then
        return CAD.Config.Dispatch.AllowEMSControl ~= false
    end

    return false
end

local function withDispatchGuard(bucket, handler)
    return CAD.Auth.WithGuard(bucket, function(source, payload, officer)
        if not isDispatchEnabled() then
            return {
                ok = false,
                error = 'dispatch_disabled',
            }
        end

        if not canUseDispatchControl(officer) then
            return {
                ok = false,
                error = 'forbidden',
            }
        end

        return handler(source, payload, officer)
    end)
end

local function saveCallDb(call)
    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_dispatch_calls (
                call_id, call_type, priority, title, description,
                location, coordinates, status, assigned_units, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                call_type = VALUES(call_type),
                priority = VALUES(priority),
                title = VALUES(title),
                description = VALUES(description),
                location = VALUES(location),
                coordinates = VALUES(coordinates),
                status = VALUES(status),
                assigned_units = VALUES(assigned_units)
        ]], {
            call.callId,
            call.type,
            call.priority,
            call.title,
            call.description,
            call.location,
            call.coordinates and json.encode(call.coordinates) or nil,
            call.status,
            json.encode(call.assignedUnits or {}),
            call.createdAt,
        })
    end)

    if not ok then
        CAD.Log('error', 'Failed saving dispatch call %s: %s', tostring(call and call.callId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

local function normalizeUnitStatus(status)
    local val = tostring(status or 'AVAILABLE'):upper()
    if val == 'OFF_DUTY' or val == 'BUSY' or val == 'AVAILABLE' then
        return val
    end
    return 'AVAILABLE'
end

local function unitIsResponding(unit)
    return unit.status == 'BUSY'
end

lib.callback.register('cad:registerDispatchUnit', withDispatchGuard('default', function(source, payload, officer)
    local existingUnitId = sourceToUnit[source]
    local unitId = existingUnitId or ('UNIT_%s'):format(officer.callsign)
    sourceToUnit[source] = unitId

    local unit = units[unitId] or {
        unitId = unitId,
        badge = officer.callsign,
        name = officer.name,
        status = 'AVAILABLE',
        type = payload.type or (officer.job == 'ambulance' or officer.job == 'ems') and 'EMS' or 'PATROL',
        location = nil,
    }

    unit.status = normalizeUnitStatus(payload.status or unit.status)
    if type(payload.location) == 'table' then
        unit.location = {
            x = tonumber(payload.location.x) or 0.0,
            y = tonumber(payload.location.y) or 0.0,
            z = tonumber(payload.location.z) or 0.0,
        }
    end

    units[unitId] = unit

    if officer.job == 'ambulance' or officer.job == 'ems' then
        CAD.State.EMS.Units[unitId] = {
            unitId = unitId,
            status = unit.status,
            unitType = 'AMBULANCE',
            crew = { officer.identifier },
            location = unit.location,
            currentCall = unit.currentCall,
            updatedAt = CAD.Server.ToIso(),
        }
    end

    return unit
end))

lib.callback.register('cad:getDispatchUnits', withDispatchGuard('default', function(_, payload)
    local status = payload and payload.status and normalizeUnitStatus(payload.status) or nil
    local unitType = payload and payload.type and tostring(payload.type):upper() or nil
    local result = {}

    for _, unit in pairs(units) do
        local ok = true
        if status then ok = unit.status == status end
        if ok and unitType then ok = tostring(unit.type or ''):upper() == unitType end
        if ok then result[unit.unitId] = unit end
    end

    return result
end))

lib.callback.register('cad:updateUnitStatus', withDispatchGuard('default', function(source, payload)
    local unitId = sourceToUnit[source]
    if not unitId or not units[unitId] then
        return { ok = false, error = 'unit_not_found' }
    end

    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end

    if payload.unitId and payload.unitId ~= unitId then
        if not (officer.isAdmin or officer.job == 'dispatch') then
            return { ok = false, error = 'forbidden' }
        end
        unitId = payload.unitId
    end

    if not units[unitId] then
        return { ok = false, error = 'unit_not_found' }
    end

    local unit = units[unitId]
    if payload.status then
        unit.status = normalizeUnitStatus(payload.status)
    end
    if type(payload.location) == 'table' then
        unit.location = {
            x = tonumber(payload.location.x) or 0.0,
            y = tonumber(payload.location.y) or 0.0,
            z = tonumber(payload.location.z) or 0.0,
        }
    end

    if CAD.State.EMS.Units[unitId] then
        CAD.State.EMS.Units[unitId].status = unit.status
        CAD.State.EMS.Units[unitId].location = unit.location
        CAD.State.EMS.Units[unitId].updatedAt = CAD.Server.ToIso()
    end

    return unit
end))

lib.callback.register('cad:createDispatchCall', withDispatchGuard('heavy', function(_, payload)
    local title = CAD.Server.SanitizeString(payload.title, 255)
    if title == '' then
        return { ok = false, error = 'title_required' }
    end

    local callId = CAD.Server.GenerateId('CALL')
    local call = {
        callId = callId,
        type = tostring(payload.type or 'GENERAL'):upper(),
        priority = math.max(1, math.min(3, tonumber(payload.priority) or 2)),
        title = title,
        description = CAD.Server.SanitizeString(payload.description, 2000),
        location = CAD.Server.SanitizeString(payload.location, 255),
        coordinates = type(payload.coordinates) == 'table' and {
            x = tonumber(payload.coordinates.x) or 0.0,
            y = tonumber(payload.coordinates.y) or 0.0,
            z = tonumber(payload.coordinates.z) or 0.0,
        } or nil,
        status = 'PENDING',
        assignedUnits = {},
        createdAt = CAD.Server.ToIso(),
    }

    local saved, saveErr = saveCallDb(call)
    if not saved then
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    calls[callId] = call
    
    -- Broadcast to all dispatch and police units
    CAD.Server.BroadcastToJobs(
        {'police', 'sheriff', 'dispatch'},
        'dispatchCreated',
        { call = call }
    )
    
    return call
end))

lib.callback.register('cad:getDispatchCalls', withDispatchGuard('default', function(_, payload)
    local status = payload and payload.status and tostring(payload.status):upper() or nil
    local priority = payload and payload.priority and tonumber(payload.priority) or nil
    local out = {}

    for _, call in pairs(calls) do
        local ok = true
        if status then ok = call.status == status end
        if ok and priority then ok = tonumber(call.priority) == priority end
        if ok then out[call.callId] = call end
    end

    return out
end))

lib.callback.register('cad:assignUnitToCall', withDispatchGuard('heavy', function(_, payload)
    local call = calls[payload.callId]
    local unit = units[payload.unitId]
    if not call or not unit then
        return { ok = false, error = 'call_or_unit_not_found' }
    end

    local previousCallStatus = call.status
    local previousUnitStatus = unit.status
    local previousCurrentCall = unit.currentCall
    local previousEmsStatus = nil
    local previousEmsCurrentCall = nil
    if CAD.State.EMS.Units[payload.unitId] then
        previousEmsStatus = CAD.State.EMS.Units[payload.unitId].status
        previousEmsCurrentCall = CAD.State.EMS.Units[payload.unitId].currentCall
    end

    call.assignedUnits[payload.unitId] = {
        assignedAt = CAD.Server.ToIso(),
    }
    call.status = 'ACTIVE'
    unit.status = 'BUSY'
    unit.currentCall = call.callId

    if CAD.State.EMS.Units[payload.unitId] then
        CAD.State.EMS.Units[payload.unitId].status = 'EN_ROUTE'
        CAD.State.EMS.Units[payload.unitId].currentCall = call.callId
        CAD.State.EMS.Units[payload.unitId].updatedAt = CAD.Server.ToIso()
    end

    local saved, saveErr = saveCallDb(call)
    if not saved then
        call.assignedUnits[payload.unitId] = nil
        call.status = previousCallStatus
        unit.status = previousUnitStatus
        unit.currentCall = previousCurrentCall
        if CAD.State.EMS.Units[payload.unitId] then
            CAD.State.EMS.Units[payload.unitId].status = previousEmsStatus or previousUnitStatus
            CAD.State.EMS.Units[payload.unitId].currentCall = previousEmsCurrentCall or previousCurrentCall
            CAD.State.EMS.Units[payload.unitId].updatedAt = CAD.Server.ToIso()
        end
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    return call
end))

lib.callback.register('cad:unassignUnitFromCall', withDispatchGuard('heavy', function(_, payload)
    local call = calls[payload.callId]
    local unit = units[payload.unitId]
    if not call or not unit then
        return { ok = false, error = 'call_or_unit_not_found' }
    end

    local previousAssigned = call.assignedUnits[payload.unitId]
    local previousCallStatus = call.status
    local previousUnitStatus = unit.status
    local previousCurrentCall = unit.currentCall
    local previousEmsStatus = nil
    local previousEmsCurrentCall = nil
    if CAD.State.EMS.Units[payload.unitId] then
        previousEmsStatus = CAD.State.EMS.Units[payload.unitId].status
        previousEmsCurrentCall = CAD.State.EMS.Units[payload.unitId].currentCall
    end

    call.assignedUnits[payload.unitId] = nil
    unit.currentCall = nil
    if unitIsResponding(unit) then
        unit.status = 'AVAILABLE'
    end

    local hasAny = false
    for _ in pairs(call.assignedUnits) do
        hasAny = true
        break
    end
    if not hasAny then
        call.status = 'PENDING'
    end

    if CAD.State.EMS.Units[payload.unitId] then
        CAD.State.EMS.Units[payload.unitId].status = 'AVAILABLE'
        CAD.State.EMS.Units[payload.unitId].currentCall = nil
        CAD.State.EMS.Units[payload.unitId].updatedAt = CAD.Server.ToIso()
    end

    local saved, saveErr = saveCallDb(call)
    if not saved then
        call.assignedUnits[payload.unitId] = previousAssigned
        call.status = previousCallStatus
        unit.status = previousUnitStatus
        unit.currentCall = previousCurrentCall
        if CAD.State.EMS.Units[payload.unitId] then
            CAD.State.EMS.Units[payload.unitId].status = previousEmsStatus or previousUnitStatus
            CAD.State.EMS.Units[payload.unitId].currentCall = previousEmsCurrentCall or previousCurrentCall
            CAD.State.EMS.Units[payload.unitId].updatedAt = CAD.Server.ToIso()
        end
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    return call
end))

local function closeCallInternal(call, payload)
    local previousCallStatus = call.status
    local previousResolution = call.resolution
    local previousUnits = {}

    call.status = 'CLOSED'
    call.resolution = payload.resolution or nil

    for unitId in pairs(call.assignedUnits) do
        local unit = units[unitId]
        if unit then
            previousUnits[unitId] = {
                status = unit.status,
                currentCall = unit.currentCall,
            }
            unit.currentCall = nil
            unit.status = 'AVAILABLE'
        end
        if CAD.State.EMS.Units[unitId] then
            local existing = previousUnits[unitId] or {}
            existing.emsStatus = CAD.State.EMS.Units[unitId].status
            existing.emsCurrentCall = CAD.State.EMS.Units[unitId].currentCall
            previousUnits[unitId] = existing
            CAD.State.EMS.Units[unitId].status = 'AVAILABLE'
            CAD.State.EMS.Units[unitId].currentCall = nil
            CAD.State.EMS.Units[unitId].updatedAt = CAD.Server.ToIso()
        end
    end

    local saved, saveErr = saveCallDb(call)
    if not saved then
        call.status = previousCallStatus
        call.resolution = previousResolution
        for unitId, snapshot in pairs(previousUnits) do
            local unit = units[unitId]
            if unit then
                unit.status = snapshot.status
                unit.currentCall = snapshot.currentCall
            end
            if CAD.State.EMS.Units[unitId] then
                CAD.State.EMS.Units[unitId].status = snapshot.emsStatus or snapshot.status
                CAD.State.EMS.Units[unitId].currentCall = snapshot.emsCurrentCall or snapshot.currentCall
                CAD.State.EMS.Units[unitId].updatedAt = CAD.Server.ToIso()
            end
        end
        return nil, saveErr or 'db_write_failed'
    end

    return call
end

lib.callback.register('cad:closeDispatchCall', withDispatchGuard('heavy', function(_, payload)
    local call = calls[payload.callId]
    if not call then
        return { ok = false, error = 'call_not_found' }
    end

    local closed, closeErr = closeCallInternal(call, payload)
    if not closed then
        return { ok = false, error = closeErr or 'db_write_failed' }
    end

    return closed
end))

lib.callback.register('cad:closeCall', withDispatchGuard('heavy', function(source, payload)
    local call = calls[payload.callId]
    if not call then
        return { ok = false, error = 'call_not_found' }
    end

    local closed, closeErr = closeCallInternal(call, payload)
    if not closed then
        return { ok = false, error = closeErr or 'db_write_failed' }
    end

    return closed
end))

lib.callback.register('cad:setOfficerStatus', withDispatchGuard('default', function(source, payload)
    local unitId = sourceToUnit[source]
    if not unitId or not units[unitId] then
        return { ok = false, error = 'unit_not_found' }
    end

    units[unitId].status = normalizeUnitStatus(payload.statusCode or payload.status)
    return {
        statusCode = units[unitId].status,
    }
end))

lib.callback.register('cad:getOfficerStatus', withDispatchGuard('default', function(source)
    local unitId = sourceToUnit[source]
    if not unitId or not units[unitId] then
        return { ok = false, error = 'unit_not_found' }
    end

    local unit = units[unitId]
    return {
        callsign = unit.badge,
        status = unit.status,
        currentCall = unit.currentCall,
    }
end))

lib.callback.register('cad:getNearestUnit', withDispatchGuard('default', function(_, payload)
    local coords = payload
    if type(coords) ~= 'table' then
        return { ok = false, error = 'invalid_coords' }
    end

    local tx = tonumber(coords.x)
    local ty = tonumber(coords.y)
    local tz = tonumber(coords.z)
    if not tx or not ty or not tz then
        return { ok = false, error = 'invalid_coords' }
    end

    local nearest = nil
    local nearestDistance = nil
    for _, unit in pairs(units) do
        if unit.location then
            local dx = unit.location.x - tx
            local dy = unit.location.y - ty
            local dz = unit.location.z - tz
            local distance = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
            if not nearestDistance or distance < nearestDistance then
                nearestDistance = distance
                nearest = unit
            end
        end
    end

    if not nearest then
        return { ok = false, error = 'no_unit_available' }
    end

    return nearest
end))

local positionUpdateLimits = {}

RegisterNetEvent('cad:server:updatePosition', function(coords)
    local source = source
    if not isDispatchEnabled() then
        return
    end

    if type(coords) ~= 'table' then
        return
    end

    local allowed, officerOrError = CAD.Auth.RequireOfficer(source)
    if not allowed then
        return
    end

    if not canUseDispatchControl(officerOrError) then
        return
    end

    local now = os.time()
    if positionUpdateLimits[source] and (now - positionUpdateLimits[source]) < 1 then
        return
    end
    positionUpdateLimits[source] = now

    local unitId = sourceToUnit[source]
    if not unitId or not units[unitId] then
        return
    end

    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    local z = tonumber(coords.z)
    if not x or not y or not z then
        return
    end

    if math.abs(x) > 100000 or math.abs(y) > 100000 then
        return
    end

    units[unitId].location = { x = x, y = y, z = z }

    if CAD.State.EMS.Units[unitId] then
        CAD.State.EMS.Units[unitId].location = units[unitId].location
        CAD.State.EMS.Units[unitId].updatedAt = CAD.Server.ToIso()
    end
end)

local statusChangeLimits = {}

RegisterNetEvent('cad:server:statusChanged', function(statusCode)
    local source = source
    if not isDispatchEnabled() then
        return
    end

    local allowed, officerOrError = CAD.Auth.RequireOfficer(source)
    if not allowed then
        return
    end

    if not canUseDispatchControl(officerOrError) then
        return
    end

    local now = os.time()
    if statusChangeLimits[source] and (now - statusChangeLimits[source]) < 2 then
        return
    end
    statusChangeLimits[source] = now

    local unitId = sourceToUnit[source]
    if not unitId or not units[unitId] then
        return
    end

    local normalized = normalizeUnitStatus(statusCode)
    local current = units[unitId].status
    if current == normalized then
        return
    end

    units[unitId].status = normalized
end)
