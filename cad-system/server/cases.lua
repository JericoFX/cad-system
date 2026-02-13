CAD = CAD or {}
CAD.Cases = CAD.Cases or {}

local cases = CAD.State.Cases

local function cloneTable(value)
    if type(value) ~= 'table' then return value end
    local out = {}
    for k, v in pairs(value) do
        out[k] = cloneTable(v)
    end
    return out
end

local function caseToClient(caseObj)
    return {
        caseId = caseObj.caseId,
        caseType = caseObj.caseType,
        title = caseObj.title,
        description = caseObj.description,
        status = caseObj.status,
        priority = caseObj.priority,
        createdBy = caseObj.createdBy,
        assignedTo = caseObj.assignedTo,
        linkedCallId = caseObj.linkedCallId,
        linkedUnits = cloneTable(caseObj.linkedUnits or {}),
        personId = caseObj.personId,
        personName = caseObj.personName,
        createdAt = caseObj.createdAt,
        updatedAt = caseObj.updatedAt,
        notes = cloneTable(caseObj.notes or {}),
        evidence = cloneTable(caseObj.evidence or {}),
        tasks = cloneTable(caseObj.tasks or {}),
    }
end

local function ensureCase(caseId)
    local caseObj = cases[caseId]
    if not caseObj then
        return nil
    end
    caseObj.notes = caseObj.notes or {}
    caseObj.evidence = caseObj.evidence or {}
    caseObj.tasks = caseObj.tasks or {}
    return caseObj
end

local function saveCaseDb(caseObj)
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
end

lib.callback.register('cad:createCase', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    local title = CAD.Server.SanitizeString(payload.title, 255)
    if title == '' then
        return { ok = false, error = 'title_required' }
    end

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
        status = CAD.Config.Cases.DefaultStatus,
        priority = math.max(1, math.min(5, tonumber(payload.priority) or 2)),
        createdBy = officer.identifier,
        assignedTo = payload.assignedTo or nil,
        linkedCallId = payload.linkedCallId or nil,
        linkedUnits = type(payload.linkedUnits) == 'table' and payload.linkedUnits or {},
        personId = payload.personId or nil,
        personName = payload.personName or nil,
        createdAt = now,
        updatedAt = now,
        notes = {},
        evidence = {},
        tasks = {},
    }

    cases[caseId] = caseObj
    saveCaseDb(caseObj)

    return caseToClient(caseObj)
end))

lib.callback.register('cad:getCase', CAD.Auth.WithGuard('default', function(_, payload)
    local caseId = type(payload) == 'string' and payload or payload.caseId or payload.id
    if not caseId then return nil end
    local caseObj = ensureCase(caseId)
    if not caseObj then return nil end
    return caseToClient(caseObj)
end))

lib.callback.register('cad:searchCases', CAD.Auth.WithGuard('default', function(_, payload)
    local query = string.lower(CAD.Server.SanitizeString(payload.query or payload.searchTerm or '', 120))
    local status = payload.status and string.upper(tostring(payload.status)) or nil
    local priority = payload.priority and tonumber(payload.priority) or nil

    local out = {}
    for _, caseObj in pairs(cases) do
        local matches = true
        if query ~= '' then
            local title = string.lower(caseObj.title or '')
            local cid = string.lower(caseObj.caseId or '')
            local desc = string.lower(caseObj.description or '')
            matches = title:find(query, 1, true) or cid:find(query, 1, true) or desc:find(query, 1, true)
        end
        if matches and status then
            matches = caseObj.status == status
        end
        if matches and priority then
            matches = tonumber(caseObj.priority) == priority
        end
        if matches then
            out[#out + 1] = caseToClient(caseObj)
        end
    end

    table.sort(out, function(a, b)
        return (a.updatedAt or '') > (b.updatedAt or '')
    end)

    return out
end))

lib.callback.register('cad:updateCase', CAD.Auth.WithGuard('heavy', function(_, payload)
    local caseId = payload.caseId or payload.id
    if not caseId then
        return nil
    end

    local caseObj = ensureCase(caseId)
    if not caseObj then
        return nil
    end

    if payload.title then caseObj.title = CAD.Server.SanitizeString(payload.title, 255) end
    if payload.description then caseObj.description = CAD.Server.SanitizeString(payload.description, 2000) end
    if payload.status then caseObj.status = string.upper(tostring(payload.status)) end
    if payload.priority then caseObj.priority = math.max(1, math.min(5, tonumber(payload.priority) or caseObj.priority)) end
    if payload.assignedTo ~= nil then caseObj.assignedTo = payload.assignedTo end
    if payload.linkedCallId ~= nil then caseObj.linkedCallId = payload.linkedCallId end
    if payload.linkedUnits ~= nil and type(payload.linkedUnits) == 'table' then caseObj.linkedUnits = payload.linkedUnits end
    if payload.tasks ~= nil and type(payload.tasks) == 'table' then caseObj.tasks = payload.tasks end
    if payload.notes ~= nil and type(payload.notes) == 'table' then caseObj.notes = payload.notes end

    caseObj.updatedAt = CAD.Server.ToIso()
    saveCaseDb(caseObj)

    return caseToClient(caseObj)
end))

lib.callback.register('cad:closeCase', CAD.Auth.WithGuard('heavy', function(_, payload)
    local caseId = type(payload) == 'string' and payload or payload.caseId or payload.id
    if not caseId then
        return { ok = false, error = 'case_id_required' }
    end

    local caseObj = ensureCase(caseId)
    if not caseObj then
        return { ok = false, error = 'not_found' }
    end

    caseObj.status = 'CLOSED'
    caseObj.updatedAt = CAD.Server.ToIso()
    saveCaseDb(caseObj)

    return { success = true, caseId = caseId }
end))
