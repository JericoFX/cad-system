local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'
local Registry = require 'modules.shared.registry'


local alerts = State.EMS.Alerts
local bloodRequests = State.EMS.BloodRequests
local createAlert

local BLOOD_REQUEST_STATUSES = {
    PENDING = true,
    ACKNOWLEDGED = true,
    IN_PROGRESS = true,
    COMPLETED = true,
    DECLINED = true,
    CANCELLED = true,
}

local bloodSampleStashRegistered = false

local function isEmsEnabled()
    if Config.IsFeatureEnabled then
        return Config.IsFeatureEnabled('EMS')
    end

    return true
end

local function emsDisabledResponse()
    return { ok = false, error = 'ems_disabled' }
end

local function isBloodSampleVirtualEnabled()
    local cfg = Config.Forensics and Config.Forensics.BloodSampleContainer or {}
    if cfg.enabled == false then
        return false
    end

    return Registry.Get("VirtualContainer") ~= nil
end

local function getBloodSampleContainerConfig()
    local forensics = Config.Forensics or {}
    local cfg = forensics.BloodSampleContainer or {}
    local stashCfg = forensics.BloodSampleStash or {}
    local fallbackKey = tostring(stashCfg.stashId or 'cad_ems_blood_lab')

    local containerKey = tostring(cfg.containerKey or ('forensics:%s'):format(fallbackKey))
    local slotCount = math.max(1, math.floor(tonumber(cfg.slots) or tonumber(stashCfg.slots) or 200))

    return {
        containerKey = containerKey,
        slotCount = slotCount,
    }
end

local function ensureBloodSampleContainer()
    if not isBloodSampleVirtualEnabled() then
        return nil, 'blood_sample_virtual_disabled'
    end

    local cfg = getBloodSampleContainerConfig()
    local VCAction = Registry.Get("VirtualContainer")
    local container, ensureErr = VCAction and VCAction.Ensure(cfg.containerKey, {
        containerType = 'blood_lab',
        endpointId = 'ems_blood_lab',
        slotCount = cfg.slotCount,
        readSlot = 1,
        strictAllowedItems = false,
    })

    if not container then
        return nil, ensureErr or 'blood_sample_container_not_ready'
    end

    return container
end

local function findContainerFreeSlot(container)
    if not container then
        return nil
    end

    for i = 1, tonumber(container.slotCount) or 0 do
        if not container.slots[i] then
            return i
        end
    end

    return nil
end

local function getNowMs()
    return os.time() * 1000
end

local function getBloodAnalysisDurationMs()
    local configured = tonumber(Config.Forensics and Config.Forensics.BloodAnalysisDurationMs) or 45000
    if configured < 1000 then
        configured = 1000
    end
    return math.floor(configured)
end

local function getBloodPostAnalysisMode()
    local cfg = Config.Forensics and Config.Forensics.BloodPostAnalysis or {}
    local mode = tostring(cfg.mode or 'reminder'):lower()
    if mode ~= 'disabled' and mode ~= 'reminder' and mode ~= 'auto_send' then
        return 'reminder'
    end
    return mode
end

local function getBloodPostAnalysisTimeoutMs()
    local cfg = Config.Forensics and Config.Forensics.BloodPostAnalysis or {}
    local timeoutMs = tonumber(cfg.timeoutMs) or 120000
    if timeoutMs < 1000 then
        timeoutMs = 1000
    end
    return math.floor(timeoutMs)
end

local function getBloodReminderIntervalMs()
    local cfg = Config.Forensics and Config.Forensics.BloodPostAnalysis or {}
    local intervalMs = tonumber(cfg.reminderIntervalMs) or 120000
    if intervalMs < 1000 then
        intervalMs = 1000
    end
    return math.floor(intervalMs)
end

local function getBloodToxicologySnapshot(request)
    local snapshot = {
        testedAt = Utils.ToIso(),
        isPositive = false,
        activeCount = 0,
        substances = {},
        source = 'QBCORE_METADATA',
    }

    local ForensicAction = Registry.Get("Forensic")
    local toxicology = ForensicAction and ForensicAction.Toxicology or nil
    if type(toxicology) ~= 'table' or type(toxicology.GetSnapshotForCitizen) ~= 'function' then
        snapshot.source = 'UNAVAILABLE'
        return snapshot
    end

    local citizenId = Fn.SanitizeString(request and request.citizenId, 64)
    if citizenId == '' then
        return snapshot
    end

    local resolved = toxicology.GetSnapshotForCitizen(citizenId)
    if type(resolved) ~= 'table' then
        return snapshot
    end

    if type(resolved.substances) ~= 'table' then
        resolved.substances = {}
    end

    local activeCount = tonumber(resolved.activeCount)
    if not activeCount then
        activeCount = #resolved.substances
    end

    resolved.activeCount = activeCount
    resolved.isPositive = activeCount > 0
    resolved.testedAt = resolved.testedAt or snapshot.testedAt
    resolved.source = resolved.source or snapshot.source
    return resolved
end

local function caseExists(caseId)
    if not caseId or caseId == '' then
        return false
    end

    return State.Cases[caseId] ~= nil
end

local function snapshotTable(input)
    return lib.table.deepclone(input)
end

local function restoreTable(target, snapshot)
    for key in pairs(target) do
        target[key] = nil
    end
    for key, value in pairs(snapshot) do
        target[key] = value
    end
end

local function buildBloodRequestClientPayload(request)
    local analysisRemainingMs = nil
    local analysisReady = false

    if request.status == 'IN_PROGRESS' and request.analysisEndsAtMs then
        analysisRemainingMs = math.max(0, (tonumber(request.analysisEndsAtMs) or 0) - getNowMs())
        analysisReady = analysisRemainingMs == 0
    end

    return {
        requestId = request.requestId,
        caseId = request.caseId,
        citizenId = request.citizenId,
        personName = request.personName,
        reason = request.reason,
        location = request.location,
        status = request.status,
        requestedBy = request.requestedBy,
        requestedByName = request.requestedByName,
        requestedByJob = request.requestedByJob,
        requestedAt = request.requestedAt,
        handledBy = request.handledBy,
        handledByName = request.handledByName,
        handledAt = request.handledAt,
        notes = request.notes,
        analysisStartedAt = request.analysisStartedAt,
        analysisStartedAtMs = request.analysisStartedAtMs,
        analysisDurationMs = request.analysisDurationMs,
        analysisEndsAt = request.analysisEndsAt,
        analysisEndsAtMs = request.analysisEndsAtMs,
        analysisCompletedAt = request.analysisCompletedAt,
        analysisCompletedAtMs = request.analysisCompletedAtMs,
        lastReminderAt = request.lastReminderAt,
        lastReminderAtMs = request.lastReminderAtMs,
        analysisRemainingMs = analysisRemainingMs,
        analysisReady = analysisReady,
        evidenceId = request.evidenceId,
    }
end

local function saveBloodRequestDb(request)
    if not request or not request.requestId then
        return false, 'invalid_request'
    end

    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_ems_blood_requests (
                request_id,
                case_id,
                citizen_id,
                person_name,
                reason,
                location,
                status,
                requested_by,
                requested_by_name,
                requested_by_job,
                requested_at,
                handled_by,
                handled_by_name,
                handled_at,
                notes,
                analysis_started_at,
                analysis_started_ms,
                analysis_duration_ms,
                analysis_ends_at,
                analysis_ends_ms,
                analysis_completed_at,
                analysis_completed_ms,
                last_reminder_at,
                last_reminder_ms,
                sample_stash_id,
                sample_slot,
                sample_item_name,
                sample_metadata,
                evidence_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                case_id = VALUES(case_id),
                citizen_id = VALUES(citizen_id),
                person_name = VALUES(person_name),
                reason = VALUES(reason),
                location = VALUES(location),
                status = VALUES(status),
                requested_by = VALUES(requested_by),
                requested_by_name = VALUES(requested_by_name),
                requested_by_job = VALUES(requested_by_job),
                requested_at = VALUES(requested_at),
                handled_by = VALUES(handled_by),
                handled_by_name = VALUES(handled_by_name),
                handled_at = VALUES(handled_at),
                notes = VALUES(notes),
                analysis_started_at = VALUES(analysis_started_at),
                analysis_started_ms = VALUES(analysis_started_ms),
                analysis_duration_ms = VALUES(analysis_duration_ms),
                analysis_ends_at = VALUES(analysis_ends_at),
                analysis_ends_ms = VALUES(analysis_ends_ms),
                analysis_completed_at = VALUES(analysis_completed_at),
                analysis_completed_ms = VALUES(analysis_completed_ms),
                last_reminder_at = VALUES(last_reminder_at),
                last_reminder_ms = VALUES(last_reminder_ms),
                sample_stash_id = VALUES(sample_stash_id),
                sample_slot = VALUES(sample_slot),
                sample_item_name = VALUES(sample_item_name),
                sample_metadata = VALUES(sample_metadata),
                evidence_id = VALUES(evidence_id)
        ]], {
            request.requestId,
            request.caseId,
            request.citizenId,
            request.personName,
            request.reason,
            request.location,
            request.status,
            request.requestedBy,
            request.requestedByName,
            request.requestedByJob,
            request.requestedAt,
            request.handledBy,
            request.handledByName,
            request.handledAt,
            request.notes,
            request.analysisStartedAt,
            request.analysisStartedAtMs,
            request.analysisDurationMs,
            request.analysisEndsAt,
            request.analysisEndsAtMs,
            request.analysisCompletedAt,
            request.analysisCompletedAtMs,
            request.lastReminderAt,
            request.lastReminderAtMs,
            request.sampleStashId,
            request.sampleSlot,
            request.sampleItemName,
            request.sampleMetadata and json.encode(request.sampleMetadata) or nil,
            request.evidenceId,
        })
    end)

    if not ok then
        Utils.Log('error', 'Failed saving blood request %s: %s', tostring(request.requestId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

local function ensureBloodSampleStash()
    local cfg = Config.Forensics and Config.Forensics.BloodSampleStash or nil
    if type(cfg) ~= 'table' or cfg.enabled == false then
        return false, 'blood_sample_stash_disabled'
    end

    if GetResourceState('ox_inventory') ~= 'started' then
        return false, 'ox_inventory_missing'
    end

    if bloodSampleStashRegistered then
        return true
    end

    local stashId = tostring(cfg.stashId or 'cad_ems_blood_lab')
    local label = tostring(cfg.label or 'EMS Blood Evidence Locker')
    local slots = math.max(1, tonumber(cfg.slots) or 200)
    local weight = math.max(1000, tonumber(cfg.weight) or 500000)

    local registered, registerErr = pcall(function()
        exports.ox_inventory:RegisterStash(stashId, label, slots, weight, false, {
            ambulance = 0,
            ems = 0,
            admin = 0,
        })
    end)

    if not registered then
        return false, tostring(registerErr)
    end

    bloodSampleStashRegistered = true
    return true
end

local function createBloodSampleItem(request, officer)
    local itemName = tostring(Config.Forensics and Config.Forensics.BloodSampleItemName or 'cad_blood_sample')
    local metadata = {
        requestId = request.requestId,
        caseId = request.caseId,
        citizenId = request.citizenId,
        personName = request.personName,
        reason = request.reason,
        collectedBy = officer.identifier,
        collectedByName = officer.name,
        collectedAt = Utils.ToIso(),
        sealId = Utils.GenerateId('SEAL'),
        toxicologySnapshot = getBloodToxicologySnapshot(request),
    }

    if isBloodSampleVirtualEnabled() then
        local container, containerErr = ensureBloodSampleContainer()
        if not container then
            return false, containerErr or 'blood_sample_container_not_ready'
        end

        local freeSlot = findContainerFreeSlot(container)
        if not freeSlot then
            return false, 'blood_sample_container_full'
        end

        local setOk, setErr = Registry.Get("VirtualContainer").SetSlot(container.containerKey, freeSlot, {
            itemName = itemName,
            label = 'Blood Sample',
            count = 1,
            metadata = metadata,
            insertedBy = officer.identifier,
            insertedAt = Utils.ToIso(),
        })

        if not setOk then
            return false, setErr or 'cannot_create_sample_item'
        end

        request.sampleStashId = container.containerKey
        request.sampleItemName = itemName
        request.sampleMetadata = metadata
        request.sampleSlot = freeSlot

        return true
    end

    local ok, err = ensureBloodSampleStash()
    if not ok then
        return false, err
    end

    local stashId = tostring((Config.Forensics and Config.Forensics.BloodSampleStash and Config.Forensics.BloodSampleStash.stashId) or
    'cad_ems_blood_lab')

    local callOk, addOk, addResponse = pcall(function()
        return exports.ox_inventory:AddItem(stashId, itemName, 1, metadata)
    end)

    if not callOk then
        return false, 'sample_add_failed'
    end

    if addOk == false then
        return false, addResponse or 'cannot_create_sample_item'
    end

    request.sampleStashId = stashId
    request.sampleItemName = itemName
    request.sampleMetadata = metadata

    if type(addResponse) == 'number' then
        request.sampleSlot = addResponse
    elseif type(addOk) == 'number' then
        request.sampleSlot = addOk
    end

    return true
end

local function removeBloodSampleItem(request)
    if not request.sampleStashId or request.sampleStashId == '' then
        return true
    end

    local VCAction = Registry.Get("VirtualContainer")
    if VCAction and VCAction.Get(request.sampleStashId) then
        if request.sampleSlot then
            local clearOk, clearErr = VCAction.ClearSlot(request.sampleStashId, tonumber(request.sampleSlot))
            if not clearOk then
                return false, clearErr or 'cannot_remove_sample_item'
            end
        else
            local slotIndex, _ = VCAction.GetFirstOccupied(request.sampleStashId)
            if slotIndex then
                local clearOk, clearErr = VCAction.ClearSlot(request.sampleStashId, slotIndex)
                if not clearOk then
                    return false, clearErr or 'cannot_remove_sample_item'
                end
            end
        end

        request.sampleSlot = nil
        request.sampleMetadata = nil
        request.sampleItemName = nil
        request.sampleStashId = nil
        return true
    end

    local stashOk, stashErr = ensureBloodSampleStash()
    if not stashOk then
        return false, stashErr
    end

    local itemName = request.sampleItemName or
    tostring(Config.Forensics and Config.Forensics.BloodSampleItemName or 'cad_blood_sample')
    local removed, response
    local callOk = false
    if request.sampleSlot then
        callOk, removed, response = pcall(function()
            return exports.ox_inventory:RemoveItem(
                request.sampleStashId,
                itemName,
                1,
                nil,
                tonumber(request.sampleSlot),
                true,
                false
            )
        end)
    else
        callOk, removed, response = pcall(function()
            return exports.ox_inventory:RemoveItem(
                request.sampleStashId,
                itemName,
                1,
                request.sampleMetadata,
                nil,
                true,
                false
            )
        end)
    end

    if not callOk then
        return false, 'sample_remove_failed'
    end

    if removed == false then
        return false, response or 'cannot_remove_sample_item'
    end

    request.sampleSlot = nil
    request.sampleMetadata = nil
    request.sampleItemName = nil
    request.sampleStashId = nil
    return true
end

local function isAnalysisReady(request)
    if request.status ~= 'IN_PROGRESS' then
        return false
    end

    local endsAtMs = tonumber(request.analysisEndsAtMs) or 0
    if endsAtMs <= 0 then
        return false
    end

    return getNowMs() >= endsAtMs
end

local function notifyOfficerByIdentifier(identifier, message, notificationType)
    if not identifier or identifier == '' then
        return
    end

    local players = GetPlayers()
    for i = 1, #players do
        local source = tonumber(players[i])
        local officer = Auth.GetOfficerData(source)
        if officer and officer.identifier == identifier then
            Fn.Notify(source, message, notificationType)
            return
        end
    end
end

local function appendBloodEvidenceToCase(request, officer, notes)
    if not request.caseId or request.caseId == '' then
        return nil, 'case_id_required'
    end

    local caseObj = State.Cases[request.caseId]
    if not caseObj then
        return nil, 'case_not_found'
    end

    local nowIso = Utils.ToIso()
    local toxicologySnapshot = nil
    if type(request.sampleMetadata) == 'table' and type(request.sampleMetadata.toxicologySnapshot) == 'table' then
        toxicologySnapshot = lib.table.deepclone(request.sampleMetadata.toxicologySnapshot)
    else
        toxicologySnapshot = getBloodToxicologySnapshot(request)
    end

    local evidence = {
        evidenceId = Utils.GenerateId('EVID'),
        caseId = request.caseId,
        evidenceType = 'BLOOD',
        data = {
            requestId = request.requestId,
            citizenId = request.citizenId,
            personName = request.personName,
            reason = request.reason,
            location = request.location,
            analysis = {
                startedAt = request.analysisStartedAt,
                durationMs = request.analysisDurationMs,
                completedAt = nowIso,
                handledBy = officer.identifier,
                notes = notes,
                toxicology = toxicologySnapshot,
            },
            sample = {
                sealId = request.sampleMetadata and request.sampleMetadata.sealId or nil,
                source = 'EMS_BLOOD_LAB',
            },
        },
        attachedBy = officer.identifier,
        attachedAt = nowIso,
        custodyChain = {
            {
                eventId = Utils.GenerateId('CUSTODY'),
                evidenceId = '',
                eventType = 'COLLECTED',
                location = request.location or 'EMS Intake',
                notes = ('Blood sample collected for request %s'):format(request.requestId),
                timestamp = request.analysisStartedAt or nowIso,
                recordedBy = officer.identifier,
            },
            {
                eventId = Utils.GenerateId('CUSTODY'),
                evidenceId = '',
                eventType = 'ANALYZED',
                location = 'EMS Lab',
                notes = 'Blood sample analysis completed',
                timestamp = nowIso,
                recordedBy = officer.identifier,
            },
            {
                eventId = Utils.GenerateId('CUSTODY'),
                evidenceId = '',
                eventType = 'SUBMITTED',
                location = 'CAD Case File',
                notes = 'Sent to police case as forensic evidence',
                timestamp = nowIso,
                recordedBy = officer.identifier,
            },
        },
    }

    for i = 1, #evidence.custodyChain do
        evidence.custodyChain[i].evidenceId = evidence.evidenceId
    end

    local EvidenceAction = Registry.Get("Evidence")
    if EvidenceAction and EvidenceAction.AppendCaseEvidence then
        local ok = EvidenceAction.AppendCaseEvidence(request.caseId, evidence)
        if not ok then
            return nil, 'cannot_attach_evidence'
        end
    else
        caseObj.evidence = caseObj.evidence or {}
        caseObj.evidence[#caseObj.evidence + 1] = evidence
        caseObj.updatedAt = nowIso
    end

    return evidence
end

local function pushCaseBloodNote(request, emsOfficer, status, notes, evidenceId)
    if not request.caseId or not caseExists(request.caseId) then
        return
    end

    local caseObj = State.Cases[request.caseId]
    caseObj.notes = caseObj.notes or {}

    local noteContent = ('Blood sample request %s\nPerson: %s (%s)\nRequested by: %s\nHandled by: %s\nEvidence ID: %s\nNotes: %s')
    :format(
        status,
        request.personName or 'UNKNOWN',
        request.citizenId or 'UNKNOWN',
        request.requestedByName or request.requestedBy or 'UNKNOWN',
        emsOfficer.name,
        evidenceId or 'N/A',
        notes ~= '' and notes or 'N/A'
    )

    caseObj.notes[#caseObj.notes + 1] = {
        id = Utils.GenerateId('NOTE'),
        caseId = request.caseId,
        author = emsOfficer.identifier,
        content = noteContent,
        timestamp = Utils.ToIso(),
        type = 'evidence',
    }
end

local function createBloodRequest(payload, officer)
    local request = {
        requestId = Utils.GenerateId('BLOODREQ'),
        caseId = Fn.SanitizeString(payload.caseId, 64),
        citizenId = Fn.SanitizeString(payload.citizenId, 64),
        personName = Fn.SanitizeString(payload.personName, 120),
        reason = Fn.SanitizeString(payload.reason, 500),
        location = Fn.SanitizeString(payload.location, 120),
        status = 'PENDING',
        requestedBy = officer.identifier,
        requestedByName = officer.name,
        requestedByJob = officer.job,
        requestedAt = Utils.ToIso(),
        handledBy = nil,
        handledByName = nil,
        handledAt = nil,
        notes = '',
        analysisStartedAt = nil,
        analysisStartedAtMs = nil,
        analysisDurationMs = nil,
        analysisEndsAt = nil,
        analysisEndsAtMs = nil,
        analysisCompletedAt = nil,
        analysisCompletedAtMs = nil,
        lastReminderAt = nil,
        lastReminderAtMs = nil,
        sampleStashId = nil,
        sampleSlot = nil,
        sampleItemName = nil,
        sampleMetadata = nil,
        evidenceId = nil,
    }

    if request.personName == '' then
        request.personName = Config.Forensics.UnknownPersonLabel or 'UNKNOWN'
    end

    if request.reason == '' then
        request.reason = 'Blood sample requested by police'
    end

    if request.caseId == '' then
        request.caseId = nil
    end

    if request.citizenId == '' then
        request.citizenId = nil
    end

    local saved, saveErr = saveBloodRequestDb(request)
    if not saved then
        return nil, saveErr or 'db_write_failed'
    end

    bloodRequests[request.requestId] = request

    local caseSuffix = request.caseId and (' | Case: %s'):format(request.caseId) or ''
    local alertTitle = ('Blood Sample Request: %s'):format(request.personName)
    local alertDescription = ('Request %s by %s%s'):format(request.requestId, officer.name, caseSuffix)

    local _, alertErr = createAlert(alertTitle, alertDescription, 'MEDIUM', nil, officer.identifier)
    if alertErr then
        Utils.Log('warn', 'Blood request %s created without alert: %s', tostring(request.requestId), tostring(alertErr))
    end
    Fn.NotifyJobs({ 'ambulance', 'ems' }, ('New blood sample request %s'):format(request.requestId), 'warning')

    Fn.BroadcastToJobs(
        {'ambulance', 'ems'},
        'emsBloodRequestCreated',
        { request = request }
    )

    return request
end

local function beginBloodAnalysis(request, officer, notes)
    if request.status == 'COMPLETED' then
        return false, 'already_completed'
    end

    local previousRequest = snapshotTable(request)

    if not request.analysisStartedAtMs then
        local durationMs = getBloodAnalysisDurationMs()
        local startedAtMs = getNowMs()
        local endsAtMs = startedAtMs + durationMs

        request.analysisDurationMs = durationMs
        request.analysisStartedAtMs = startedAtMs
        request.analysisStartedAt = Utils.ToIso(math.floor(startedAtMs / 1000))
        request.analysisEndsAtMs = endsAtMs
        request.analysisEndsAt = Utils.ToIso(math.floor(endsAtMs / 1000))

        local created, createErr = createBloodSampleItem(request, officer)
        if not created then
            return false, createErr
        end
    end

    request.status = 'IN_PROGRESS'
    request.handledBy = officer.identifier
    request.handledByName = officer.name
    request.handledAt = Utils.ToIso()
    request.notes = notes
    request.lastReminderAt = nil
    request.lastReminderAtMs = nil

    local saved, saveErr = saveBloodRequestDb(request)
    if not saved then
        if request.sampleStashId then
            local _, removeErr = removeBloodSampleItem(request)
            if removeErr then
                Utils.Log('warn', 'Failed cleaning blood sample after save failure %s: %s', tostring(request.requestId),
                    tostring(removeErr))
            end
        end
        restoreTable(request, previousRequest)
        return false, saveErr or 'db_write_failed'
    end

    return true
end

local function finalizeBloodTransfer(request, officer, notes)
    if request.status ~= 'IN_PROGRESS' then
        return nil, 'analysis_not_in_progress'
    end

    if not isAnalysisReady(request) then
        local remainingMs = math.max(0, (tonumber(request.analysisEndsAtMs) or 0) - getNowMs())
        return nil, 'analysis_pending', remainingMs
    end

    local evidence, attachErr = appendBloodEvidenceToCase(request, officer, notes)
    if not evidence then
        return nil, attachErr or 'cannot_attach_evidence'
    end

    local removed, removeErr = removeBloodSampleItem(request)
    if not removed then
        return nil, removeErr or 'cannot_remove_sample_item'
    end

    local completedAtMs = getNowMs()
    request.status = 'COMPLETED'
    request.handledBy = officer.identifier
    request.handledByName = officer.name
    request.handledAt = Utils.ToIso()
    request.analysisCompletedAtMs = completedAtMs
    request.analysisCompletedAt = Utils.ToIso(math.floor(completedAtMs / 1000))
    request.notes = notes
    request.evidenceId = evidence.evidenceId
    request.lastReminderAt = nil
    request.lastReminderAtMs = nil

    local saved, saveErr = saveBloodRequestDb(request)
    if not saved then
        return nil, saveErr or 'db_write_failed'
    end

    return evidence
end

local function shouldSendReminder(request, nowMs, reminderIntervalMs)
    local lastReminderAtMs = tonumber(request.lastReminderAtMs) or 0
    if lastReminderAtMs <= 0 then
        return true
    end

    return (nowMs - lastReminderAtMs) >= reminderIntervalMs
end

local function runBloodPostAnalysisPolicy()
    if Config.IsFeatureEnabled and not Config.IsFeatureEnabled('Forensics') then
        return
    end

    local mode = getBloodPostAnalysisMode()
    if mode == 'disabled' then
        return
    end

    local nowMs = getNowMs()
    local timeoutMs = getBloodPostAnalysisTimeoutMs()
    local reminderIntervalMs = getBloodReminderIntervalMs()

    for _, request in pairs(bloodRequests) do
        if request.status == 'IN_PROGRESS' then
            local analysisEndsAtMs = tonumber(request.analysisEndsAtMs) or 0
            if analysisEndsAtMs > 0 and nowMs >= analysisEndsAtMs then
                local overdueMs = nowMs - analysisEndsAtMs
                if overdueMs >= timeoutMs then
                    if mode == 'auto_send' then
                        local autoOfficer = {
                            identifier = 'system',
                            name = 'EMS Auto Transfer',
                            job = 'ems',
                            isAdmin = true,
                        }

                        local evidence, transferErr = finalizeBloodTransfer(
                            request,
                            autoOfficer,
                            'Auto-sent by timeout policy'
                        )

                        if evidence then
                            local caseLabel = request.caseId or 'NO_CASE'
                            Fn.NotifyJobs(
                                { 'police', 'sheriff', 'csi' },
                                ('Evidence added to case %s (blood sample %s) [AUTO]'):format(caseLabel,
                                    evidence.evidenceId),
                                'success'
                            )
                            Fn.NotifyJobs(
                                { 'ambulance', 'ems' },
                                ('Blood request %s auto-sent to case %s'):format(request.requestId, caseLabel),
                                'inform'
                            )
                            notifyOfficerByIdentifier(
                                request.requestedBy,
                                ('Blood evidence auto-added to case %s (%s)'):format(caseLabel, evidence.evidenceId),
                                'inform'
                            )
                            pushCaseBloodNote(
                                request,
                                autoOfficer,
                                'AUTO_COMPLETED',
                                'Auto-sent after timeout',
                                evidence.evidenceId
                            )
                        else
                            if shouldSendReminder(request, nowMs, reminderIntervalMs) then
                                request.lastReminderAtMs = nowMs
                                request.lastReminderAt = Utils.ToIso(math.floor(nowMs / 1000))
                                local saved = saveBloodRequestDb(request)
                                if not saved then
                                    Utils.Log('warn', 'Failed persisting reminder state for blood request %s',
                                        tostring(request.requestId))
                                end

                                Fn.NotifyJobs(
                                    { 'ambulance', 'ems' },
                                    ('Blood request %s auto-send failed (%s)'):format(
                                        request.requestId,
                                        tostring(transferErr or 'unknown_error')
                                    ),
                                    'warning'
                                )
                            end
                        end
                    elseif mode == 'reminder' then
                        if shouldSendReminder(request, nowMs, reminderIntervalMs) then
                            request.lastReminderAtMs = nowMs
                            request.lastReminderAt = Utils.ToIso(math.floor(nowMs / 1000))
                            local saved = saveBloodRequestDb(request)
                            if not saved then
                                Utils.Log('warn', 'Failed persisting reminder state for blood request %s',
                                    tostring(request.requestId))
                            end

                            Fn.NotifyJobs(
                                { 'ambulance', 'ems' },
                                ('Reminder: blood request %s is ready to send (%ss overdue)'):format(
                                    request.requestId,
                                    math.floor(overdueMs / 1000)
                                ),
                                'warning'
                            )
                        end
                    end
                end
            end
        end
    end
end

local function saveAlertDb(alert)
    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_ems_alerts (alert_id, title, description, severity, coords, status, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status)
        ]], {
            alert.alertId,
            alert.title,
            alert.description,
            alert.severity,
            alert.coords and json.encode(alert.coords) or nil,
            alert.status,
            alert.createdBy,
            alert.createdAt,
        })
    end)

    if not ok then
        Utils.Log('error', 'Failed saving EMS alert %s: %s', tostring(alert and alert.alertId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

createAlert = function(title, description, severity, coords, createdBy)
    local alert = {
        alertId = Utils.GenerateId('EMSALERT'),
        title = Fn.SanitizeString(title, 255),
        description = Fn.SanitizeString(description, 2000),
        severity = tostring(severity or 'MEDIUM'):upper(),
        coords = coords,
        status = 'ACTIVE',
        createdBy = createdBy,
        createdAt = Utils.ToIso(),
    }
    local saved, saveErr = saveAlertDb(alert)
    if not saved then
        return nil, saveErr or 'db_write_failed'
    end

    alerts[alert.alertId] = alert

    Fn.BroadcastToJobs(
        {'ambulance', 'ems', 'dispatch'},
        'emsAlertCreated',
        { alert = alert }
    )

    return alert
end

lib.callback.register('cad:ems:getUnits', Auth.WithGuard('default', function()
    if not isEmsEnabled() then
        return {}
    end

    return State.EMS.Units
end))

lib.callback.register('cad:ems:getAlerts', Auth.WithGuard('default', function()
    if not isEmsEnabled() then
        return {}
    end

    local out = {}
    for _, alert in pairs(alerts) do
        out[#out + 1] = alert
    end
    table.sort(out, function(a, b)
        return (a.createdAt or '') > (b.createdAt or '')
    end)
    return out
end))

lib.callback.register('cad:ems:createAlert', Auth.WithGuard('heavy', function(source, payload, officer)
    if not isEmsEnabled() then
        return emsDisabledResponse()
    end

    if not Fn.HasRole(source, { 'ambulance', 'ems', 'dispatch', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local alert, alertErr = createAlert(
        payload.title or 'Medical Alert',
        payload.description or '',
        payload.severity or 'MEDIUM',
        payload.coords,
        officer.identifier
    )

    if not alert then
        return { ok = false, error = alertErr or 'cannot_create_alert' }
    end

    Fn.NotifyJobs({ 'ambulance', 'ems', 'dispatch' }, ('EMS ALERT: %s'):format(alert.title), 'warning')
    return alert
end))

lib.callback.register('cad:ems:updateUnit', Auth.WithGuard('default', function(_, payload)
    if not isEmsEnabled() then
        return emsDisabledResponse()
    end

    local unitId = payload.unitId
    if not unitId or not State.EMS.Units[unitId] then
        return { ok = false, error = 'unit_not_found' }
    end

    if payload.status and Config.EMS.UnitStatuses[payload.status] then
        State.EMS.Units[unitId].status = payload.status
    end
    if payload.currentCall ~= nil then
        State.EMS.Units[unitId].currentCall = payload.currentCall
    end
    if type(payload.location) == 'table' then
        State.EMS.Units[unitId].location = payload.location
    end

    State.EMS.Units[unitId].updatedAt = Utils.ToIso()
    return State.EMS.Units[unitId]
end))

lib.callback.register('cad:ems:critical_patient', Auth.WithGuard('default', function(_, payload, officer)
    if not isEmsEnabled() then
        return emsDisabledResponse()
    end

    local patientName = payload.patientName or payload.name or 'Unknown Patient'
    local alert, alertErr = createAlert(
        ('Critical Patient: %s'):format(patientName),
        ('Patient ID: %s'):format(payload.patientId or 'N/A'),
        'HIGH',
        payload.coords,
        officer.identifier
    )

    if not alert then
        return { ok = false, error = alertErr or 'cannot_create_alert' }
    end

    Fn.NotifyJobs({ 'ambulance', 'ems' }, ('Critical patient admitted: %s'):format(patientName), 'error')
    return alert
end))

lib.callback.register('cad:ems:getMedicalHistory', Auth.WithGuard('default', function(source, payload)
    if not isEmsEnabled() then
        return { ok = true, records = {} }
    end

    if not Fn.HasRole(source, { 'ambulance', 'ems', 'police', 'sheriff', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local citizenId = Fn.SanitizeString(payload and payload.citizenId, 64)
    if citizenId == '' then
        return { ok = false, error = 'citizen_id_required' }
    end

    local ok, rows = pcall(function()
        return MySQL.query.await(
            'SELECT record_id, citizen_id, citizen_name, visit_date, diagnosis, treatment_summary, prescriptions, treating_medic, treating_medic_name, vitals_snapshot, notes, created_at FROM cad_medical_records WHERE citizen_id = ? ORDER BY visit_date DESC',
            { citizenId }
        )
    end)

    if not ok then
        Utils.Log('error', 'Failed loading medical records for %s: %s', citizenId, tostring(rows))
        return { ok = false, error = 'db_read_failed' }
    end

    local records = {}
    for i = 1, #(rows or {}) do
        local row = rows[i]
        local prescriptions = {}
        if type(row.prescriptions) == 'string' and row.prescriptions ~= '' then
            local decodeOk, decoded = pcall(json.decode, row.prescriptions)
            if decodeOk and type(decoded) == 'table' then
                prescriptions = decoded
            end
        end

        local vitalsSnapshot = nil
        if type(row.vitals_snapshot) == 'string' and row.vitals_snapshot ~= '' then
            local decodeOk, decoded = pcall(json.decode, row.vitals_snapshot)
            if decodeOk and type(decoded) == 'table' then
                vitalsSnapshot = decoded
            end
        end

        records[#records + 1] = {
            recordId = row.record_id,
            citizenId = row.citizen_id,
            citizenName = row.citizen_name,
            visitDate = row.visit_date,
            diagnosis = row.diagnosis,
            treatmentSummary = row.treatment_summary,
            prescriptions = prescriptions,
            treatingMedic = row.treating_medic,
            treatingMedicName = row.treating_medic_name,
            vitalsSnapshot = vitalsSnapshot,
            notes = row.notes,
            createdAt = row.created_at,
        }
    end

    return { ok = true, records = records }
end))

lib.callback.register('cad:ems:createMedicalRecord', Auth.WithGuard('heavy', function(source, payload)
    if not isEmsEnabled() then
        return emsDisabledResponse()
    end

    if not Fn.HasRole(source, { 'ambulance', 'ems', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local citizenId = Fn.SanitizeString(payload and payload.citizenId, 64)
    if citizenId == '' then
        return { ok = false, error = 'citizen_id_required' }
    end

    local recordId = Utils.GenerateId('MEDREC')
    local nowIso = Utils.ToIso()

    local prescriptionsJson = nil
    if type(payload.prescriptions) == 'table' and #payload.prescriptions > 0 then
        local encodeOk, encoded = pcall(json.encode, payload.prescriptions)
        if encodeOk then
            prescriptionsJson = encoded
        end
    end

    local vitalsJson = nil
    if type(payload.vitalsSnapshot) == 'table' then
        local encodeOk, encoded = pcall(json.encode, payload.vitalsSnapshot)
        if encodeOk then
            vitalsJson = encoded
        end
    end

    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_medical_records (record_id, citizen_id, citizen_name, visit_date, diagnosis, treatment_summary, prescriptions, treating_medic, treating_medic_name, vitals_snapshot, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ]], {
            recordId,
            citizenId,
            Fn.SanitizeString(payload.citizenName, 128),
            Fn.SanitizeString(payload.visitDate, 32) ~= '' and payload.visitDate or nowIso,
            Fn.SanitizeString(payload.diagnosis, 500),
            Fn.SanitizeString(payload.treatmentSummary, 10000),
            prescriptionsJson,
            Fn.SanitizeString(payload.treatingMedic, 128),
            Fn.SanitizeString(payload.treatingMedicName, 128),
            vitalsJson,
            Fn.SanitizeString(payload.notes, 5000),
            nowIso,
        })
    end)

    if not ok then
        Utils.Log('error', 'Failed saving medical record %s: %s', recordId, tostring(err))
        return { ok = false, error = 'db_write_failed' }
    end

    return { ok = true, recordId = recordId }
end))

lib.callback.register('cad:ems:handoff_complete', Auth.WithGuard('default', function(_, payload)
    if not isEmsEnabled() then
        return emsDisabledResponse()
    end

    local alert, alertErr = createAlert(
        'Medical Handoff Completed',
        ('Patient %s linked to case %s'):format(payload.patientId or 'N/A', payload.caseId or 'N/A'),
        'LOW',
        nil,
        'system'
    )

    if not alert then
        return { ok = false, error = alertErr or 'cannot_create_alert' }
    end

    return alert
end))

lib.callback.register('cad:ems:createBloodRequest', Auth.WithGuard('heavy', function(source, payload, officer)
    if not isEmsEnabled() then
        return emsDisabledResponse()
    end

    if not Fn.HasRole(source, { 'police', 'sheriff', 'csi', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local request, reqErr = createBloodRequest(payload or {}, officer)
    if not request then
        return { ok = false, error = reqErr or 'cannot_create_request' }
    end

    return {
        ok = true,
        request = buildBloodRequestClientPayload(request),
    }
end))

lib.callback.register('cad:ems:getBloodRequests', Auth.WithGuard('default', function(source, payload)
    if not isEmsEnabled() then
        return {
            ok = true,
            requests = {},
        }
    end

    if not Fn.HasRole(source, { 'ambulance', 'ems', 'police', 'sheriff', 'csi', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local requestedStatus = payload and payload.status and tostring(payload.status):upper() or nil
    local rows = {}

    for _, request in pairs(bloodRequests) do
        if not requestedStatus or request.status == requestedStatus then
            rows[#rows + 1] = buildBloodRequestClientPayload(request)
        end
    end

    table.sort(rows, function(a, b)
        return (a.requestedAt or '') > (b.requestedAt or '')
    end)

    return {
        ok = true,
        requests = rows,
    }
end))

lib.callback.register('cad:ems:updateBloodRequest', Auth.WithGuard('default', function(source, payload, officer)
    if not isEmsEnabled() then
        return emsDisabledResponse()
    end

    if not Fn.HasRole(source, { 'ambulance', 'ems', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local requestId = Fn.SanitizeString(payload and payload.requestId, 64)
    local status = tostring(payload and payload.status or ''):upper()
    local notes = Fn.SanitizeString(payload and payload.notes, 1000)

    if requestId == '' then
        return { ok = false, error = 'request_id_required' }
    end

    if not BLOOD_REQUEST_STATUSES[status] then
        return { ok = false, error = 'invalid_status' }
    end

    local request = bloodRequests[requestId]
    if not request then
        return { ok = false, error = 'not_found' }
    end

    if status == 'ACKNOWLEDGED' then
        if request.status ~= 'PENDING' then
            return { ok = false, error = 'invalid_transition' }
        end

        request.status = status
        request.handledBy = officer.identifier
        request.handledByName = officer.name
        request.handledAt = Utils.ToIso()
        request.notes = notes
        local saved, saveErr = saveBloodRequestDb(request)
        if not saved then
            return { ok = false, error = saveErr or 'db_write_failed' }
        end

        Fn.NotifyJobs(
            { 'police', 'sheriff', 'csi' },
            ('Blood request %s is now ACKNOWLEDGED by %s'):format(request.requestId, officer.name),
            'inform'
        )

        return {
            ok = true,
            request = buildBloodRequestClientPayload(request),
        }
    end

    if status == 'IN_PROGRESS' then
        if request.status ~= 'PENDING' and request.status ~= 'ACKNOWLEDGED' and request.status ~= 'IN_PROGRESS' then
            return { ok = false, error = 'invalid_transition' }
        end

        local started, startErr = beginBloodAnalysis(request, officer, notes)
        if not started then
            return { ok = false, error = startErr or 'cannot_start_analysis' }
        end

        Fn.NotifyJobs(
            { 'police', 'sheriff', 'csi' },
            ('Blood request %s analysis started by EMS (%s)'):format(request.requestId, officer.name),
            'inform'
        )

        return {
            ok = true,
            request = buildBloodRequestClientPayload(request),
        }
    end

    if status == 'COMPLETED' then
        local evidence, transferErr, remainingMs = finalizeBloodTransfer(request, officer, notes)
        if not evidence then
            return {
                ok = false,
                error = transferErr or 'cannot_finalize_analysis',
                remainingMs = remainingMs,
            }
        end

        local caseLabel = request.caseId or 'NO_CASE'
        Fn.NotifyJobs(
            { 'police', 'sheriff', 'csi' },
            ('Evidence added to case %s (blood sample %s)'):format(caseLabel, evidence.evidenceId),
            'success'
        )
        notifyOfficerByIdentifier(
            request.requestedBy,
            ('Blood evidence added to case %s (%s)'):format(caseLabel, evidence.evidenceId),
            'success'
        )
        pushCaseBloodNote(request, officer, status, notes, evidence.evidenceId)

        return {
            ok = true,
            request = buildBloodRequestClientPayload(request),
            evidenceId = evidence.evidenceId,
        }
    end

    if status == 'DECLINED' or status == 'CANCELLED' then
        if request.status == 'COMPLETED' then
            return { ok = false, error = 'invalid_transition' }
        end

        local previousRequest = snapshotTable(request)
        request.status = status
        request.handledBy = officer.identifier
        request.handledByName = officer.name
        request.handledAt = Utils.ToIso()
        request.notes = notes
        request.lastReminderAt = nil
        request.lastReminderAtMs = nil

        local removed, removeErr = removeBloodSampleItem(request)
        if not removed then
            restoreTable(request, previousRequest)
            return { ok = false, error = removeErr or 'cannot_remove_sample_item' }
        end

        local saved, saveErr = saveBloodRequestDb(request)
        if not saved then
            return { ok = false, error = saveErr or 'db_write_failed' }
        end

        Fn.NotifyJobs(
            { 'police', 'sheriff', 'csi' },
            ('Blood request %s %s by EMS'):format(request.requestId, string.lower(status)),
            status == 'DECLINED' and 'error' or 'warning'
        )

        return {
            ok = true,
            request = buildBloodRequestClientPayload(request),
        }
    end

    return { ok = false, error = 'status_not_supported' }
end))

lib.cron.new('* * * * *', function()
    if not isEmsEnabled() then
        return
    end

    local ok, result = pcall(runBloodPostAnalysisPolicy)
    if not ok then
        Utils.Log('error', 'Blood post-analysis cron failure: %s', tostring(result))
    end
end)
