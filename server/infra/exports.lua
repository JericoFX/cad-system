

CAD = CAD or {}

local function dispatchEnabled()
    if CAD.IsFeatureEnabled then
        return CAD.IsFeatureEnabled('Dispatch')
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
        CAD.Log('error', 'exports: Failed saving case %s: %s', tostring(caseObj and caseObj.caseId), tostring(err))
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
        CAD.Log('error', 'exports: Failed saving dispatch call %s: %s', tostring(call and call.callId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

local function requireOfficer(source)
    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then
        CAD.Log('warn', 'exports: unauthorized access attempt from source %s', tostring(source))
        return nil
    end
    return officer
end

exports('CreateCase', function(source, data)
    local officer = requireOfficer(source)
    if not officer then return nil end

    local payload = data or {}
    local title = CAD.Server.SanitizeString(payload.title, 255)
    if title == '' then return nil end

    local caseType = tostring(payload.caseType or 'GENERAL'):upper()
    local isValidType = false
    for i = 1, #CAD.Config.Cases.Types do
        if CAD.Config.Cases.Types[i] == caseType then
            isValidType = true
            break
        end
    end
    if not isValidType then
        caseType = 'GENERAL'
    end

    local now = CAD.Server.ToIso()
    local caseId = CAD.Server.GenerateId('CASE')
    local caseObj = {
        caseId = caseId,
        caseType = caseType,
        title = title,
        description = CAD.Server.SanitizeString(payload.description, 2000),
        status = CAD.Config.Cases.DefaultStatus or 'OPEN',
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
        CAD.Log('error', 'exports: CreateCase DB failed: %s', tostring(saveErr))
        return nil
    end

    CAD.State.Cases[caseId] = caseObj

    if CAD.Cases and CAD.Cases.PublishPublicState then
        CAD.Cases.PublishPublicState(false)
    end

    return caseObj
end)

exports('GetCase', function(source, caseId)
    if not requireOfficer(source) then return nil end
    return CAD.State.Cases[caseId]
end)

exports('UpdateCase', function(source, caseId, data)
    if not requireOfficer(source) then return nil end

    local caseObj = CAD.State.Cases[caseId]
    if not caseObj then return nil end

    local patch = data or {}
    if patch.title then caseObj.title = CAD.Server.SanitizeString(patch.title, 255) end
    if patch.description then caseObj.description = CAD.Server.SanitizeString(patch.description, 2000) end
    if patch.status then caseObj.status = tostring(patch.status):upper() end
    if patch.priority then caseObj.priority = math.max(1, math.min(5, tonumber(patch.priority) or caseObj.priority)) end
    if patch.assignedTo ~= nil then caseObj.assignedTo = patch.assignedTo end

    if caseObj.status == 'CLOSED' then
        caseObj.closedAt = caseObj.closedAt or CAD.Server.ToIso()
    end

    caseObj.updatedAt = CAD.Server.ToIso()

    local saved = saveCaseDb(caseObj)
    if not saved then
        CAD.Log('error', 'exports: UpdateCase DB failed for %s', tostring(caseId))
    end

    if CAD.Cases and CAD.Cases.PublishPublicState then
        CAD.Cases.PublishPublicState(false)
    end

    return caseObj
end)

exports('CloseCase', function(source, caseId)
    if not requireOfficer(source) then return false end

    local caseObj = CAD.State.Cases[caseId]
    if not caseObj then return false end

    caseObj.status = 'CLOSED'
    caseObj.closedAt = CAD.Server.ToIso()
    caseObj.updatedAt = caseObj.closedAt

    local saved = saveCaseDb(caseObj)
    if not saved then
        CAD.Log('error', 'exports: CloseCase DB failed for %s', tostring(caseId))
    end

    if CAD.Cases and CAD.Cases.PublishPublicState then
        CAD.Cases.PublishPublicState(false)
    end

    return true
end)

exports('SearchCases', function(source, query)
    if not requireOfficer(source) then return {} end

    local q = string.lower(tostring(query or ''))
    local out = {}
    for _, caseObj in pairs(CAD.State.Cases) do
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

    local stagingId = CAD.Server.GenerateId('STAGE')
    CAD.State.Evidence.Staging[source] = CAD.State.Evidence.Staging[source] or {}
    CAD.State.Evidence.Staging[source][#CAD.State.Evidence.Staging[source] + 1] = {
        stagingId = stagingId,
        evidenceType = tostring(data and data.evidenceType or 'PHOTO'):upper(),
        data = type(data and data.data) == 'table' and data.data or {},
        createdAt = CAD.Server.ToIso(),
    }
    return stagingId
end)

exports('GetEvidenceById', function(source, evidenceId)
    if not requireOfficer(source) then return nil end

    for _, caseObj in pairs(CAD.State.Cases) do
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

    local bucket = CAD.State.Evidence.Staging[source] or {}
    local selected = nil
    local index = nil
    for i = 1, #bucket do
        if bucket[i].stagingId == evidenceId then
            selected = bucket[i]
            index = i
            break
        end
    end
    if not selected or not CAD.State.Cases[caseId] then return nil end

    local evidence = {
        evidenceId = CAD.Server.GenerateId('EVID'),
        caseId = caseId,
        evidenceType = selected.evidenceType,
        data = selected.data,
        attachedBy = officer.identifier,
        attachedAt = CAD.Server.ToIso(),
        custodyChain = {},
    }
    CAD.State.Cases[caseId].evidence[#CAD.State.Cases[caseId].evidence + 1] = evidence
    table.remove(bucket, index)
    return evidence
end)

exports('CreateDispatchCall', function(source, data)
    if not dispatchEnabled() then return nil end
    if not requireOfficer(source) then return nil end

    local payload = data or {}
    local callId = CAD.Server.GenerateId('CALL')
    local call = {
        callId = callId,
        type = tostring(payload.type or 'GENERAL'):upper(),
        priority = math.max(1, math.min(3, tonumber(payload.priority) or 2)),
        title = CAD.Server.SanitizeString(payload.title, 255),
        description = CAD.Server.SanitizeString(payload.description, 2000),
        location = CAD.Server.SanitizeString(payload.location, 255),
        coordinates = payload.coordinates or nil,
        status = 'PENDING',
        assignedUnits = {},
        createdAt = CAD.Server.ToIso(),
    }

    local saved = saveCallDb(call)
    if not saved then
        CAD.Log('error', 'exports: CreateDispatchCall DB failed')
        return nil
    end

    CAD.State.Dispatch.Calls[callId] = call
    return call
end)

exports('GetActiveCalls', function(source)
    if not dispatchEnabled() then return {} end
    if not requireOfficer(source) then return {} end

    return CAD.State.Dispatch.Calls
end)

exports('AssignUnit', function(source, callId, unitId)
    if not dispatchEnabled() then return false end
    if not requireOfficer(source) then return false end

    local call = CAD.State.Dispatch.Calls[callId]
    local unit = CAD.State.Dispatch.Units[unitId]
    if not call or not unit then return false end

    call.assignedUnits[unitId] = { assignedAt = CAD.Server.ToIso() }
    call.status = 'ACTIVE'
    unit.status = 'BUSY'
    unit.currentCall = callId

    local saved = saveCallDb(call)
    if not saved then
        CAD.Log('error', 'exports: AssignUnit DB failed for call %s', tostring(callId))
    end

    return true
end)

exports('GetUnitStatus', function(source, unitId)
    if not dispatchEnabled() then return nil end
    if not requireOfficer(source) then return nil end

    return CAD.State.Dispatch.Units[unitId]
end)

exports('SetUnitStatus', function(source, unitId, statusCode)
    if not dispatchEnabled() then return false end
    if not requireOfficer(source) then return false end

    local unit = CAD.State.Dispatch.Units[unitId]
    if not unit then return false end
    unit.status = tostring(statusCode or 'AVAILABLE'):upper()
    return true
end)

exports('CheckPermission', function(source, role)
    return CAD.Server.HasRole(source, role)
end)

exports('GetOfficerData', function(source)
    return CAD.Auth.GetOfficerData(source)
end)

exports('LogJailTransfer', function(source, data)
    local officer = requireOfficer(source)
    if not officer then return nil end

    local payload = data or {}
    local transferId = CAD.Server.GenerateId('JAIL')

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
            CAD.Server.SanitizeString(payload.inmateName, 100),
            payload.inmateId or '',
            math.max(0, tonumber(payload.jailTime) or 0),
            CAD.Server.SanitizeString(payload.reason, 500),
            CAD.Server.ToIso(),
        })
    end)

    if not ok then
        CAD.Log('error', 'exports: LogJailTransfer DB failed: %s', tostring(err))
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
