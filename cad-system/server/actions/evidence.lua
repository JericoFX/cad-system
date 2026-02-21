

CAD = CAD or {}
CAD.Evidence = CAD.Evidence or {}

local staging = CAD.State.Evidence.Staging

local function evidenceVirtualEnabled()
    local cfg = CAD.Config.Evidence or {}
    return cfg.UseVirtualContainer ~= false and CAD.VirtualContainer ~= nil
end

local function normalizeContainerConfig(terminal, locker)
    if type(locker) ~= 'table' or locker.enabled ~= true then
        return nil
    end

    local global = CAD.Config.Evidence or {}
    local slots = tonumber(locker.slots) or tonumber(global.VirtualContainerSlotCount) or 200

    return {
        slots = math.max(1, math.floor(slots)),
        label = tostring(locker.label or ('Evidence Locker - %s'):format(terminal.label or terminal.terminalId or 'Terminal')),
        lockerId = locker.lockerId,
        terminalId = terminal.terminalId,
    }
end

local function resolveContainerContext(payload, officer)
    if not CAD.Topology or not CAD.Topology.ResolveLockerContext then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'topology_unavailable',
        }
    end

    local terminal, locker, topologyErr = CAD.Topology.ResolveLockerContext(officer, payload)
    if topologyErr == 'terminal_id_required' then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'terminal_id_required',
        }
    end

    if topologyErr == 'terminal_not_found' then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'terminal_not_found',
        }
    end

    if topologyErr == 'locker_not_found' then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'locker_not_found',
        }
    end

    if topologyErr == 'forbidden' then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'forbidden',
        }
    end

    if topologyErr == 'container_not_enabled' or not locker then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'container_not_enabled',
        }
    end

    local terminalId = tostring(terminal and terminal.terminalId or '')
    if terminalId == '' then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'terminal_not_found',
        }
    end

    local lockerId = tostring(locker and locker.lockerId or '')
    if lockerId == '' then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'locker_not_found',
        }
    end

    local containerConfig = normalizeContainerConfig(terminal, locker)
    if not containerConfig then
        return nil, nil, nil, nil, {
            ok = false,
            error = 'container_not_enabled',
        }
    end

    return terminalId, lockerId, terminal, containerConfig, nil
end

local function getContainerKey(lockerId)
    return ('locker:%s:evidence'):format(lockerId)
end

local function ensureVirtualEvidenceContainer(lockerId, terminalId, containerConfig)
    local containerKey = getContainerKey(lockerId)
    local endpointId = lockerId ~= '' and lockerId or terminalId
    local endpointRef = terminalId ~= '' and ('%s:%s'):format(terminalId, lockerId) or lockerId
    local labelRef = containerConfig.label or lockerId

    if endpointId == '' then
        return nil, 'locker_not_found'
    end

    local container, ensureErr = CAD.VirtualContainer.Ensure(containerKey, {
        containerType = 'evidence',
        endpointId = endpointRef ~= '' and endpointRef or endpointId,
        slotCount = containerConfig.slots,
        readSlot = 1,
        strictAllowedItems = false,
    })

    if not container then
        return nil, ensureErr or 'container_not_ready'
    end

    if container.label == nil or container.label == '' then
        container.label = labelRef
    end

    return container
end

local function findFreeContainerSlot(container)
    for i = 1, container.slotCount do
        if not container.slots[i] then
            return i
        end
    end

    return nil
end

local function getContainerSlot(container, requestedSlot)
    local target = math.floor(tonumber(requestedSlot) or 0)
    if target > 0 then
        local entry = container.slots[target]
        if entry and entry.itemName then
            return target, entry
        end
    end

    local slotIndex, entry = CAD.VirtualContainer.GetFirstOccupied(container.containerKey)
    if slotIndex and entry then
        return slotIndex, entry
    end

    return nil, nil
end

local function getOfficerStaging(source)
    staging[source] = staging[source] or {}
    return staging[source]
end

local function appendCaseEvidence(caseId, evidence)
    local caseObj = CAD.State.Cases[caseId]
    if not caseObj then
        return false, 'case_not_found'
    end

    caseObj.evidence = caseObj.evidence or {}
    caseObj.evidence[#caseObj.evidence + 1] = evidence
    local insertedIndex = #caseObj.evidence
    local previousUpdatedAt = caseObj.updatedAt
    caseObj.updatedAt = CAD.Server.ToIso()

    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_evidence (evidence_id, case_id, evidence_type, payload, attached_by, attached_at, custody_chain)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                payload = VALUES(payload),
                custody_chain = VALUES(custody_chain)
        ]], {
            evidence.evidenceId,
            evidence.caseId,
            evidence.evidenceType,
            json.encode(evidence.data or {}),
            evidence.attachedBy,
            evidence.attachedAt,
            json.encode(evidence.custodyChain or {}),
        })
    end)

    if not ok then
        table.remove(caseObj.evidence, insertedIndex)
        caseObj.updatedAt = previousUpdatedAt
        CAD.Log('error', 'Failed saving evidence %s: %s', tostring(evidence and evidence.evidenceId), tostring(err))
        return false, 'db_write_failed'
    end

    if CAD.Cases and type(CAD.Cases.PublishPublicState) == 'function' then
        CAD.Cases.PublishPublicState(false)
    end

    return true
end

CAD.Evidence.AppendCaseEvidence = appendCaseEvidence

lib.callback.register('cad:addEvidenceToStaging', CAD.Auth.WithGuard('default', function(source, payload)
    local bucket = getOfficerStaging(source)
    if #bucket >= CAD.Config.Evidence.MaxStagingPerOfficer then
        return { ok = false, error = 'staging_limit_reached' }
    end

    local stagingId = CAD.Server.GenerateId('STAGE')
    local record = {
        stagingId = stagingId,
        evidenceType = tostring(payload.evidenceType or 'PHOTO'):upper(),
        data = type(payload.data) == 'table' and payload.data or {},
        createdAt = CAD.Server.ToIso(),
    }

    bucket[#bucket + 1] = record

    CAD.Server.BroadcastToPlayer(source, 'evidenceStaged', {
        stagingId = stagingId,
        evidenceType = record.evidenceType,
        data = record.data,
        createdAt = record.createdAt
    })

    return record
end))

lib.callback.register('cad:getStagingEvidence', CAD.Auth.WithGuard('default', function(source)
    local bucket = getOfficerStaging(source)
    return bucket
end))

lib.callback.register('cad:removeFromStaging', CAD.Auth.WithGuard('default', function(source, payload)
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

lib.callback.register('cad:evidence:container:list', CAD.Auth.WithGuard('default', function(_, payload, officer)
    if not evidenceVirtualEnabled() then
        return {
            ok = false,
            error = 'virtual_container_disabled',
        }
    end

    local terminalId, lockerId, _, containerConfig, errorResponse = resolveContainerContext(payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualEvidenceContainer(lockerId, terminalId, containerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    return {
        ok = true,
        terminalId = terminalId,
        lockerId = lockerId,
        containerKey = container.containerKey,
        slotCount = container.slotCount,
        slots = CAD.VirtualContainer.List(container.containerKey),
    }
end))

lib.callback.register('cad:evidence:container:store', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not evidenceVirtualEnabled() then
        return {
            ok = false,
            error = 'virtual_container_disabled',
        }
    end

    payload = type(payload) == 'table' and payload or {}
    local stagingId = CAD.Server.SanitizeString(payload.stagingId, 64)
    if stagingId == '' then
        return {
            ok = false,
            error = 'staging_id_required',
        }
    end

    local terminalId, lockerId, _, containerConfig, errorResponse = resolveContainerContext(payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualEvidenceContainer(lockerId, terminalId, containerConfig)
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
        storedAt = CAD.Server.ToIso(),
        storedBy = officer.identifier,
    }

    local setOk, setErr = CAD.VirtualContainer.SetSlot(container.containerKey, targetSlot, {
        itemName = 'cad_evidence_record',
        label = ('%s Evidence'):format(tostring(selected.evidenceType or 'UNKNOWN')),
        count = 1,
        metadata = metadata,
        insertedBy = officer.identifier,
        insertedAt = CAD.Server.ToIso(),
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
        lockerId = lockerId,
        containerKey = container.containerKey,
        slot = targetSlot,
        stagingId = stagingId,
    }
end))

lib.callback.register('cad:evidence:container:pull', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not evidenceVirtualEnabled() then
        return {
            ok = false,
            error = 'virtual_container_disabled',
        }
    end

    payload = type(payload) == 'table' and payload or {}

    local terminalId, lockerId, _, containerConfig, errorResponse = resolveContainerContext(payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualEvidenceContainer(lockerId, terminalId, containerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    local bucket = getOfficerStaging(source)
    if #bucket >= CAD.Config.Evidence.MaxStagingPerOfficer then
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
        stagingId = CAD.Server.GenerateId('STAGE'),
        evidenceType = tostring(metadata.evidenceType or 'PHYSICAL'):upper(),
        data = type(metadata.data) == 'table' and metadata.data or {},
        createdAt = tostring(metadata.createdAt or CAD.Server.ToIso()),
    }

    bucket[#bucket + 1] = staged

    local clearOk, clearErr = CAD.VirtualContainer.ClearSlot(container.containerKey, targetSlot)
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
        lockerId = lockerId,
        containerKey = container.containerKey,
        slot = targetSlot,
        staging = staged,
    }
end))

lib.callback.register('cad:attachEvidence', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    local stagingId = payload.stagingId
    local caseId = payload.caseId
    if not stagingId or not caseId then
        return { ok = false, error = 'invalid_payload' }
    end

    local caseObj = CAD.State.Cases[caseId]
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
        evidenceId = CAD.Server.GenerateId('EVID'),
        caseId = caseId,
        evidenceType = selected.evidenceType,
        data = selected.data,
        attachedBy = officer.identifier,
        attachedAt = CAD.Server.ToIso(),
        custodyChain = {
            {
                eventId = CAD.Server.GenerateId('CUSTODY'),
                evidenceId = '',
                eventType = 'COLLECTED',
                location = selected.data.location or 'Unknown',
                notes = 'Collected and attached to case',
                timestamp = CAD.Server.ToIso(),
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

lib.callback.register('cad:getCaseEvidence', CAD.Auth.WithGuard('default', function(_, payload)
    local caseId = type(payload) == 'string' and payload or payload.caseId
    local caseObj = caseId and CAD.State.Cases[caseId] or nil
    if not caseObj then
        return {}
    end
    return caseObj.evidence or {}
end))

lib.callback.register('cad:debug:createEvidenceItem', CAD.Auth.WithGuard('default', function(source, data)
    if not CAD.Config.Debug then
        return { ok = false, error = 'debug_disabled' }
    end

    if GetResourceState('ox_inventory') ~= 'started' then
        return { ok = false, error = 'ox_inventory_not_available' }
    end

    local itemName = CAD.Config.Evidence and CAD.Config.Evidence.TicketItemName or 'cad_ticket'
    local metadata = {
        type = 'EVIDENCE',
        evidenceType = data.evidenceType or 'PHOTO',
        imageUrl = data.imageUrl,
        description = data.description or 'Debug evidence',
        createdAt = CAD.Server.ToIso(),
        createdBy = CAD.Auth.GetOfficerData(source).name,
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
