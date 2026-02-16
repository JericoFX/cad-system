--[[
C.A.D. System - Exports for External Resources
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3

AVAILABLE EXPORTS:

Dispatch Functions:
- exports('cad-system'):CreateDispatchCall(data) - Create a new dispatch call
  data = { type, priority, title, description, location, coordinates }
  Returns: call object or nil

- exports('cad-system'):GetActiveCalls() - Get all active dispatch calls
  Returns: table of calls

- exports('cad-system'):AssignUnit(callId, unitId) - Assign unit to call
  Returns: boolean

- exports('cad-system'):CloseDispatchCall(callId) - Close a dispatch call
  Returns: boolean

- exports('cad-system'):GetUnitStatus(unitId) - Get unit status
  Returns: unit object or nil

- exports('cad-system'):SetUnitStatus(unitId, statusCode) - Set unit status
  Returns: boolean

Case Functions:
- exports('cad-system'):CreateCase(source, data) - Create a new case
- exports('cad-system'):GetCase(caseId) - Get case by ID
- exports('cad-system'):UpdateCase(caseId, data) - Update case
- exports('cad-system'):CloseCase(caseId) - Close a case
- exports('cad-system'):SearchCases(query) - Search cases

Evidence Functions:
- exports('cad-system'):CreateEvidenceBag(source, data) - Create evidence bag
- exports('cad-system'):GetEvidenceById(evidenceId) - Get evidence
- exports('cad-system'):AttachEvidenceToCase(source, evidenceId, caseId) - Attach evidence

Utility Functions:
- exports('cad-system'):CheckPermission(source, role) - Check if player has role
- exports('cad-system'):GetOfficerData(source) - Get officer data
]]

CAD = CAD or {}

exports('CreateCase', function(source, data)
    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then return nil end

    local payload = data or {}
    local title = CAD.Server.SanitizeString(payload.title, 255)
    if title == '' then return nil end

    local caseId = CAD.Server.GenerateId('CASE')
    local now = CAD.Server.ToIso()
    local caseObj = {
        caseId = caseId,
        caseType = tostring(payload.caseType or 'GENERAL'):upper(),
        title = title,
        description = CAD.Server.SanitizeString(payload.description, 2000),
        status = 'OPEN',
        priority = math.max(1, math.min(5, tonumber(payload.priority) or 2)),
        createdBy = officer.identifier,
        assignedTo = payload.assignedTo,
        linkedCallId = payload.linkedCallId,
        linkedUnits = type(payload.linkedUnits) == 'table' and payload.linkedUnits or {},
        personId = payload.personId,
        personName = payload.personName,
        createdAt = now,
        updatedAt = now,
        notes = {},
        evidence = {},
        tasks = {},
    }
    CAD.State.Cases[caseId] = caseObj
    return caseObj
end)

exports('GetCase', function(_, caseId)
    return CAD.State.Cases[caseId]
end)

exports('UpdateCase', function(_, caseId, data)
    local caseObj = CAD.State.Cases[caseId]
    if not caseObj then return nil end
    local patch = data or {}
    if patch.title then caseObj.title = CAD.Server.SanitizeString(patch.title, 255) end
    if patch.description then caseObj.description = CAD.Server.SanitizeString(patch.description, 2000) end
    if patch.status then caseObj.status = tostring(patch.status):upper() end
    if patch.priority then caseObj.priority = math.max(1, math.min(5, tonumber(patch.priority) or caseObj.priority)) end
    caseObj.updatedAt = CAD.Server.ToIso()
    return caseObj
end)

exports('CloseCase', function(_, caseId)
    local caseObj = CAD.State.Cases[caseId]
    if not caseObj then return false end
    caseObj.status = 'CLOSED'
    caseObj.updatedAt = CAD.Server.ToIso()
    return true
end)

exports('SearchCases', function(_, query)
    local q = string.lower(tostring(query or ''))
    local out = {}
    for _, caseObj in pairs(CAD.State.Cases) do
        local title = string.lower(caseObj.title or '')
        local desc = string.lower(caseObj.description or '')
        if q == '' or title:find(q, 1, true) or desc:find(q, 1, true) then
            out[#out + 1] = caseObj
        end
    end
    return out
end)

exports('CreateEvidenceBag', function(source, data)
    if not CAD.Auth.GetOfficerData(source) then return nil end
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

exports('GetEvidenceById', function(_, evidenceId)
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
    local officer = CAD.Auth.GetOfficerData(source)
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

exports('CreateDispatchCall', function(_, data)
    local callId = CAD.Server.GenerateId('CALL')
    local call = {
        callId = callId,
        type = tostring(data and data.type or 'GENERAL'):upper(),
        priority = math.max(1, math.min(3, tonumber(data and data.priority) or 2)),
        title = CAD.Server.SanitizeString(data and data.title, 255),
        description = CAD.Server.SanitizeString(data and data.description, 2000),
        location = CAD.Server.SanitizeString(data and data.location, 255),
        coordinates = data and data.coordinates or nil,
        status = 'PENDING',
        assignedUnits = {},
        createdAt = CAD.Server.ToIso(),
    }
    CAD.State.Dispatch.Calls[callId] = call
    return call
end)

exports('GetActiveCalls', function()
    return CAD.State.Dispatch.Calls
end)

exports('AssignUnit', function(_, callId, unitId)
    local call = CAD.State.Dispatch.Calls[callId]
    local unit = CAD.State.Dispatch.Units[unitId]
    if not call or not unit then return false end
    call.assignedUnits[unitId] = { assignedAt = CAD.Server.ToIso() }
    call.status = 'ACTIVE'
    unit.status = 'BUSY'
    unit.currentCall = callId
    return true
end)

exports('GetUnitStatus', function(_, unitId)
    return CAD.State.Dispatch.Units[unitId]
end)

exports('SetUnitStatus', function(_, unitId, statusCode)
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
