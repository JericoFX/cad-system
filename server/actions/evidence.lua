local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'
local Registry = require 'modules.shared.registry'

local Evidence = {}

local staging = State.Evidence.Staging

---@return boolean
local function evidenceVirtualEnabled()
    local cfg = Config.Evidence or {}
    return cfg.UseVirtualContainer ~= false and Registry.Get('VirtualContainer') ~= nil
end

---@param terminalId string
---@return table|nil
local function getTerminalById(terminalId)
    local points = Config.UI.AccessPoints or {}
    for i = 1, #points do
        local point = points[i]
        if point.id == terminalId then
            return point
        end
    end

    return nil
end

---@param officer table
---@param terminal table
---@return boolean
local function hasTerminalAccess(officer, terminal)
    if not terminal.jobs or #terminal.jobs == 0 then
        return true
    end

    if officer.isAdmin then
        return true
    end

    for i = 1, #terminal.jobs do
        if terminal.jobs[i] == officer.job then
            return true
        end
    end

    return false
end

---@param terminal table
---@return table|nil
local function normalizeContainerConfig(terminal)
    local container = terminal.evidenceContainer
    if type(container) ~= 'table' or container.enabled ~= true then
        return nil
    end

    local global = Config.Evidence or {}
    local slots = tonumber(container.slots) or tonumber(global.VirtualContainerSlotCount) or 200

    return {
        slots = math.max(1, math.floor(slots)),
        label = tostring(container.label or ('Evidence Locker - %s'):format(terminal.label or terminal.id or 'Terminal')),
    }
end

local TERMINAL_MAX_DISTANCE = 10.0

---@param source number
---@param terminal table
---@return boolean
local function isPlayerNearTerminal(source, terminal)
    if not terminal.coords then
        return false
    end

    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then
        return false
    end

    local playerCoords = GetEntityCoords(ped)
    local terminalCoords = terminal.coords
    local dx = playerCoords.x - terminalCoords.x
    local dy = playerCoords.y - terminalCoords.y
    local dz = playerCoords.z - terminalCoords.z
    local dist = math.sqrt(dx * dx + dy * dy + dz * dz)

    local maxDist = tonumber(terminal.radius) or TERMINAL_MAX_DISTANCE
    return dist <= maxDist
end

---@param payload table|nil
---@param officer table
---@return string|nil, table|nil, table|nil, table|nil
local function resolveContainerContext(payload, officer)
    local terminalId = Fn.SanitizeString(payload and payload.terminalId, 64)
    if terminalId == '' then
        return nil, nil, nil, {
            ok = false,
            error = 'terminal_id_required',
        }
    end

    local terminal = getTerminalById(terminalId)
    if not terminal then
        return nil, nil, nil, {
            ok = false,
            error = 'terminal_not_found',
        }
    end

    local containerConfig = normalizeContainerConfig(terminal)
    if not containerConfig then
        return nil, nil, nil, {
            ok = false,
            error = 'container_not_enabled',
        }
    end

    if not hasTerminalAccess(officer, terminal) then
        return nil, nil, nil, {
            ok = false,
            error = 'forbidden',
        }
    end

    if not isPlayerNearTerminal(officer.source, terminal) then
        return nil, nil, nil, {
            ok = false,
            error = 'too_far_from_terminal',
        }
    end

    return terminalId, terminal, containerConfig, nil
end

---@param terminalId string
---@return string
local function getContainerKey(terminalId)
    return ('terminal:%s:evidence'):format(terminalId)
end

---@param terminalId string
---@param containerConfig table
---@return table|nil, string|nil
local function ensureVirtualEvidenceContainer(terminalId, containerConfig)
    local containerKey = getContainerKey(terminalId)
    local VCAction = Registry.Get('VirtualContainer')
    local container, ensureErr = VCAction and VCAction.Ensure(containerKey, {
        containerType = 'evidence',
        endpointId = terminalId,
        slotCount = containerConfig.slots,
        readSlot = 1,
        strictAllowedItems = false,
    })

    if not container then
        return nil, ensureErr or 'container_not_ready'
    end

    return container
end

---@param container table
---@return integer|nil
local function findFreeContainerSlot(container)
    for i = 1, container.slotCount do
        if not container.slots[i] then
            return i
        end
    end

    return nil
end

---@param container table
---@param requestedSlot any
---@return integer|nil, table|nil
local function getContainerSlot(container, requestedSlot)
    local target = math.floor(tonumber(requestedSlot) or 0)
    if target > 0 then
        local entry = container.slots[target]
        if entry and entry.itemName then
            return target, entry
        end
    end

    local VCAction = Registry.Get('VirtualContainer')
    local slotIndex, entry = VCAction and VCAction.GetFirstOccupied(container.containerKey)
    if slotIndex and entry then
        return slotIndex, entry
    end

    return nil, nil
end

---@param source number
---@return table
local function getOfficerStaging(source)
    staging[source] = staging[source] or {}
    return staging[source]
end

---@param caseId string
---@param evidence table
---@return boolean, string|nil
local function appendCaseEvidence(caseId, evidence)
    local caseObj = State.Cases[caseId]
    if not caseObj then
        return false, 'case_not_found'
    end

    caseObj.evidence = caseObj.evidence or {}
    local previousUpdatedAt = caseObj.updatedAt
    local newUpdatedAt = Utils.ToIso()

    local ok, err = pcall(function()
        MySQL.transaction.await({
            {
                query = [[
                    INSERT INTO cad_evidence (evidence_id, case_id, evidence_type, payload, attached_by, attached_at, custody_chain)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        payload = VALUES(payload),
                        custody_chain = VALUES(custody_chain)
                ]],
                values = {
                    evidence.evidenceId,
                    evidence.caseId,
                    evidence.evidenceType,
                    json.encode(evidence.data or {}),
                    evidence.attachedBy,
                    evidence.attachedAt,
                    json.encode(evidence.custodyChain or {}),
                },
            },
            {
                query = [[UPDATE cad_cases SET updated_at = ? WHERE case_id = ?]],
                values = { newUpdatedAt, caseId },
            },
        })
    end)

    if not ok then
        Utils.Log('error', 'Failed saving evidence %s to case %s: %s', tostring(evidence.evidenceId), tostring(caseId), tostring(err))
        return false, 'db_write_failed'
    end

    caseObj.evidence[#caseObj.evidence + 1] = evidence
    caseObj.updatedAt = newUpdatedAt

    local CasesAction = Registry.Get("Cases"); if CasesAction and type(CasesAction.PublishPublicState) == 'function' then
        CasesAction.PublishPublicState(false)
    end

    return true
end

Evidence.AppendCaseEvidence = appendCaseEvidence

lib.callback.register('cad:addEvidenceToStaging', Auth.WithGuard('default', function(source, payload)
    local bucket = getOfficerStaging(source)
    if #bucket >= Config.Evidence.MaxStagingPerOfficer then
        return { ok = false, error = 'staging_limit_reached' }
    end

    local stagingId = Utils.GenerateId('STAGE')
    local record = {
        stagingId = stagingId,
        evidenceType = tostring(payload.evidenceType or 'PHOTO'):upper(),
        data = type(payload.data) == 'table' and payload.data or {},
        createdAt = Utils.ToIso(),
    }

    bucket[#bucket + 1] = record

    Fn.BroadcastToPlayer(source, 'evidenceStaged', {
        stagingId = stagingId,
        evidenceType = record.evidenceType,
        data = record.data,
        createdAt = record.createdAt
    })

    return record
end))

lib.callback.register('cad:getStagingEvidence', Auth.WithGuard('default', function(source)
    local bucket = getOfficerStaging(source)
    return bucket
end))

lib.callback.register('cad:removeFromStaging', Auth.WithGuard('default', function(source, payload)
    local stagingId = type(payload) == 'string' and payload or payload.stagingId
    if not stagingId then
        return false
    end

    local bucket = getOfficerStaging(source)
    for i = #bucket, 1, -1 do
        if bucket[i].stagingId == stagingId then
            table.remove(bucket, i)
            return true
        end
    end

    return false
end))

lib.callback.register('cad:evidence:container:list', Auth.WithGuard('default', function(_, payload, officer)
    if not evidenceVirtualEnabled() then
        return {
            ok = false,
            error = 'virtual_container_disabled',
        }
    end

    local terminalId, _, containerConfig, errorResponse = resolveContainerContext(payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualEvidenceContainer(terminalId, containerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    return {
        ok = true,
        terminalId = terminalId,
        containerKey = container.containerKey,
        slotCount = container.slotCount,
        slots = Registry.Get('VirtualContainer') and Registry.Get('VirtualContainer').List(container.containerKey),
    }
end))

lib.callback.register('cad:evidence:container:store', Auth.WithGuard('heavy', function(source, payload, officer)
    if not evidenceVirtualEnabled() then
        return {
            ok = false,
            error = 'virtual_container_disabled',
        }
    end

    payload = type(payload) == 'table' and payload or {}
    local stagingId = Fn.SanitizeString(payload.stagingId, 64)
    if stagingId == '' then
        return {
            ok = false,
            error = 'staging_id_required',
        }
    end

    local terminalId, _, containerConfig, errorResponse = resolveContainerContext(payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualEvidenceContainer(terminalId, containerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    local bucket = getOfficerStaging(source)
    local selected = nil
    local selectedIndex = nil
    for i = 1, #bucket do
        if tostring(bucket[i].stagingId) == stagingId then
            selected = bucket[i]
            selectedIndex = i
            break
        end
    end

    if not selected then
        return {
            ok = false,
            error = 'staging_not_found',
        }
    end

    local targetSlot = math.floor(tonumber(payload.slot) or 0)
    if targetSlot > 0 then
        if targetSlot > container.slotCount then
            return {
                ok = false,
                error = 'slot_out_of_bounds',
            }
        end
        if container.slots[targetSlot] then
            return {
                ok = false,
                error = 'slot_occupied',
                slot = targetSlot,
            }
        end
    else
        targetSlot = findFreeContainerSlot(container)
        if not targetSlot then
            return {
                ok = false,
                error = 'container_full',
            }
        end
    end

    local metadata = {
        stagingId = selected.stagingId,
        evidenceType = selected.evidenceType,
        data = selected.data,
        createdAt = selected.createdAt,
        storedAt = Utils.ToIso(),
        storedBy = officer.identifier,
    }

    local setOk, setErr = Registry.Get('VirtualContainer') and Registry.Get('VirtualContainer').SetSlot(container.containerKey, targetSlot, {
        itemName = 'cad_evidence_record',
        label = ('%s Evidence'):format(tostring(selected.evidenceType or 'UNKNOWN')),
        count = 1,
        metadata = metadata,
        insertedBy = officer.identifier,
        insertedAt = Utils.ToIso(),
    })

    if not setOk then
        return {
            ok = false,
            error = setErr or 'container_write_failed',
        }
    end

    table.remove(bucket, selectedIndex)

    return {
        ok = true,
        terminalId = terminalId,
        containerKey = container.containerKey,
        slot = targetSlot,
        stagingId = stagingId,
    }
end))

lib.callback.register('cad:evidence:container:pull', Auth.WithGuard('heavy', function(source, payload, officer)
    if not evidenceVirtualEnabled() then
        return {
            ok = false,
            error = 'virtual_container_disabled',
        }
    end

    payload = type(payload) == 'table' and payload or {}

    local terminalId, _, containerConfig, errorResponse = resolveContainerContext(payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualEvidenceContainer(terminalId, containerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    local bucket = getOfficerStaging(source)
    if #bucket >= Config.Evidence.MaxStagingPerOfficer then
        return {
            ok = false,
            error = 'staging_limit_reached',
        }
    end

    local targetSlot, slotData = getContainerSlot(container, payload.slot)
    if not slotData then
        return {
            ok = false,
            error = 'container_empty',
        }
    end

    local metadata = type(slotData.metadata) == 'table' and slotData.metadata or {}
    local staged = {
        stagingId = Utils.GenerateId('STAGE'),
        evidenceType = tostring(metadata.evidenceType or 'PHYSICAL'):upper(),
        data = type(metadata.data) == 'table' and metadata.data or {},
        createdAt = tostring(metadata.createdAt or Utils.ToIso()),
    }

    bucket[#bucket + 1] = staged

    local clearOk, clearErr = Registry.Get('VirtualContainer') and Registry.Get('VirtualContainer').ClearSlot(container.containerKey, targetSlot)
    if not clearOk then
        table.remove(bucket, #bucket)
        return {
            ok = false,
            error = clearErr or 'container_clear_failed',
        }
    end

    return {
        ok = true,
        terminalId = terminalId,
        containerKey = container.containerKey,
        slot = targetSlot,
        staging = staged,
    }
end))

lib.callback.register('cad:attachEvidence', Auth.WithGuard('heavy', function(source, payload, officer)
    local stagingId = payload.stagingId
    local caseId = payload.caseId
    if not stagingId or not caseId then
        return { ok = false, error = 'invalid_payload' }
    end

    local caseObj = State.Cases[caseId]
    if not caseObj then
        return { ok = false, error = 'case_not_found' }
    end

    local bucket = getOfficerStaging(source)
    local selected, selectedIndex = nil, nil
    for i = 1, #bucket do
        if bucket[i].stagingId == stagingId then
            selected = bucket[i]
            selectedIndex = i
            break
        end
    end

    if not selected then
        return { ok = false, error = 'staging_not_found' }
    end

    local evidence = {
        evidenceId = Utils.GenerateId('EVID'),
        caseId = caseId,
        evidenceType = selected.evidenceType,
        data = selected.data,
        attachedBy = officer.identifier,
        attachedAt = Utils.ToIso(),
        custodyChain = {
            {
                eventId = Utils.GenerateId('CUSTODY'),
                evidenceId = '',
                eventType = 'COLLECTED',
                location = selected.data.location or 'Unknown',
                notes = 'Collected and attached to case',
                timestamp = Utils.ToIso(),
                recordedBy = officer.identifier,
            }
        },
    }
    evidence.custodyChain[1].evidenceId = evidence.evidenceId

    local ok, appendErr = appendCaseEvidence(caseId, evidence)
    if not ok then
        return { ok = false, error = appendErr or 'cannot_attach_evidence' }
    end

    table.remove(bucket, selectedIndex)

    return evidence
end))

lib.callback.register('cad:getCaseEvidence', Auth.WithGuard('default', function(_, payload)
    local caseId = type(payload) == 'string' and payload or payload.caseId
    local caseObj = caseId and State.Cases[caseId] or nil
    if not caseObj then
        return {}
    end
    return caseObj.evidence or {}
end))

lib.callback.register('cad:debug:createEvidenceItem', Auth.WithGuard('default', function(source, data)
    if not Config.Debug then
        return { ok = false, error = 'debug_disabled' }
    end

    if GetResourceState('ox_inventory') ~= 'started' then
        return { ok = false, error = 'ox_inventory_not_available' }
    end

    local itemName = Config.Evidence and Config.Evidence.TicketItemName or 'cad_ticket'
    local metadata = {
        type = 'EVIDENCE',
        evidenceType = data.evidenceType or 'PHOTO',
        imageUrl = data.imageUrl,
        description = data.description or 'Debug evidence',
        createdAt = Utils.ToIso(),
        createdBy = Auth.GetOfficerData(source).name,
        isCADEvidence = true,
    }

    local success, result = pcall(function()
        return exports.ox_inventory:AddItem(source, itemName, 1, metadata)
    end)

    if success and result then
        return { ok = true, itemId = result }
    else
        return { ok = false, error = 'inventory_error' }
    end
end))

Registry.Register('Evidence', Evidence)
