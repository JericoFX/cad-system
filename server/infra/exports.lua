local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'
local DB = require 'modules.server.database'
local Registry = require 'modules.shared.registry'


local function dispatchEnabled()
    if Config.IsFeatureEnabled then
        return Config.IsFeatureEnabled('Dispatch')
    end

    return true
end

local function saveCaseDb(caseObj)
    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_cases (
                case_id, case_type, title, description, status, priority,
                created_by, assigned_to, linked_call_id, person_id, person_name,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                case_type = VALUES(case_type),
                title = VALUES(title),
                description = VALUES(description),
                status = VALUES(status),
                priority = VALUES(priority),
                assigned_to = VALUES(assigned_to),
                linked_call_id = VALUES(linked_call_id),
                person_id = VALUES(person_id),
                person_name = VALUES(person_name),
                updated_at = VALUES(updated_at)
        ]], {
            caseObj.caseId,
            caseObj.caseType,
            caseObj.title,
            caseObj.description,
            caseObj.status,
            caseObj.priority,
            caseObj.createdBy,
            caseObj.assignedTo,
            caseObj.linkedCallId,
            caseObj.personId,
            caseObj.personName,
            caseObj.createdAt,
            caseObj.updatedAt,
        })
    end)

    if not ok then
        Utils.Log('error', 'exports: Failed saving case %s: %s', tostring(caseObj and caseObj.caseId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
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
        Utils.Log('error', 'exports: Failed saving dispatch call %s: %s', tostring(call and call.callId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

local function requireOfficer(source)
    local officer = Auth.GetOfficerData(source)
    if not officer then
        Utils.Log('warn', 'exports: unauthorized access attempt from source %s', tostring(source))
        return nil
    end
    return officer
end

exports('CreateCase', function(source, data)
    local officer = requireOfficer(source)
    if not officer then return nil end

    local payload = data or {}
    local title = Fn.SanitizeString(payload.title, 255)
    if title == '' then return nil end

    local caseType = tostring(payload.caseType or 'GENERAL'):upper()
    local isValidType = false
    for i = 1, #Config.Cases.Types do
        if Config.Cases.Types[i] == caseType then
            isValidType = true
            break
        end
    end
    if not isValidType then
        caseType = 'GENERAL'
    end

    local now = Utils.ToIso()
    local caseId = Utils.GenerateId('CASE')
    local caseObj = {
        caseId = caseId,
        caseType = caseType,
        title = title,
        description = Fn.SanitizeString(payload.description, 2000),
        status = Config.Cases.DefaultStatus or 'OPEN',
        priority = math.max(1, math.min(5, tonumber(payload.priority) or 2)),
        createdBy = officer.identifier,
        assignedTo = payload.assignedTo or nil,
        linkedCallId = payload.linkedCallId or nil,
        linkedUnits = type(payload.linkedUnits) == 'table' and payload.linkedUnits or {},
        personId = payload.personId or nil,
        personName = payload.personName or nil,
        createdAt = now,
        updatedAt = now,
        closedAt = nil,
        notes = {},
        evidence = {},
        tasks = {},
    }

    local saved, saveErr = saveCaseDb(caseObj)
    if not saved then
        Utils.Log('error', 'exports: CreateCase DB failed: %s', tostring(saveErr))
        return nil
    end

    State.Cases[caseId] = caseObj

    local CasesAct = Registry.Get("Cases"); if CasesAct and CasesAct.PublishPublicState then
        CasesAct.PublishPublicState(false)
    end

    return caseObj
end)

exports('GetCase', function(source, caseId)
    if not requireOfficer(source) then return nil end
    return State.Cases[caseId]
end)

exports('UpdateCase', function(source, caseId, data)
    if not requireOfficer(source) then return nil end

    local caseObj = State.Cases[caseId]
    if not caseObj then return nil end

    local patch = data or {}
    if patch.title then caseObj.title = Fn.SanitizeString(patch.title, 255) end
    if patch.description then caseObj.description = Fn.SanitizeString(patch.description, 2000) end
    if patch.status then caseObj.status = tostring(patch.status):upper() end
    if patch.priority then caseObj.priority = math.max(1, math.min(5, tonumber(patch.priority) or caseObj.priority)) end
    if patch.assignedTo ~= nil then caseObj.assignedTo = patch.assignedTo end

    if caseObj.status == 'CLOSED' then
        caseObj.closedAt = caseObj.closedAt or Utils.ToIso()
    end

    caseObj.updatedAt = Utils.ToIso()

    local saved = saveCaseDb(caseObj)
    if not saved then
        Utils.Log('error', 'exports: UpdateCase DB failed for %s', tostring(caseId))
    end

    local CasesAct = Registry.Get("Cases"); if CasesAct and CasesAct.PublishPublicState then
        CasesAct.PublishPublicState(false)
    end

    return caseObj
end)

exports('CloseCase', function(source, caseId)
    if not requireOfficer(source) then return false end

    local caseObj = State.Cases[caseId]
    if not caseObj then return false end

    caseObj.status = 'CLOSED'
    caseObj.closedAt = Utils.ToIso()
    caseObj.updatedAt = caseObj.closedAt

    local saved = saveCaseDb(caseObj)
    if not saved then
        Utils.Log('error', 'exports: CloseCase DB failed for %s', tostring(caseId))
    end

    local CasesAct = Registry.Get("Cases"); if CasesAct and CasesAct.PublishPublicState then
        CasesAct.PublishPublicState(false)
    end

    return true
end)

exports('SearchCases', function(source, query)
    if not requireOfficer(source) then return {} end

    local q = string.lower(tostring(query or ''))
    local out = {}
    for _, caseObj in pairs(State.Cases) do
        local title = string.lower(caseObj.title or '')
        local desc = string.lower(caseObj.description or '')
        local cid = string.lower(caseObj.caseId or '')
        if q == '' or title:find(q, 1, true) or desc:find(q, 1, true) or cid:find(q, 1, true) then
            out[#out + 1] = caseObj
        end
    end
    return out
end)

exports('CreateEvidenceBag', function(source, data)
    local officer = requireOfficer(source)
    if not officer then return nil end

    local stagingId = Utils.GenerateId('STAGE')
    State.Evidence.Staging[source] = State.Evidence.Staging[source] or {}
    State.Evidence.Staging[source][#State.Evidence.Staging[source] + 1] = {
        stagingId = stagingId,
        evidenceType = tostring(data and data.evidenceType or 'PHOTO'):upper(),
        data = type(data and data.data) == 'table' and data.data or {},
        createdAt = Utils.ToIso(),
    }
    return stagingId
end)

exports('GetEvidenceById', function(source, evidenceId)
    if not requireOfficer(source) then return nil end

    for _, caseObj in pairs(State.Cases) do
        for i = 1, #(caseObj.evidence or {}) do
            local evidence = caseObj.evidence[i]
            if evidence.evidenceId == evidenceId then
                return evidence
            end
        end
    end
    return nil
end)

exports('AttachEvidenceToCase', function(source, evidenceId, caseId)
    local officer = requireOfficer(source)
    if not officer then return nil end

    local bucket = State.Evidence.Staging[source] or {}
    local selected = nil
    local index = nil
    for i = 1, #bucket do
        if bucket[i].stagingId == evidenceId then
            selected = bucket[i]
            index = i
            break
        end
    end
    if not selected or not State.Cases[caseId] then return nil end

    local evidence = {
        evidenceId = Utils.GenerateId('EVID'),
        caseId = caseId,
        evidenceType = selected.evidenceType,
        data = selected.data,
        attachedBy = officer.identifier,
        attachedAt = Utils.ToIso(),
        custodyChain = {},
    }
    State.Cases[caseId].evidence[#State.Cases[caseId].evidence + 1] = evidence
    table.remove(bucket, index)
    return evidence
end)

exports('CreateDispatchCall', function(source, data)
    if not dispatchEnabled() then return nil end
    if not requireOfficer(source) then return nil end

    local payload = data or {}
    local callId = Utils.GenerateId('CALL')
    local call = {
        callId = callId,
        type = tostring(payload.type or 'GENERAL'):upper(),
        priority = math.max(1, math.min(3, tonumber(payload.priority) or 2)),
        title = Fn.SanitizeString(payload.title, 255),
        description = Fn.SanitizeString(payload.description, 2000),
        location = Fn.SanitizeString(payload.location, 255),
        coordinates = payload.coordinates or nil,
        status = 'PENDING',
        assignedUnits = {},
        createdAt = Utils.ToIso(),
    }

    local saved = saveCallDb(call)
    if not saved then
        Utils.Log('error', 'exports: CreateDispatchCall DB failed')
        return nil
    end

    State.Dispatch.Calls[callId] = call
    return call
end)

exports('GetActiveCalls', function(source)
    if not dispatchEnabled() then return {} end
    if not requireOfficer(source) then return {} end

    return State.Dispatch.Calls
end)

exports('AssignUnit', function(source, callId, unitId)
    if not dispatchEnabled() then return false end
    if not requireOfficer(source) then return false end

    local call = State.Dispatch.Calls[callId]
    local unit = State.Dispatch.Units[unitId]
    if not call or not unit then return false end

    call.assignedUnits[unitId] = { assignedAt = Utils.ToIso() }
    call.status = 'ACTIVE'
    unit.status = 'BUSY'
    unit.currentCall = callId

    local saved = saveCallDb(call)
    if not saved then
        Utils.Log('error', 'exports: AssignUnit DB failed for call %s', tostring(callId))
    end

    return true
end)

exports('GetUnitStatus', function(source, unitId)
    if not dispatchEnabled() then return nil end
    if not requireOfficer(source) then return nil end

    return State.Dispatch.Units[unitId]
end)

exports('SetUnitStatus', function(source, unitId, statusCode)
    if not dispatchEnabled() then return false end
    if not requireOfficer(source) then return false end

    local unit = State.Dispatch.Units[unitId]
    if not unit then return false end
    unit.status = tostring(statusCode or 'AVAILABLE'):upper()
    return true
end)

exports('CheckPermission', function(source, role)
    return Fn.HasRole(source, role)
end)

exports('GetOfficerData', function(source)
    return Auth.GetOfficerData(source)
end)

exports('LogJailTransfer', function(source, data)
    local officer = requireOfficer(source)
    if not officer then return nil end

    local payload = data or {}
    local transferId = Utils.GenerateId('JAIL')

    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_jail_transfers (
                transfer_id, case_id, officer_id, officer_name,
                inmate_name, inmate_id, jail_time, reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ]], {
            transferId,
            payload.caseId or '',
            officer.identifier,
            officer.name or '',
            Fn.SanitizeString(payload.inmateName, 100),
            payload.inmateId or '',
            math.max(0, tonumber(payload.jailTime) or 0),
            Fn.SanitizeString(payload.reason, 500),
            Utils.ToIso(),
        })
    end)

    if not ok then
        Utils.Log('error', 'exports: LogJailTransfer DB failed: %s', tostring(err))
        return nil
    end

    return transferId
end)

exports('GetJailTransfers', function(source, caseId)
    if not requireOfficer(source) then return {} end

    local ok, rows = pcall(function()
        return MySQL.query.await([[
            SELECT * FROM cad_jail_transfers WHERE case_id = ? ORDER BY created_at DESC
        ]], { caseId or '' })
    end)

    if not ok or not rows then return {} end
    return rows
end)
