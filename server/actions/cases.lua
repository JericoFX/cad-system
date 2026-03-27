local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'
local Registry = require 'modules.shared.registry'

local Cases = {}

---@class CaseRecord
---@field caseId string
---@field caseType string
---@field title string
---@field description string
---@field status string
---@field priority integer
---@field createdBy string
---@field assignedTo string|nil
---@field linkedCallId string|nil
---@field linkedUnits string[]
---@field personId string|nil
---@field personName string|nil
---@field createdAt string
---@field updatedAt string
---@field closedAt string|nil
---@field notes table[]
---@field evidence table[]
---@field tasks table[]

local cases = State.Cases
local casesPublicRev = 0
local casesPublicFingerprint = ''

local casesPublicCfg = Config.Cases and Config.Cases.PublicState or {}
local CASES_PUBLIC_CLOSED_TTL_MINUTES = math.max(1, tonumber(casesPublicCfg.ClosedRetentionMinutes) or 10)
local CASES_PUBLIC_MAX_CASES = math.max(10, tonumber(casesPublicCfg.MaxCases) or 300)

local function cloneTable(value)
    return lib.table.deepclone(value)
end


---@param caseObj CaseRecord
---@return boolean
local function shouldPublishCase(caseObj)
    if caseObj.status ~= 'CLOSED' then
        return true
    end

    local closedEpoch = Utils.IsoToEpoch(caseObj.closedAt) or Utils.IsoToEpoch(caseObj.updatedAt)
    if not closedEpoch then
        return true
    end

    local ttlSeconds = CASES_PUBLIC_CLOSED_TTL_MINUTES * 60
    return (os.time() - closedEpoch) <= ttlSeconds
end

---@param caseObj CaseRecord
---@return table
local function caseToPublic(caseObj)
    return {
        caseId = caseObj.caseId,
        caseType = caseObj.caseType,
        title = ('%s CASE'):format(tostring(caseObj.caseType or 'GENERAL'):upper()),
        description = '',
        status = caseObj.status,
        priority = caseObj.priority,
        createdBy = 'SYSTEM',
        assignedTo = nil,
        linkedCallId = caseObj.linkedCallId,
        linkedUnits = {},
        personId = nil,
        personName = nil,
        createdAt = caseObj.createdAt,
        updatedAt = caseObj.updatedAt,
        notes = {},
        evidence = {},
        tasks = {},
        notesCount = #(caseObj.notes or {}),
        evidenceCount = #(caseObj.evidence or {}),
        tasksCount = #(caseObj.tasks or {}),
    }
end

---@return table
local function buildCasesPublicCore()
    local rows = {}
    for caseId, caseObj in pairs(cases) do
        if type(caseObj) == 'table' and shouldPublishCase(caseObj) then
            rows[#rows + 1] = {
                caseId = caseId,
                updatedAt = tostring(caseObj.updatedAt or ''),
                priority = tonumber(caseObj.priority) or 99,
            }
        end
    end

    table.sort(rows, function(a, b)
        if a.priority ~= b.priority then
            return a.priority < b.priority
        end
        if a.updatedAt ~= b.updatedAt then
            return a.updatedAt > b.updatedAt
        end
        return a.caseId < b.caseId
    end)

    local out = {}
    local limit = math.min(#rows, CASES_PUBLIC_MAX_CASES)
    for i = 1, limit do
        local caseId = rows[i].caseId
        out[caseId] = caseToPublic(cases[caseId])
    end

    return out
end

---@param core table<string, table>
---@return string
local function buildCasesPublicFingerprint(core)
    local caseIds = {}
    for caseId in pairs(core) do
        caseIds[#caseIds + 1] = caseId
    end
    table.sort(caseIds)

    local lines = {}
    for i = 1, #caseIds do
        local caseId = caseIds[i]
        local caseObj = core[caseId]
        lines[#lines + 1] = table.concat({
            caseObj.caseId,
            tostring(caseObj.caseType or ''),
            tostring(caseObj.status or ''),
            tostring(caseObj.priority or ''),
            tostring(caseObj.updatedAt or ''),
            tostring(caseObj.evidenceCount or 0),
            tostring(caseObj.notesCount or 0),
            tostring(caseObj.tasksCount or 0),
        }, '|')
    end

    return table.concat(lines, '\n')
end

---@param force boolean|nil
local function publishCasesPublicState(force)
    local core = buildCasesPublicCore()
    local fingerprint = buildCasesPublicFingerprint(core)

    if not force and fingerprint == casesPublicFingerprint then
        return
    end

    casesPublicFingerprint = fingerprint
    casesPublicRev = casesPublicRev + 1

    GlobalState:set('cad_cases_public', {
        rev = casesPublicRev,
        generatedAt = Utils.ToIso(),
        cases = core,
    }, true)
end

Cases.PublishPublicState = publishCasesPublicState

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
        closedAt = caseObj.closedAt,
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
        Utils.Log('error', 'Failed saving case %s: %s', tostring(caseObj and caseObj.caseId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

lib.callback.register('cad:createCase', Auth.WithGuard('heavy', function(source, payload, officer)

    local job = tostring(officer.job or ''):lower()
    local allowedJobs = { police = true, sheriff = true, dispatch = true, ems = true, ambulance = true }
    if not allowedJobs[job] and not officer.isAdmin then
        return { ok = false, error = 'insufficient_permissions' }
    end

    local title = Fn.SanitizeString(payload.title, 255)
    if title == '' then
        return { ok = false, error = 'title_required' }
    end

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
        status = Config.Cases.DefaultStatus,
        priority = lib.math.clamp(tonumber(payload.priority) or 2, 1, 5),
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
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    cases[caseId] = caseObj

    publishCasesPublicState(false)

    return caseToClient(caseObj)
end))

lib.callback.register('cad:getCase', Auth.WithGuard('default', function(_, payload)
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

lib.callback.register('cad:searchCases', Auth.WithGuard('default', function(_, payload)
    local query = string.lower(Fn.SanitizeString(payload.query or payload.searchTerm or '', 120))
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

lib.callback.register('cad:updateCase', Auth.WithGuard('heavy', function(_, payload)
    local caseId = payload.caseId or payload.id
    if not caseId then
        return { ok = false, error = 'case_id_required' }
    end

    local caseObj = ensureCase(caseId)
    if not caseObj then
        return { ok = false, error = 'not_found' }
    end

    local previous = cloneTable(caseObj)

    if payload.title then caseObj.title = Fn.SanitizeString(payload.title, 255) end
    if payload.description then caseObj.description = Fn.SanitizeString(payload.description, 2000) end
    if payload.status then caseObj.status = string.upper(tostring(payload.status)) end
    if payload.priority then caseObj.priority = lib.math.clamp(tonumber(payload.priority) or caseObj.priority, 1, 5) end
    if payload.assignedTo ~= nil then caseObj.assignedTo = payload.assignedTo end
    if payload.linkedCallId ~= nil then caseObj.linkedCallId = payload.linkedCallId end
    if payload.linkedUnits ~= nil and type(payload.linkedUnits) == 'table' then caseObj.linkedUnits = payload.linkedUnits end

    if caseObj.status == 'CLOSED' then
        caseObj.closedAt = caseObj.closedAt or Utils.ToIso()
    else
        caseObj.closedAt = nil
    end

    caseObj.updatedAt = Utils.ToIso()
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

    publishCasesPublicState(false)

    return caseToClient(caseObj)
end))

lib.callback.register('cad:closeCase', Auth.WithGuard('heavy', function(_, payload)
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
    local previousClosedAt = caseObj.closedAt
    caseObj.status = 'CLOSED'
    caseObj.updatedAt = Utils.ToIso()
    caseObj.closedAt = caseObj.updatedAt
    local saved, saveErr = saveCaseDb(caseObj)
    if not saved then
        caseObj.status = previousStatus
        caseObj.updatedAt = previousUpdatedAt
        caseObj.closedAt = previousClosedAt
        return { ok = false, error = saveErr or 'db_write_failed' }
    end

    publishCasesPublicState(false)

    return { ok = true, success = true, caseId = caseId }
end))

lib.callback.register("cad:case:printReport", Auth.WithGuard("default", function(source, payload)
    local caseId = payload and payload.caseId
    if not caseId then
        return { ok = false, error = "case_id_required" }
    end

    local officer = Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = "officer_not_found" }
    end

    local caseObj = ensureCase(caseId)
    if not caseObj then
        return { ok = false, error = "case_not_found" }
    end

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
        caseObj.caseType or "N/A",
        tonumber(caseObj.priority) or 1,
        caseObj.status or "UNKNOWN",
        caseObj.createdAt or "N/A",
        caseObj.title or "N/A",
        caseObj.description or "No description",
        #(caseObj.notes or {}),
        #(caseObj.evidence or {}),
        officer.name or "Unknown",
        officer.badge or "N/A"
    )

    local itemId = nil
    if GetResourceState('ox_inventory') == 'started' and Config.Evidence and Config.Evidence.TicketItemName then
        local itemName = Config.Evidence.TicketItemName

        local itemExists = pcall(function()
            return exports.ox_inventory:GetItem(source, itemName, nil, false)
        end)

        if itemExists then
            local metadata = {
                caseId = caseId,
                reportType = "CASE_REPORT",
                printedBy = officer.name,
                printedAt = Utils.ToIso(),
                description = string.format("Case %s Report", caseId)
            }

            local success, result = pcall(function()
                return exports.ox_inventory:AddItem(source, itemName, 1, metadata)
            end)

            if success and result then
                itemId = result
            else
                Utils.Log('warn', 'Failed to add case report item for officer %s: %s', source, tostring(result))
            end
        else
            Utils.Log('warn', 'Case report item %s does not exist in ox_inventory', itemName)
        end
    end

    return {
        ok = true,
        itemId = itemId,
        report = reportContent
    }
end))

CreateThread(function()
    Wait(500)
    publishCasesPublicState(true)
    Wait(5000)
    publishCasesPublicState(true)

    while true do
        Wait(30000)
        publishCasesPublicState(false)
    end
end)

Registry.Register('Cases', Cases)
