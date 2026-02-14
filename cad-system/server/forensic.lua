--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}

local pendingAnalysis = {}
CAD.State.Forensics = CAD.State.Forensics or {}
CAD.State.Forensics.WorldTraces = CAD.State.Forensics.WorldTraces or {}
local worldTraces = CAD.State.Forensics.WorldTraces

local function isForensicsEnabled()
    return CAD.IsFeatureEnabled('Forensics') and CAD.Config.ForensicLabs.Enabled ~= false
end

local function isInLab(source)
    if not isForensicsEnabled() then
        return false
    end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then
        return false
    end

    local coords = GetEntityCoords(ped)
    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then
        return false
    end

    for i = 1, #CAD.Config.ForensicLabs.Locations do
        local lab = CAD.Config.ForensicLabs.Locations[i]
        local distance = #(coords - lab.coords)
        if distance <= lab.radius then
            for j = 1, #lab.jobs do
                if lab.jobs[j] == officer.job then
                    return true
                end
            end
        end
    end

    return false
end

local function canHandleWorldTrace(source)
    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then
        return false
    end

    if officer.isAdmin then
        return true
    end

    local allowed = CAD.Config.Forensics and CAD.Config.Forensics.WorldTraceVisibleJobs or {}
    return allowed[officer.job] == true
end

local function shouldAcceptIngestFrom(resourceName)
    if CAD.Config.Forensics.AllowAllIngestResources == true then
        return true
    end

    if not resourceName or resourceName == '' then
        return false
    end

    local allowed = CAD.Config.Forensics.AllowedIngestResources or {}
    return CAD.TableContains(allowed, resourceName)
end

local function sanitizeTracePayload(payload)
    local tracePayload = type(payload) == 'table' and payload or {}
    local coords = tracePayload.coords
    if type(coords) ~= 'vector3' then
        if type(coords) == 'table' and tonumber(coords.x) and tonumber(coords.y) and tonumber(coords.z) then
            coords = vector3(tonumber(coords.x), tonumber(coords.y), tonumber(coords.z))
        else
            return nil, 'invalid_coords'
        end
    end

    local ttlSeconds = tonumber(tracePayload.ttlSeconds)
    if not ttlSeconds or ttlSeconds <= 0 then
        ttlSeconds = CAD.Config.Forensics.WorldTraceTTLSeconds or 1800
    end

    local evidenceType = tostring(tracePayload.evidenceType or 'DNA'):upper()
    local description = CAD.Server.SanitizeString(tracePayload.description, 500)

    return {
        traceId = CAD.Server.GenerateId('TRACE'),
        evidenceType = evidenceType,
        description = description ~= '' and description or ('%s trace'):format(evidenceType),
        coords = coords,
        metadata = type(tracePayload.metadata) == 'table' and tracePayload.metadata or {},
        createdAt = CAD.Server.ToIso(),
        expiresAt = CAD.Server.ToIso(os.time() + ttlSeconds),
        sourceResource = tostring(tracePayload.sourceResource or GetInvokingResource() or 'unknown'),
    }, nil
end

local function ingestWorldTrace(payload)
    local trace, err = sanitizeTracePayload(payload)
    if not trace then
        return nil, err
    end

    worldTraces[trace.traceId] = trace
    return trace
end

local function pruneExpiredWorldTraces()
    local now = os.time()
    for traceId, trace in pairs(worldTraces) do
        if trace.expiresAt then
            local y, mo, d, h, mi, s = string.match(trace.expiresAt, '^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)Z$')
            if y then
                local expiresAt = os.time({
                    year = tonumber(y), month = tonumber(mo), day = tonumber(d),
                    hour = tonumber(h), min = tonumber(mi), sec = tonumber(s),
                })
                if expiresAt <= now then
                    worldTraces[traceId] = nil
                end
            end
        end
    end
end

lib.callback.register('cad:forensic:checkInLab', CAD.Auth.WithGuard('default', function(source)
    return {
        enabled = isForensicsEnabled(),
        inLab = isInLab(source),
    }
end))

lib.callback.register('cad:forensic:getPendingEvidence', CAD.Auth.WithGuard('default', function(_, payload)
    if not isForensicsEnabled() then
        return {}
    end

    local caseId = payload and payload.caseId
    if not caseId or not CAD.State.Cases[caseId] then
        return {}
    end

    local evidence = CAD.State.Cases[caseId].evidence or {}
    local out = {}
    for i = 1, #evidence do
        out[#out + 1] = evidence[i]
    end
    return out
end))

lib.callback.register('cad:forensic:analyzeEvidence', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    if not isInLab(source) then
        return { ok = false, error = 'not_in_lab' }
    end

    local caseId = payload.caseId
    local evidenceId = payload.evidenceId
    if not caseId or not evidenceId then
        return { ok = false, error = 'invalid_payload' }
    end

    local caseObj = CAD.State.Cases[caseId]
    if not caseObj then
        return { ok = false, error = 'case_not_found' }
    end

    local found = nil
    for i = 1, #(caseObj.evidence or {}) do
        if caseObj.evidence[i].evidenceId == evidenceId then
            found = caseObj.evidence[i]
            break
        end
    end

    if not found then
        return { ok = false, error = 'evidence_not_found' }
    end

    local analysisId = CAD.Server.GenerateId('ANL')
    pendingAnalysis[analysisId] = {
        analysisId = analysisId,
        caseId = caseId,
        evidenceId = evidenceId,
        startedBy = officer.identifier,
        startedAt = CAD.Server.ToIso(),
        status = 'IN_PROGRESS',
    }

    return pendingAnalysis[analysisId]
end))

lib.callback.register('cad:forensic:completeAnalysis', CAD.Auth.WithGuard('heavy', function(_, payload, officer)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    local analysis = pendingAnalysis[payload.analysisId]
    if not analysis then
        return { ok = false, error = 'analysis_not_found' }
    end

    analysis.status = 'COMPLETED'
    analysis.result = payload.result or {}
    analysis.completedAt = CAD.Server.ToIso()
    analysis.completedBy = officer.identifier

    return analysis
end))

lib.callback.register('cad:forensic:getAnalysisResults', CAD.Auth.WithGuard('default', function(_, payload)
    if not isForensicsEnabled() then
        return {}
    end

    local evidenceId = payload and payload.evidenceId
    local out = {}
    for _, entry in pairs(pendingAnalysis) do
        if not evidenceId or entry.evidenceId == evidenceId then
            out[#out + 1] = entry
        end
    end
    return out
end))

lib.callback.register('cad:forensic:compareEvidence', CAD.Auth.WithGuard('default', function(_, payload)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    return {
        ok = true,
        evidenceA = payload and payload.evidenceA,
        evidenceB = payload and payload.evidenceB,
        confidence = math.random(60, 98),
        summary = 'Automated comparison completed',
    }
end))

-- Collect forensic evidence
lib.callback.register('cad:forensic:collectEvidence', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    local caseId = payload.caseId
    local evidenceType = payload.evidenceType
    
    if not caseId or not evidenceType then
        return { ok = false, error = 'missing_required_fields' }
    end
    
    local caseObj = CAD.State.Cases[caseId]
    if not caseObj then
        return { ok = false, error = 'case_not_found' }
    end
    
    -- Generate evidence data based on type
    local data = {}
    
    if evidenceType == 'FINGERPRINT' then
        data.fingerprintId = CAD.Server.GenerateId('FPR')
        data.quality = payload.quality or math.random(40, 100)
        data.pattern = (math.random(1, 3) == 1 and 'loop') or (math.random(1, 2) == 1 and 'whorl' or 'arch')
    elseif evidenceType == 'BLOOD' then
        data.bloodType = payload.bloodType or 'O+'
    elseif evidenceType == 'DNA' then
        data.dnaHash = CAD.Server.GenerateId('DNA')
        data.profile = 'Generated DNA Profile'
    elseif evidenceType == 'CASING' or evidenceType == 'BULLET' then
        data.caliber = payload.caliber or '9mm'
        data.markings = CAD.Server.GenerateId('MKS')
    elseif evidenceType == 'FIBERS' then
        data.color = payload.fiberColor or 'white'
        data.material = 'cotton'
    end
    
    -- Create evidence
    local evidence = {
        evidenceId = CAD.Server.GenerateId('EVI'),
        caseId = caseId,
        evidenceType = evidenceType,
        description = payload.description or 'No description',
        collectedBy = officer.identifier,
        collectedByName = officer.name,
        collectedAt = CAD.Server.ToIso(),
        data = data,
        custodyChain = {
            {
                eventId = CAD.Server.GenerateId('CUST'),
                evidenceId = '',
                eventType = 'COLLECTED',
                location = 'Crime Scene',
                timestamp = CAD.Server.ToIso(),
                recordedBy = officer.identifier,
                notes = 'Collected at crime scene',
            }
        },
        analysisStatus = 'PENDING',
    }
    
    evidence.custodyChain[1].evidenceId = evidence.evidenceId
    
    -- Add to case
    caseObj.evidence = caseObj.evidence or {}
    table.insert(caseObj.evidence, evidence)
    
    -- Save to database
    local saved, saveErr = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_evidence (evidence_id, case_id, evidence_type, payload, attached_by, attached_at, custody_chain)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], {
            evidence.evidenceId,
            evidence.caseId,
            evidence.evidenceType,
            json.encode(evidence.data),
            evidence.collectedBy,
            evidence.collectedAt,
            json.encode(evidence.custodyChain),
        })
    end)

    if not saved then
        table.remove(caseObj.evidence, #caseObj.evidence)
        CAD.Log('error', 'Failed saving forensic evidence %s: %s', tostring(evidence.evidenceId), tostring(saveErr))
        return { ok = false, error = 'db_write_failed' }
    end
    
    return { ok = true, evidence = evidence }
end))

lib.callback.register('cad:forensic:getNearbyWorldTraces', CAD.Auth.WithGuard('default', function(source)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled', traces = {} }
    end

    if not canHandleWorldTrace(source) then
        return { ok = true, traces = {} }
    end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then
        return { ok = false, error = 'player_not_found', traces = {} }
    end

    pruneExpiredWorldTraces()

    local coords = GetEntityCoords(ped)
    local detectRadius = tonumber(CAD.Config.Forensics.WorldTraceDetectRadius) or 18.0
    local out = {}

    for _, trace in pairs(worldTraces) do
        local distance = #(coords - trace.coords)
        if distance <= detectRadius then
            out[#out + 1] = {
                traceId = trace.traceId,
                evidenceType = trace.evidenceType,
                description = trace.description,
                coords = { x = trace.coords.x, y = trace.coords.y, z = trace.coords.z },
                distance = distance,
                metadata = trace.metadata,
                createdAt = trace.createdAt,
                expiresAt = trace.expiresAt,
            }
        end
    end

    table.sort(out, function(a, b)
        return (a.distance or 99999) < (b.distance or 99999)
    end)

    return {
        ok = true,
        traces = out,
    }
end))

lib.callback.register('cad:forensic:bagWorldTrace', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    if not canHandleWorldTrace(source) then
        return { ok = false, error = 'forbidden' }
    end

    local traceId = CAD.Server.SanitizeString(payload.traceId, 64)
    local bagLabel = CAD.Server.SanitizeString(payload.bagLabel, 120)
    local caseId = CAD.Server.SanitizeString(payload.caseId, 64)
    local evidenceType = CAD.Server.SanitizeString(payload.evidenceType, 64)
    local notes = CAD.Server.SanitizeString(payload.notes, 800)

    if traceId == '' then
        return { ok = false, error = 'missing_trace_id' }
    end

    if bagLabel == '' then
        return { ok = false, error = 'missing_bag_label' }
    end

    local trace = worldTraces[traceId]
    if not trace then
        return { ok = false, error = 'trace_not_found' }
    end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then
        return { ok = false, error = 'player_not_found' }
    end

    local coords = GetEntityCoords(ped)
    local interactRadius = tonumber(CAD.Config.Forensics.WorldTraceInteractRadius) or 1.8
    if #(coords - trace.coords) > interactRadius then
        return { ok = false, error = 'too_far' }
    end

    local bucket = CAD.State.Evidence.Staging[source] or {}
    CAD.State.Evidence.Staging[source] = bucket
    local maxStaging = tonumber(CAD.Config.Evidence.MaxStagingPerOfficer) or 60
    if #bucket >= maxStaging then
        return { ok = false, error = 'staging_limit_reached' }
    end

    local chosenType = evidenceType ~= '' and evidenceType:upper() or trace.evidenceType
    local staged = {
        stagingId = CAD.Server.GenerateId('STAGE'),
        evidenceType = chosenType,
        data = {
            bagLabel = bagLabel,
            description = trace.description,
            notes = notes,
            location = ('%.2f, %.2f, %.2f'):format(trace.coords.x, trace.coords.y, trace.coords.z),
            sourceTraceId = trace.traceId,
            sourceResource = trace.sourceResource,
            collectedAt = CAD.Server.ToIso(),
            collectedBy = officer.identifier,
            metadata = trace.metadata,
        },
        createdAt = CAD.Server.ToIso(),
    }

    bucket[#bucket + 1] = staged
    worldTraces[trace.traceId] = nil

    if caseId ~= '' and CAD.State.Cases[caseId] then
        local noteId = CAD.Server.GenerateId('NOTE')
        local content = ('Trace bagged: %s\nType: %s\nBag: %s\nStaging: %s'):format(
            trace.traceId,
            chosenType,
            bagLabel,
            staged.stagingId
        )
        local caseObj = CAD.State.Cases[caseId]
        caseObj.notes = caseObj.notes or {}
        caseObj.notes[#caseObj.notes + 1] = {
            id = noteId,
            caseId = caseId,
            author = officer.identifier,
            content = content,
            timestamp = CAD.Server.ToIso(),
            type = 'evidence',
        }

        local inserted, insertErr = pcall(function()
            MySQL.insert.await([[
                INSERT INTO cad_case_notes (note_id, case_id, author, content, timestamp, note_type)
                VALUES (?, ?, ?, ?, ?, ?)
            ]], {
                noteId,
                caseId,
                officer.identifier,
                content,
                CAD.Server.ToIso(),
                'EVIDENCE',
            })
        end)

        if not inserted then
            table.remove(caseObj.notes, #caseObj.notes)
            table.remove(bucket, #bucket)
            worldTraces[trace.traceId] = trace
            CAD.Log('error', 'Failed saving forensic case note %s: %s', tostring(noteId), tostring(insertErr))
            return { ok = false, error = 'db_write_failed' }
        end
    end

    return {
        ok = true,
        staging = staged,
        traceId = trace.traceId,
    }
end))

lib.callback.register('cad:forensic:debugCreateTrace', CAD.Auth.WithGuard('heavy', function(source, payload)
    if CAD.Config.Debug ~= true then
        return { ok = false, error = 'debug_disabled' }
    end

    if not CAD.Server.HasRole(source, { 'police', 'sheriff', 'csi', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then
        return { ok = false, error = 'player_not_found' }
    end

    local coords = GetEntityCoords(ped)
    local trace, err = ingestWorldTrace({
        coords = vector3(coords.x, coords.y, coords.z),
        evidenceType = payload and payload.evidenceType or 'DNA',
        description = payload and payload.description or 'Debug forensic trace',
        ttlSeconds = payload and payload.ttlSeconds,
        metadata = {
            debug = true,
        },
    })

    if not trace then
        return { ok = false, error = err or 'cannot_create_trace' }
    end

    return { ok = true, trace = trace }
end))

RegisterNetEvent('cad:forensic:ingestWorldTrace', function(payload)
    local source = source
    if source and source > 0 then
        return
    end

    local invoking = GetInvokingResource() or 'unknown'
    if not shouldAcceptIngestFrom(invoking) then
        CAD.Log('warn', 'Rejected world trace ingest from %s', invoking)
        return
    end

    local trace, err = ingestWorldTrace(payload)
    if not trace then
        CAD.Log('warn', 'Failed world trace ingest from %s: %s', invoking, tostring(err))
        return
    end

    CAD.Log('debug', 'World trace ingested: %s (%s)', trace.traceId, trace.evidenceType)
end)

exports('IngestWorldTrace', function(payload)
    local invoking = GetInvokingResource() or 'unknown'
    if not shouldAcceptIngestFrom(invoking) then
        return nil, 'ingest_resource_not_allowed'
    end

    return ingestWorldTrace(payload)
end)

exports('GetForensicData', function(playerId)
    return {
        playerId = playerId,
        available = isForensicsEnabled(),
    }
end)

exports('AnalyzeEvidence', function(officerSource, evidenceId, notes)
    if not isForensicsEnabled() then
        return {
            source = officerSource,
            evidenceId = evidenceId,
            notes = notes,
            accepted = false,
            error = 'forensics_disabled',
        }
    end

    return {
        source = officerSource,
        evidenceId = evidenceId,
        notes = notes,
        accepted = true,
    }
end)

exports('IsPlayerInLab', function(playerId)
    return isInLab(playerId)
end)

exports('GetLabLocations', function()
    return CAD.Config.ForensicLabs.Locations
end)
