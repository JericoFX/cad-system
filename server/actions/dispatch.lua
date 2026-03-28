local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'
local Registry = require 'modules.shared.registry'

local Dispatch = {}

---@class DispatchUnitRecord
---@field unitId string
---@field badge string
---@field name string
---@field status 'AVAILABLE'|'BUSY'|'OFF_DUTY'
---@field type string
---@field location? { x: number, y: number, z: number }
---@field currentCall? string
---@field updatedAt? string
---@field updatedAtEpoch? integer

---@class DispatchCallRecord
---@field callId string
---@field type string
---@field priority integer
---@field title string
---@field description string
---@field location string
---@field coordinates? { x: number, y: number, z: number }
---@field status 'PENDING'|'ACTIVE'|'CLOSED'
---@field assignedUnits table<string, { assignedAt: string }>
---@field createdAt string
---@field closedAt? string
---@field resolution? string

local units = State.Dispatch.Units
local calls = State.Dispatch.Calls
local sourceToUnit = {}
local saveCallDb

local dispatchPublicCfg = Config.Dispatch and Config.Dispatch.PublicState or {}
local DISPATCH_PUBLIC_CLOSED_TTL_MINUTES = math.max(1, tonumber(dispatchPublicCfg.ClosedRetentionMinutes) or 10)
local DISPATCH_PUBLIC_MAX_CALLS = math.max(10, tonumber(dispatchPublicCfg.MaxCalls) or 250)

local dirty = false
local rev = 0

---@return nil
local function markDirty()
    dirty = true
end

---@return boolean
local function isDispatchEnabled()
    return Config.Dispatch.Enabled ~= false and Config.IsFeatureEnabled('Dispatch')
end

---@param unit DispatchUnitRecord
local function touchUnit(unit)
    local nowEpoch = os.time()
    unit.updatedAtEpoch = nowEpoch
    unit.updatedAt = Utils.ToIso()
end


---@param unit DispatchUnitRecord
---@return boolean
local function isUnitStale(unit)
    local staleSeconds = math.max(5, tonumber(Config.Dispatch.UnitStaleSeconds) or 300)
    local updatedEpoch = tonumber(unit.updatedAtEpoch) or Utils.IsoToEpoch(unit.updatedAt)
    if not updatedEpoch then
        return false
    end

    return (os.time() - updatedEpoch) > staleSeconds
end

---@param status any
---@return 'AVAILABLE'|'BUSY'|'OFF_DUTY'
local function normalizeUnitStatus(status)
    local val = tostring(status or 'AVAILABLE'):upper()
    if val == 'OFF_DUTY' or val == 'BUSY' or val == 'AVAILABLE' then
        return val
    end
    return 'AVAILABLE'
end

---@param unitId string
---@param unit DispatchUnitRecord|nil
local function syncEmsUnit(unitId, unit)
    local ems = State.EMS.Units[unitId]
    if not ems then return end
    if not unit then
        State.EMS.Units[unitId] = nil
        return
    end
    ems.status = unit.status
    ems.location = unit.location
    ems.currentCall = unit.currentCall
    ems.updatedAt = unit.updatedAt
end

---@param call DispatchCallRecord
---@return boolean
local function shouldPublishCall(call)
    if call.status ~= 'CLOSED' then
        return true
    end

    local closedEpoch = Utils.IsoToEpoch(call.closedAt) or Utils.IsoToEpoch(call.createdAt)
    if not closedEpoch then
        return true
    end

    local ttlSeconds = DISPATCH_PUBLIC_CLOSED_TTL_MINUTES * 60
    return (os.time() - closedEpoch) <= ttlSeconds
end

---@return nil
local function publishIfDirty()
    if not dirty then return end
    dirty = false
    rev = rev + 1

    local publicCalls = {}
    local callRows = {}
    for callId, call in pairs(calls) do
        if type(call) == 'table' and shouldPublishCall(call) then
            callRows[#callRows + 1] = {
                callId = callId,
                createdAt = tostring(call.createdAt or ''),
                priority = tonumber(call.priority) or 99,
            }
        end
    end

    if #callRows > 1 then
        table.sort(callRows, function(a, b)
            if a.priority ~= b.priority then
                return a.priority < b.priority
            end
            if a.createdAt ~= b.createdAt then
                return a.createdAt > b.createdAt
            end
            return a.callId < b.callId
        end)
    end

    local limit = math.min(#callRows, DISPATCH_PUBLIC_MAX_CALLS)
    for i = 1, limit do
        local callId = callRows[i].callId
        publicCalls[callId] = calls[callId]
    end

    local publicUnits = {}
    for unitId, unit in pairs(units) do
        if type(unit) == 'table' and not isUnitStale(unit) then
            publicUnits[unitId] = unit
        end
    end

    GlobalState:set('cad_dispatch_public', {
        rev = rev,
        generatedAt = Utils.ToIso(),
        calls = publicCalls,
        units = publicUnits,
    }, true)
end

---@param unitId string
---@param persistCalls boolean|nil
local function releaseUnitFromCalls(unitId, persistCalls)
    local changedCallIds = {}

    for callId, call in pairs(calls) do
        if type(call) == 'table' and call.assignedUnits and call.assignedUnits[unitId] then
            call.assignedUnits[unitId] = nil

            local hasAny = false
            for _ in pairs(call.assignedUnits) do
                hasAny = true
                break
            end

            if not hasAny and call.status ~= 'CLOSED' then
                call.status = 'PENDING'
            end

            changedCallIds[#changedCallIds + 1] = callId
        end
    end

    if persistCalls == true then
        for i = 1, #changedCallIds do
            local call = calls[changedCallIds[i]]
            if call then
                saveCallDb(call)
            end
        end
    end
end

---@param source number
---@param persistCalls boolean|nil
local function removeSourceUnit(source, persistCalls)
    local unitId = sourceToUnit[source]
    if not unitId then
        return
    end

    sourceToUnit[source] = nil

    local unit = units[unitId]
    if not unit then
        return
    end

    releaseUnitFromCalls(unitId, persistCalls)
    units[unitId] = nil
    syncEmsUnit(unitId, nil)
end

---@param officer table|nil
---@return boolean
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
        return Config.Dispatch.AllowEMSControl ~= false
    end

    return false
end

---@param bucket string
---@param handler function
---@return function
local function withDispatchGuard(bucket, handler)
    return Auth.WithGuard(bucket, function(source, payload, officer)
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

---@param call DispatchCallRecord
---@return boolean, string|nil
saveCallDb = function(call)
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
        Utils.Log('error', 'Failed saving dispatch call %s: %s', tostring(call and call.callId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

---@param unit DispatchUnitRecord
---@return boolean
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

    touchUnit(unit)
    units[unitId] = unit

    if officer.job == 'ambulance' or officer.job == 'ems' then
        State.EMS.Units[unitId] = {
            unitId = unitId,
            status = unit.status,
            unitType = 'AMBULANCE',
            crew = { officer.identifier },
            location = unit.location,
            currentCall = unit.currentCall,
            updatedAt = unit.updatedAt,
        }
    end

    markDirty()

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

    local officer = Auth.GetOfficerData(source)
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
    local previousStatus = unit.status

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

    touchUnit(unit)
    syncEmsUnit(unitId, unit)

    if previousStatus ~= unit.status then
        markDirty()
    end

    return unit
end))

lib.callback.register('cad:createDispatchCall', withDispatchGuard('heavy', function(_, payload)
    local title = Fn.SanitizeString(payload.title, 255)
    if title == '' then
        return { ok = false, error = 'title_required' }
    end

    local callId = Utils.GenerateId('CALL')
    local call = {
        callId = callId,
        type = tostring(payload.type or 'GENERAL'):upper(),
        priority = lib.math.clamp(tonumber(payload.priority) or 2, 1, 3),
        title = title,
        description = Fn.SanitizeString(payload.description, 2000),
        location = Fn.SanitizeString(payload.location, 255),
        coordinates = type(payload.coordinates) == 'table' and {
            x = tonumber(payload.coordinates.x) or 0.0,
            y = tonumber(payload.coordinates.y) or 0.0,
            z = tonumber(payload.coordinates.z) or 0.0,
        } or nil,
        status = 'PENDING',
        assignedUnits = {},
        createdAt = Utils.ToIso(),
    }

    local saved, saveErr = saveCallDb(call)
    if not saved then
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    calls[callId] = call
    markDirty()

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

    call.assignedUnits[payload.unitId] = {
        assignedAt = Utils.ToIso(),
    }
    call.status = 'ACTIVE'
    unit.status = 'BUSY'
    unit.currentCall = call.callId
    touchUnit(unit)

    if State.EMS.Units[payload.unitId] then
        State.EMS.Units[payload.unitId].status = 'EN_ROUTE'
        State.EMS.Units[payload.unitId].currentCall = call.callId
        State.EMS.Units[payload.unitId].updatedAt = unit.updatedAt
    end

    local saved, saveErr = saveCallDb(call)
    if not saved then
        call.assignedUnits[payload.unitId] = nil
        call.status = previousCallStatus
        unit.status = previousUnitStatus
        unit.currentCall = previousCurrentCall
        syncEmsUnit(payload.unitId, unit)
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    markDirty()

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

    call.assignedUnits[payload.unitId] = nil
    unit.currentCall = nil
    if unitIsResponding(unit) then
        unit.status = 'AVAILABLE'
    end
    touchUnit(unit)

    local hasAny = false
    for _ in pairs(call.assignedUnits) do
        hasAny = true
        break
    end
    if not hasAny then
        call.status = 'PENDING'
    end

    syncEmsUnit(payload.unitId, unit)

    local saved, saveErr = saveCallDb(call)
    if not saved then
        call.assignedUnits[payload.unitId] = previousAssigned
        call.status = previousCallStatus
        unit.status = previousUnitStatus
        unit.currentCall = previousCurrentCall
        syncEmsUnit(payload.unitId, unit)
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    markDirty()

    return call
end))

---@param call DispatchCallRecord
---@param payload table
---@return DispatchCallRecord|nil, string|nil
local function closeCallInternal(call, payload)
    local previousCallStatus = call.status
    local previousResolution = call.resolution
    local previousUnits = {}

    call.status = 'CLOSED'
    call.closedAt = Utils.ToIso()
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
            touchUnit(unit)
            syncEmsUnit(unitId, unit)
        elseif State.EMS.Units[unitId] then
            previousUnits[unitId] = {
                emsStatus = State.EMS.Units[unitId].status,
                emsCurrentCall = State.EMS.Units[unitId].currentCall,
            }
            State.EMS.Units[unitId].status = 'AVAILABLE'
            State.EMS.Units[unitId].currentCall = nil
            State.EMS.Units[unitId].updatedAt = Utils.ToIso()
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
                touchUnit(unit)
                syncEmsUnit(unitId, unit)
            end
            if State.EMS.Units[unitId] and snapshot.emsStatus then
                State.EMS.Units[unitId].status = snapshot.emsStatus
                State.EMS.Units[unitId].currentCall = snapshot.emsCurrentCall
                State.EMS.Units[unitId].updatedAt = unit and unit.updatedAt or Utils.ToIso()
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

    markDirty()

    return closed
end))

lib.callback.register('cad:closeCall', withDispatchGuard('heavy', function(_, payload)
    local call = calls[payload.callId]
    if not call then
        return { ok = false, error = 'call_not_found' }
    end

    local closed, closeErr = closeCallInternal(call, payload)
    if not closed then
        return { ok = false, error = closeErr or 'db_write_failed' }
    end

    markDirty()

    return closed
end))

lib.callback.register('cad:setOfficerStatus', withDispatchGuard('default', function(source, payload)
    local unitId = sourceToUnit[source]
    if not unitId or not units[unitId] then
        return { ok = false, error = 'unit_not_found' }
    end

    local unit = units[unitId]
    local normalized = normalizeUnitStatus(payload.statusCode or payload.status)

    if unit.status ~= normalized then
        unit.status = normalized
        touchUnit(unit)
        markDirty()
    else
        touchUnit(unit)
    end

    syncEmsUnit(unitId, unit)

    return {
        statusCode = unit.status,
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
local statusChangeLimits = {}

---@param now number
---@return nil
local function cleanupDispatchRateLimits(now)
    local timestamp = tonumber(now) or os.time()

    for source, last in pairs(positionUpdateLimits) do
        if (timestamp - (tonumber(last) or 0)) > 15 then
            positionUpdateLimits[source] = nil
        end
    end

    for source, last in pairs(statusChangeLimits) do
        if (timestamp - (tonumber(last) or 0)) > 30 then
            statusChangeLimits[source] = nil
        end
    end
end

if lib and lib.cron and type(lib.cron.new) == 'function' then
    lib.cron.new('* * * * *', function()
        cleanupDispatchRateLimits(os.time())
    end)
end

RegisterNetEvent('cad:server:updatePosition', function(coords)
    local source = source
    if not isDispatchEnabled() then
        return
    end

    if type(coords) ~= 'table' then
        return
    end

    local allowed, officerOrError = Auth.RequireOfficer(source)
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

    local unit = units[unitId]

    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    local z = tonumber(coords.z)
    if not x or not y or not z then
        return
    end

    if math.abs(x) > 100000 or math.abs(y) > 100000 then
        return
    end

    unit.location = { x = x, y = y, z = z }
    touchUnit(unit)
    syncEmsUnit(unitId, unit)
    markDirty()
end)

RegisterNetEvent('cad:server:statusChanged', function(statusCode)
    local source = source
    if not isDispatchEnabled() then
        return
    end

    local allowed, officerOrError = Auth.RequireOfficer(source)
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
    touchUnit(units[unitId])
    syncEmsUnit(unitId, units[unitId])
    markDirty()
end)

AddEventHandler('playerDropped', function()
    local source = source
    removeSourceUnit(source, true)
    markDirty()
end)

CreateThread(function()
    Wait(500)
    markDirty()
    publishIfDirty()
    Wait(5000)
    markDirty()
    publishIfDirty()

    while true do
        Wait(30000)
        cleanupDispatchRateLimits(os.time())

        local didMutate = false
        local staleSources = {}

        for source, unitId in pairs(sourceToUnit) do
            local unit = units[unitId]
            if not unit or isUnitStale(unit) then
                staleSources[#staleSources + 1] = source
            end
        end

        for i = 1, #staleSources do
            removeSourceUnit(staleSources[i], true)
            didMutate = true
        end

        if didMutate then
            markDirty()
        end

        publishIfDirty()
    end
end)

Registry.Register('Dispatch', Dispatch)
