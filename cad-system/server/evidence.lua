--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Evidence = CAD.Evidence or {}

local staging = CAD.State.Evidence.Staging

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

    -- Broadcast evidence staged (notify the officer's UI only)
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

    -- Broadcast evidence attached to case
    CAD.Server.BroadcastToJobs(
        {'police', 'sheriff', 'dispatch'},
        'caseEvidenceAttached',
        {
            caseId = caseId,
            evidenceId = evidence.evidenceId,
            attachedBy = officer.identifier,
            attachedAt = evidence.attachedAt
        }
    )

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
