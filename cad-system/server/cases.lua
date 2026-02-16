--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

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
        CAD.Log('error', 'Failed saving case %s: %s', tostring(caseObj and caseObj.caseId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

lib.callback.register('cad:createCase', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    -- Police, sheriff, dispatch, and EMS can create cases
    local job = tostring(officer.job or ''):lower()
    local allowedJobs = { police = true, sheriff = true, dispatch = true, ems = true, ambulance = true }
    if not allowedJobs[job] and not officer.isAdmin then
        return { ok = false, error = 'insufficient_permissions' }
    end

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

    local saved, saveErr = saveCaseDb(caseObj)
    if not saved then
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    cases[caseId] = caseObj

    -- Broadcast case creation to police and dispatch
    CAD.Server.BroadcastToJobs(
        {'police', 'sheriff', 'dispatch'},
        'caseCreated',
        { case = caseToClient(caseObj) }
    )

    return caseToClient(caseObj)
end))

lib.callback.register('cad:getCase', CAD.Auth.WithGuard('default', function(_, payload)
    local caseId = type(payload) == 'string' and payload or payload.caseId or payload.id
    if not caseId then
        return { ok = false, error = 'case_id_required' }
    end
    local caseObj = ensureCase(caseId)
    if not caseObj then
        return { ok = false, error = 'not_found' }
    end
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
        return { ok = false, error = 'case_id_required' }
    end

    local caseObj = ensureCase(caseId)
    if not caseObj then
        return { ok = false, error = 'not_found' }
    end

    local previous = cloneTable(caseObj)

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
    local saved, saveErr = saveCaseDb(caseObj)
    if not saved then
        for key in pairs(caseObj) do
            caseObj[key] = nil
        end
        for key, value in pairs(previous) do
            caseObj[key] = value
        end
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    -- Broadcast case update
    CAD.Server.BroadcastToJobs(
        {'police', 'sheriff', 'dispatch'},
        'caseUpdated',
        {
            caseId = caseId,
            changes = payload,
            updatedBy = 'system',
            updatedAt = caseObj.updatedAt
        }
    )

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

    local previousStatus = caseObj.status
    local previousUpdatedAt = caseObj.updatedAt
    caseObj.status = 'CLOSED'
    caseObj.updatedAt = CAD.Server.ToIso()
    local saved, saveErr = saveCaseDb(caseObj)
    if not saved then
        caseObj.status = previousStatus
        caseObj.updatedAt = previousUpdatedAt
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    -- Broadcast case closure
    CAD.Server.BroadcastToJobs(
        {'police', 'sheriff', 'dispatch'},
        'caseClosed',
        {
            caseId = caseId,
            closedBy = 'system',
            closedAt = caseObj.updatedAt
        }
    )

    return { ok = true, success = true, caseId = caseId }
end))


-- Print case report callback
lib.callback.register("cad:case:printReport", CAD.Auth.WithGuard("default", function(source, payload)
    local caseId = payload and payload.caseId
    if not caseId then
        return { ok = false, error = "case_id_required" }
    end
    
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = "officer_not_found" }
    end
    
    -- Generate report content
    local reportContent = string.format([[
=== CASE REPORT ===
Case ID: %s
Type: %s
Priority: P%d
Status: %s
Created: %s

Title: %s

Description:
%s

Notes: %d
Evidence: %d

Printed by: %s
Badge: %s
]], 
        caseId,
        payload.caseType or "N/A",
        payload.priority or 1,
        payload.status or "UNKNOWN",
        payload.createdAt or "N/A",
        payload.title or "N/A",
        payload.description or "No description",
        payload.notesCount or 0,
        payload.evidenceCount or 0,
        officer.name or "Unknown",
        officer.badge or "N/A"
    )
    
    -- Create paper item if ox_inventory available
    local itemId = nil
    if GetResourceState('ox_inventory') == 'started' and CAD.Config.Evidence and CAD.Config.Evidence.TicketItemName then
        local itemName = CAD.Config.Evidence.TicketItemName
        
        -- Validate item exists in ox_inventory
        local itemExists = pcall(function()
            return exports.ox_inventory:GetItem(source, itemName, nil, false)
        end)
        
        if itemExists then
            local metadata = {
                caseId = caseId,
                reportType = "CASE_REPORT",
                printedBy = officer.name,
                printedAt = CAD.Server.ToIso(),
                description = string.format("Case %s Report", caseId)
            }
            
            local success, result = pcall(function()
                return exports.ox_inventory:AddItem(source, itemName, 1, metadata)
            end)
            
            if success and result then
                itemId = result
            else
                CAD.Log('warn', 'Failed to add case report item for officer %s: %s', source, tostring(result))
            end
        else
            CAD.Log('warn', 'Case report item %s does not exist in ox_inventory', itemName)
        end
    end
    
    return { 
        ok = true, 
        itemId = itemId,
        report = reportContent
    }
end))
