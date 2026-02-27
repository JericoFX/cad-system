

CAD = CAD or {}
CAD.Dispatch = CAD.Dispatch or {}

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

local units = CAD.State.Dispatch.Units
local calls = CAD.State.Dispatch.Calls
local sourceToUnit = {}
local saveCallDb
local dispatchPublicRev = 0
local dispatchPublicFingerprint = ''
local dispatchGridEnabled = lib and lib.grid and type(lib.grid.addEntry) == 'function' and type(lib.grid.removeEntry) == 'function' and type(lib.grid.getNearbyEntries) == 'function'
local dispatchGridEntries = {}

local dispatchPublicCfg = CAD.Config.Dispatch and CAD.Config.Dispatch.PublicState or {}
local DISPATCH_PUBLIC_CELL_SIZE = math.max(50, tonumber(dispatchPublicCfg.CellSizeMeters) or 200)
local DISPATCH_PUBLIC_CLOSED_TTL_MINUTES = math.max(1, tonumber(dispatchPublicCfg.ClosedRetentionMinutes) or 10)
local DISPATCH_PUBLIC_MAX_CALLS = math.max(10, tonumber(dispatchPublicCfg.MaxCalls) or 250)

local function isDispatchEnabled()
    return CAD.Config.Dispatch.Enabled ~= false and CAD.IsFeatureEnabled('Dispatch')
end

---@param unit DispatchUnitRecord
local function touchUnit(unit)
    local nowEpoch = os.time()
    unit.updatedAtEpoch = nowEpoch
    unit.updatedAt = CAD.Server.ToIso()
end

---@param value string|nil
---@return integer|nil
local function isoToEpoch(value)
    if type(value) ~= 'string' then
        return nil
    end

    local year, month, day, hour, minute, second = string.match(value, '^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)Z$')
    if not year then
        return nil
    end

    local localEpoch = os.time({
        year = tonumber(year),
        month = tonumber(month),
        day = tonumber(day),
        hour = tonumber(hour),
        min = tonumber(minute),
        sec = tonumber(second),
    })

    if not localEpoch then
        return nil
    end

    local utcOffset = os.difftime(os.time(), os.time(os.date('!*t')))
    return localEpoch + utcOffset
end

---@param coords { x: number, y: number, z: number }|nil
---@return table|nil
local function quantizeCoords(coords)
    if type(coords) ~= 'table' then
        return nil
    end

    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    local z = tonumber(coords.z)
    if not x or not y or not z then
        return nil
    end

    local cellX = math.floor(x / DISPATCH_PUBLIC_CELL_SIZE)
    local cellY = math.floor(y / DISPATCH_PUBLIC_CELL_SIZE)
    local centerX = (cellX + 0.5) * DISPATCH_PUBLIC_CELL_SIZE
    local centerY = (cellY + 0.5) * DISPATCH_PUBLIC_CELL_SIZE
    local cellHash = ('%s:%s'):format(cellX, cellY)

    return {
        cellX = cellX,
        cellY = cellY,
        cellHash = cellHash,
        center = {
            x = centerX,
            y = centerY,
            z = z,
        },
    }
end

---@param unit DispatchUnitRecord
---@return boolean
local function isUnitStale(unit)
    local staleSeconds = math.max(5, tonumber(CAD.Config.Dispatch.UnitStaleSeconds) or 300)
    local updatedEpoch = tonumber(unit.updatedAtEpoch) or isoToEpoch(unit.updatedAt)
    if not updatedEpoch then
        return false
    end

    return (os.time() - updatedEpoch) > staleSeconds
end

---@param coords { x: number, y: number, z: number }|nil
---@return string|nil
local function getCoordCellHash(coords)
    if type(coords) ~= 'table' then
        return nil
    end

    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    local z = tonumber(coords.z)
    if not x or not y or not z then
        return nil
    end

    if dispatchGridEnabled and type(lib.grid.getCellPosition) == 'function' then
        -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.getCellPosition(point)
        local cellX, cellY = lib.grid.getCellPosition(vector3(x, y, z))
        if type(cellX) == 'number' and type(cellY) == 'number' then
            return ('%s:%s'):format(cellX, cellY)
        end
    end

    local cellX = math.floor(x / DISPATCH_PUBLIC_CELL_SIZE)
    local cellY = math.floor(y / DISPATCH_PUBLIC_CELL_SIZE)
    return ('%s:%s'):format(cellX, cellY)
end

---@param unitId string
local function removeDispatchGridEntry(unitId)
    if not dispatchGridEnabled then
        return
    end

    local entry = dispatchGridEntries[unitId]
    if not entry then
        return
    end

    -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.removeEntry(entry)
    lib.grid.removeEntry(entry)
    dispatchGridEntries[unitId] = nil
end

---@param unitId string
---@param unit DispatchUnitRecord|nil
local function upsertDispatchGridEntry(unitId, unit)
    if not dispatchGridEnabled or type(unit) ~= 'table' then
        return
    end

    local location = unit.location
    if type(location) ~= 'table' then
        removeDispatchGridEntry(unitId)
        return
    end

    local x = tonumber(location.x)
    local y = tonumber(location.y)
    local z = tonumber(location.z)
    if not x or not y or not z then
        removeDispatchGridEntry(unitId)
        return
    end

    local oldEntry = dispatchGridEntries[unitId]
    if oldEntry then
        -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.removeEntry(entry)
        lib.grid.removeEntry(oldEntry)
    end

    local entry = {
        coords = vector3(x, y, z),
        radius = DISPATCH_PUBLIC_CELL_SIZE,
        unitId = unitId,
    }

    -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.addEntry(entry)
    lib.grid.addEntry(entry)
    dispatchGridEntries[unitId] = entry
end

local function rebuildDispatchGridEntries()
    if not dispatchGridEnabled then
        return
    end

    for unitId, entry in pairs(dispatchGridEntries) do
        lib.grid.removeEntry(entry)
        dispatchGridEntries[unitId] = nil
    end

    for unitId, unit in pairs(units) do
        upsertDispatchGridEntry(unitId, unit)
    end
end

---@param unit DispatchUnitRecord
---@return table
local function buildPublicUnit(unit)
    local quantized = quantizeCoords(unit.location)
    local zoneName = quantized and ('GRID %s'):format(quantized.cellHash) or 'UNKNOWN'

    return {
        unitId = unit.unitId,
        badge = unit.badge,
        name = unit.name,
        status = unit.status,
        type = unit.type,
        currentCall = unit.currentCall,
        location = quantized and quantized.center or nil,
        zoneName = zoneName,
        cellHash = quantized and quantized.cellHash or nil,
        updatedAt = unit.updatedAt,
    }
end

---@param call DispatchCallRecord
---@return boolean
local function shouldPublishCall(call)
    if call.status ~= 'CLOSED' then
        return true
    end

    local closedEpoch = isoToEpoch(call.closedAt) or isoToEpoch(call.createdAt)
    if not closedEpoch then
        return true
    end

    local ttlSeconds = DISPATCH_PUBLIC_CLOSED_TTL_MINUTES * 60
    return (os.time() - closedEpoch) <= ttlSeconds
end

---@param call DispatchCallRecord
---@return table
local function buildPublicCall(call)
    local quantized = quantizeCoords(call.coordinates)
    local zoneName = CAD.Server.SanitizeString(call.location, 96)
    if zoneName == '' then
        zoneName = quantized and ('GRID %s'):format(quantized.cellHash) or 'UNKNOWN'
    end

    local publicTitle = ('%s INCIDENT'):format(tostring(call.type or 'GENERAL'):upper())
    local locationLabel = zoneName
    if quantized and quantized.cellHash then
        locationLabel = ('%s [%s]'):format(zoneName, quantized.cellHash)
    end

    return {
        callId = call.callId,
        type = call.type,
        priority = call.priority,
        title = publicTitle,
        description = '',
        location = locationLabel,
        coordinates = quantized and quantized.center or nil,
        status = call.status,
        assignedUnits = call.assignedUnits or {},
        createdAt = call.createdAt,
        closedAt = call.closedAt,
        zoneName = zoneName,
        cellHash = quantized and quantized.cellHash or nil,
    }
end

---@return table
local function buildDispatchPublicStateCore()
    local publicUnits = {}
    for unitId, unit in pairs(units) do
        if type(unit) == 'table' and not isUnitStale(unit) then
            publicUnits[unitId] = buildPublicUnit(unit)
        end
    end

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

    local publicCalls = {}
    local limit = math.min(#callRows, DISPATCH_PUBLIC_MAX_CALLS)
    for i = 1, limit do
        local callId = callRows[i].callId
        publicCalls[callId] = buildPublicCall(calls[callId])
    end

    return {
        calls = publicCalls,
        units = publicUnits,
    }
end

---@param core table
---@return string
local function buildDispatchPublicFingerprint(core)
    local lines = {}
    lines[#lines + 1] = 'calls'

    local callIds = {}
    for callId in pairs(core.calls) do
        callIds[#callIds + 1] = callId
    end
    table.sort(callIds)

    for i = 1, #callIds do
        local callId = callIds[i]
        local call = core.calls[callId]
        local unitIds = {}
        for unitId in pairs(call.assignedUnits or {}) do
            unitIds[#unitIds + 1] = unitId
        end
        table.sort(unitIds)

        lines[#lines + 1] = table.concat({
            call.callId,
            tostring(call.status),
            tostring(call.priority),
            tostring(call.cellHash or ''),
            tostring(call.closedAt or ''),
            table.concat(unitIds, ','),
        }, '|')
    end

    lines[#lines + 1] = 'units'
    local unitIds = {}
    for unitId in pairs(core.units) do
        unitIds[#unitIds + 1] = unitId
    end
    table.sort(unitIds)

    for i = 1, #unitIds do
        local unitId = unitIds[i]
        local unit = core.units[unitId]
        lines[#lines + 1] = table.concat({
            unit.unitId,
            tostring(unit.status),
            tostring(unit.currentCall or ''),
            tostring(unit.cellHash or ''),
        }, '|')
    end

    return table.concat(lines, '\n')
end

---@param force boolean|nil
local function publishDispatchPublicState(force)
    local core = buildDispatchPublicStateCore()
    local fingerprint = buildDispatchPublicFingerprint(core)

    if not force and fingerprint == dispatchPublicFingerprint then
        return
    end

    dispatchPublicFingerprint = fingerprint
    dispatchPublicRev = dispatchPublicRev + 1

    GlobalState:set('cad_dispatch_public', {
        rev = dispatchPublicRev,
        generatedAt = CAD.Server.ToIso(),
        calls = core.calls,
        units = core.units,
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
        removeDispatchGridEntry(unitId)
        return
    end

    releaseUnitFromCalls(unitId, persistCalls)
    removeDispatchGridEntry(unitId)

    units[unitId] = nil
    CAD.State.EMS.Units[unitId] = nil
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
-- Yes i love pcalls
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

    touchUnit(unit)

    units[unitId] = unit
    upsertDispatchGridEntry(unitId, unit)

    if officer.job == 'ambulance' or officer.job == 'ems' then
        CAD.State.EMS.Units[unitId] = {
            unitId = unitId,
            status = unit.status,
            unitType = 'AMBULANCE',
            crew = { officer.identifier },
            location = unit.location,
            currentCall = unit.currentCall,
            updatedAt = unit.updatedAt,
        }
    end

    publishDispatchPublicState(false)

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
    local previousStatus = unit.status
    local previousCellHash = getCoordCellHash(unit.location)

    if payload.status then
        unit.status = normalizeUnitStatus(payload.status)
    end

    if type(payload.location) == 'table' then
        unit.location = {
            x = tonumber(payload.location.x) or 0.0,
            y = tonumber(payload.location.y) or 0.0,
            z = tonumber(payload.location.z) or 0.0,
        }
        upsertDispatchGridEntry(unitId, unit)
    end

    touchUnit(unit)

    if CAD.State.EMS.Units[unitId] then
        CAD.State.EMS.Units[unitId].status = unit.status
        CAD.State.EMS.Units[unitId].location = unit.location
        CAD.State.EMS.Units[unitId].updatedAt = unit.updatedAt
    end

    local statusChanged = previousStatus ~= unit.status
    local cellChanged = previousCellHash ~= getCoordCellHash(unit.location)
    if statusChanged or cellChanged then
        publishDispatchPublicState(false)
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

    publishDispatchPublicState(false)

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
    touchUnit(unit)

    if CAD.State.EMS.Units[payload.unitId] then
        CAD.State.EMS.Units[payload.unitId].status = 'EN_ROUTE'
        CAD.State.EMS.Units[payload.unitId].currentCall = call.callId
        CAD.State.EMS.Units[payload.unitId].updatedAt = unit.updatedAt
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
            CAD.State.EMS.Units[payload.unitId].updatedAt = unit.updatedAt
        end
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    publishDispatchPublicState(false)

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
    touchUnit(unit)

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
        CAD.State.EMS.Units[payload.unitId].updatedAt = unit.updatedAt
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
            CAD.State.EMS.Units[payload.unitId].updatedAt = unit.updatedAt
        end
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    publishDispatchPublicState(false)

    return call
end))

local function closeCallInternal(call, payload)
    local previousCallStatus = call.status
    local previousResolution = call.resolution
    local previousUnits = {}

    call.status = 'CLOSED'
    call.closedAt = CAD.Server.ToIso()
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
        end
        if CAD.State.EMS.Units[unitId] then
            local existing = previousUnits[unitId] or {}
            existing.emsStatus = CAD.State.EMS.Units[unitId].status
            existing.emsCurrentCall = CAD.State.EMS.Units[unitId].currentCall
            previousUnits[unitId] = existing
            CAD.State.EMS.Units[unitId].status = 'AVAILABLE'
            CAD.State.EMS.Units[unitId].currentCall = nil
            CAD.State.EMS.Units[unitId].updatedAt = unit and unit.updatedAt or CAD.Server.ToIso()
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
            end
            if CAD.State.EMS.Units[unitId] then
                CAD.State.EMS.Units[unitId].status = snapshot.emsStatus or snapshot.status
                CAD.State.EMS.Units[unitId].currentCall = snapshot.emsCurrentCall or snapshot.currentCall
                CAD.State.EMS.Units[unitId].updatedAt = unit and unit.updatedAt or CAD.Server.ToIso()
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

    publishDispatchPublicState(false)

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

    publishDispatchPublicState(false)

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
        publishDispatchPublicState(false)
    else
        touchUnit(unit)
    end

    if CAD.State.EMS.Units[unitId] then
        CAD.State.EMS.Units[unitId].status = unit.status
        CAD.State.EMS.Units[unitId].updatedAt = unit.updatedAt
    end

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
    local targetCoords = vector3(tx, ty, tz)

    if dispatchGridEnabled then
        -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.getNearbyEntries(point, filter)
        local nearbyEntries = lib.grid.getNearbyEntries(targetCoords, function(entry)
            return type(entry) == 'table' and type(entry.unitId) == 'string' and units[entry.unitId] ~= nil
        end)

        for i = 1, #nearbyEntries do
            local entry = nearbyEntries[i]
            local unit = units[entry.unitId]
            if unit and unit.location then
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
    end

    if not nearest then
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
    end

    if not nearest then
        return { ok = false, error = 'no_unit_available' }
    end

    return nearest
end))

local positionUpdateLimits = {}
local statusChangeLimits = {}

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
    -- Verified: Context7 /websites/coxdocs_dev ox_lib Cron Server lib.cron.new(expression, job, options)
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

    local unit = units[unitId]
    local previousCellHash = getCoordCellHash(unit.location)

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

    if CAD.State.EMS.Units[unitId] then
        CAD.State.EMS.Units[unitId].location = unit.location
        CAD.State.EMS.Units[unitId].updatedAt = unit.updatedAt
    end

    local currentCellHash = getCoordCellHash(unit.location)
    if previousCellHash ~= currentCellHash then
        upsertDispatchGridEntry(unitId, unit)
        publishDispatchPublicState(false)
    end
end)

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
    touchUnit(units[unitId])

    if CAD.State.EMS.Units[unitId] then
        CAD.State.EMS.Units[unitId].status = normalized
        CAD.State.EMS.Units[unitId].updatedAt = units[unitId].updatedAt
    end

    publishDispatchPublicState(false)
end)

AddEventHandler('playerDropped', function()
    local source = source
    removeSourceUnit(source, true)
    publishDispatchPublicState(false)
end)

CreateThread(function()
    Wait(500)
    rebuildDispatchGridEntries()
    publishDispatchPublicState(true)
    Wait(5000)
    publishDispatchPublicState(true)

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
            publishDispatchPublicState(true)
        else
            publishDispatchPublicState(false)
        end
    end
end)
