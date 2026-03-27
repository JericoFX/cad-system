local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'
local EvidenceTypes = require 'shared.evidence_types'

local function getAction(name) return _G.CadActions and _G.CadActions[name] end

local pendingAnalysis = {}
State.Forensics = State.Forensics or {}
State.Forensics.WorldTraces = State.Forensics.WorldTraces or {}
local worldTraces = State.Forensics.WorldTraces
local ingestRateState = {}
local traceGridEnabled = lib and lib.grid and type(lib.grid.addEntry) == 'function' and type(lib.grid.removeEntry) == 'function' and type(lib.grid.getNearbyEntries) == 'function'
local traceGridEntries = {}

local function getNowMs()
    local gameTimer = GetGameTimer and GetGameTimer() or nil
    if type(gameTimer) == 'number' then
        return gameTimer
    end
    return math.floor(os.clock() * 1000)
end

local function getForensicsConfig()
    return Config.Forensics or {}
end

---@param coords any
---@return vector3|nil
local function getTraceVectorCoords(coords)
    if type(coords) == 'vector3' then
        return coords
    end

    if type(coords) ~= 'table' then
        return nil
    end

    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    local z = tonumber(coords.z)
    if not x or not y or not z then
        return nil
    end

    return vector3(x, y, z)
end

---@param traceId string
local function removeTraceGridEntry(traceId)
    if not traceGridEnabled then
        return
    end

    local entry = traceGridEntries[traceId]
    if not entry then
        return
    end

    -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.removeEntry(entry)
    lib.grid.removeEntry(entry)
    traceGridEntries[traceId] = nil
end

---@param trace table|nil
local function upsertTraceGridEntry(trace)
    if not traceGridEnabled or type(trace) ~= 'table' then
        return
    end

    local traceId = tostring(trace.traceId or '')
    if traceId == '' then
        return
    end

    local coords = getTraceVectorCoords(trace.coords)
    if not coords then
        removeTraceGridEntry(traceId)
        return
    end

    local oldEntry = traceGridEntries[traceId]
    if oldEntry then
        -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.removeEntry(entry)
        lib.grid.removeEntry(oldEntry)
    end

    local cfg = getForensicsConfig()
    local detectRadius = tonumber(cfg.WorldTraceDetectRadius) or 18.0
    local entry = {
        coords = coords,
        radius = detectRadius,
        traceId = traceId,
    }

    -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.addEntry(entry)
    lib.grid.addEntry(entry)
    traceGridEntries[traceId] = entry
end

local function rebuildTraceGridEntries()
    if not traceGridEnabled then
        return
    end

    for traceId, entry in pairs(traceGridEntries) do
        lib.grid.removeEntry(entry)
        traceGridEntries[traceId] = nil
    end

    for _, trace in pairs(worldTraces) do
        upsertTraceGridEntry(trace)
    end
end

rebuildTraceGridEntries()

local function canIngestNow(sourceName)
    -- Limita la ingesta por recurso para reducir spam de trazas al servidor.
    local cfg = getForensicsConfig()
    local minIntervalMs = tonumber(cfg.WorldTraceMinIntervalMs) or 750
    if minIntervalMs <= 0 then
        return true
    end

    local key = tostring(sourceName or 'unknown')
    local now = getNowMs()
    local last = ingestRateState[key] or 0
    if (now - last) < minIntervalMs then
        return false
    end

    ingestRateState[key] = now
    return true
end

local function cleanupIngestRateState(nowMs)
    local cfg = getForensicsConfig()
    local minIntervalMs = tonumber(cfg.WorldTraceMinIntervalMs) or 750
    if minIntervalMs <= 0 then
        minIntervalMs = 750
    end

    local retentionMs = math.max(60000, minIntervalMs * 40)
    local currentMs = tonumber(nowMs) or getNowMs()

    for key, last in pairs(ingestRateState) do
        if (currentMs - (tonumber(last) or 0)) > retentionMs then
            ingestRateState[key] = nil
        end
    end
end

local function isForensicsEnabled()
    return Config.IsFeatureEnabled('Forensics') and Config.ForensicLabs.Enabled ~= false
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
    local officer = Auth.GetOfficerData(source)
    if not officer then
        return false
    end

    for i = 1, #Config.ForensicLabs.Locations do
        local lab = Config.ForensicLabs.Locations[i]
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
    local officer = Auth.GetOfficerData(source)
    if not officer then
        return false
    end

    if officer.isAdmin then
        return true
    end

    local allowed = Config.Forensics and Config.Forensics.WorldTraceVisibleJobs or {}
    return allowed[officer.job] == true
end

local function shouldAcceptIngestFrom(resourceName)
    local cfg = getForensicsConfig()
    local invoking = tostring(resourceName or '')
    local currentResource = GetCurrentResourceName and GetCurrentResourceName() or ''

    if invoking ~= '' and currentResource ~= '' and invoking == currentResource then
        return true
    end

    if cfg.AllowAllIngestResources == true then
        return true
    end

    if invoking == '' then
        return false
    end

    local allowed = cfg.AllowedIngestResources or {}
    return lib.table.contains(allowed, invoking)
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

    local cfg = getForensicsConfig()
    local ttlSeconds = tonumber(tracePayload.ttlSeconds)
    if not ttlSeconds or ttlSeconds <= 0 then
        ttlSeconds = cfg.WorldTraceTTLSeconds or 1800
    end
    if ttlSeconds > 86400 then
        ttlSeconds = 86400
    end

    local evidenceType = Fn.SanitizeString(tracePayload.evidenceType, 32)
    evidenceType = (evidenceType ~= '' and evidenceType or 'DNA'):upper()
    local description = Fn.SanitizeString(tracePayload.description, 500)

    local nowEpoch = os.time()
    local expiresAtEpoch = nowEpoch + ttlSeconds

    return {
        traceId = Utils.GenerateId('TRACE'),
        evidenceType = evidenceType,
        description = description ~= '' and description or ('%s trace'):format(evidenceType),
        coords = coords,
        metadata = type(tracePayload.metadata) == 'table' and tracePayload.metadata or {},
        createdAt = Utils.ToIso(),
        expiresAt = Utils.ToIso(expiresAtEpoch),
        expiresAtEpoch = expiresAtEpoch,
        sourceResource = tostring(tracePayload.sourceResource or GetInvokingResource() or 'unknown'),
    }, nil
end

local function ingestWorldTrace(payload)
    local trace, err = sanitizeTracePayload(payload)
    if not trace then
        return nil, err
    end

    worldTraces[trace.traceId] = trace
    upsertTraceGridEntry(trace)
    return trace
end

local function pruneExpiredWorldTraces()
    local now = os.time()
    for traceId, trace in pairs(worldTraces) do
        local expiresAtEpoch = tonumber(trace.expiresAtEpoch)
        if not expiresAtEpoch and type(trace.expiresAt) == 'string' then
            local y, mo, d, h, mi, s = string.match(trace.expiresAt, '^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)Z$')
            if y then
                expiresAtEpoch = os.time({
                    year = tonumber(y), month = tonumber(mo), day = tonumber(d),
                    hour = tonumber(h), min = tonumber(mi), sec = tonumber(s),
                })
                trace.expiresAtEpoch = expiresAtEpoch
            end
        end

        if expiresAtEpoch and expiresAtEpoch <= now then
            removeTraceGridEntry(traceId)
            worldTraces[traceId] = nil
        end
    end
end

if lib and lib.cron and type(lib.cron.new) == 'function' then
    -- Verified: Context7 /websites/coxdocs_dev ox_lib Cron Server lib.cron.new(expression, job, options)
    lib.cron.new('* * * * *', function()
        cleanupIngestRateState(getNowMs())
        pruneExpiredWorldTraces()
    end)
end

local function ensureSceneEvidenceState()
    local evidences = GlobalState.evidences
    local changed = false

    if type(evidences) ~= 'table' then
        evidences = {
            blood = {},
            fingerprints = {},
            casings = {},
        }
        changed = true
    else
        if type(evidences.blood) ~= 'table' then
            evidences.blood = {}
            changed = true
        end
        if type(evidences.fingerprints) ~= 'table' then
            evidences.fingerprints = {}
            changed = true
        end
        if type(evidences.casings) ~= 'table' then
            evidences.casings = {}
            changed = true
        end
    end

    if changed then
        GlobalState:set('evidences', evidences, true)
    end

    return evidences
end

local function syncSceneEvidenceState(evidences)
    GlobalState:set('evidences', evidences, true)
end

local function normalizeSceneEvidenceType(value)
    local evidenceType = Fn.SanitizeString(value, 32):upper()
    if evidenceType == 'FINGERPRINTS' then
        evidenceType = 'FINGERPRINT'
    elseif evidenceType == 'CASINGS' then
        evidenceType = 'CASING'
    end

    return evidenceType
end

local function getSceneEvidenceBucketKey(evidenceType)
    if evidenceType == 'BLOOD' then
        return 'blood'
    end

    if evidenceType == 'FINGERPRINT' then
        return 'fingerprints'
    end

    if evidenceType == 'CASING' then
        return 'casings'
    end

    return nil
end

local function asVector3Coords(value)
    if type(value) == 'vector3' then
        return value
    end

    if type(value) == 'table' then
        local x = tonumber(value.x)
        local y = tonumber(value.y)
        local z = tonumber(value.z)
        if x and y and z then
            return vector3(x, y, z)
        end
    end

    return nil
end

local function getFingerprintCoords(entry)
    local netId = tonumber(entry and (entry.entityNetId or entry.entity)) or 0
    if netId <= 0 or not NetworkDoesNetworkIdExist(netId) then
        return nil
    end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then
        return nil
    end

    local boneName = type(entry.bone) == 'string' and entry.bone or ''
    if boneName ~= '' then
        local boneIndex = GetEntityBoneIndexByName(entity, boneName)
        if boneIndex and boneIndex ~= -1 then
            return GetWorldPositionOfEntityBone(entity, boneIndex)
        end
    end

    return GetEntityCoords(entity)
end

local function getSceneEvidenceCoords(bucketKey, entry)
    if bucketKey == 'fingerprints' then
        return getFingerprintCoords(entry)
    end

    return asVector3Coords(entry and entry.coords)
end

local function resolveSceneEvidence(evidences, evidenceType, reference, radius, source)
    local bucketKey = getSceneEvidenceBucketKey(evidenceType)
    if not bucketKey then
        return nil, nil, nil
    end

    local bucket = evidences[bucketKey] or {}
    local referenceId = type(reference) == 'string' and Fn.SanitizeString(reference, 64) or ''
    if referenceId ~= '' and bucket[referenceId] then
        local entry = bucket[referenceId]
        return referenceId, entry, getSceneEvidenceCoords(bucketKey, entry)
    end

    local origin = asVector3Coords(reference)
    if not origin then
        local ped = GetPlayerPed(source)
        if ped and ped > 0 then
            origin = GetEntityCoords(ped)
        end
    end

    if not origin then
        return nil, nil, nil
    end

    local maxDistance = tonumber(radius)
    if not maxDistance or maxDistance <= 0 then
        maxDistance = 1.8
    end

    local nearestId, nearestEntry, nearestCoords = nil, nil, nil
    local nearestDistance = maxDistance

    for evidenceId, entry in pairs(bucket) do
        local entryCoords = getSceneEvidenceCoords(bucketKey, entry)
        if entryCoords then
            local distance = #(origin - entryCoords)
            if distance <= nearestDistance then
                nearestId = evidenceId
                nearestEntry = entry
                nearestCoords = entryCoords
                nearestDistance = distance
            end
        end
    end

    return nearestId, nearestEntry, nearestCoords
end

local function buildSceneEvidenceData(evidenceType, evidenceId, entry, coords, officer)
    local payload = {
        sourceEvidenceId = evidenceId,
        collectedAt = Utils.ToIso(),
        collectedBy = officer.identifier,
        location = coords and ('%.2f, %.2f, %.2f'):format(coords.x, coords.y, coords.z) or 'Unknown',
    }

    if coords then
        payload.coords = {
            x = coords.x,
            y = coords.y,
            z = coords.z,
        }
    end

    if evidenceType == 'BLOOD' then
        payload.bloodType = entry and entry.bloodType or EvidenceTypes.GetRandomBloodType()
    elseif evidenceType == 'FINGERPRINT' then
        payload.entityNetId = entry and tonumber(entry.entityNetId or entry.entity) or nil
        payload.surface = entry and entry.surface or nil
        payload.bone = entry and entry.bone or nil
        payload.ownerId = entry and entry.ownerId or nil
    elseif evidenceType == 'CASING' then
        payload.ownerId = entry and entry.ownerId or nil
    end

    return payload
end

local function addSceneEvidenceToStaging(source, evidenceType, data)
    local bucket = State.Evidence.Staging[source] or {}
    State.Evidence.Staging[source] = bucket

    local maxStaging = tonumber(Config.Evidence.MaxStagingPerOfficer) or 60
    if #bucket >= maxStaging then
        return nil, 'staging_limit_reached'
    end

    local staged = {
        stagingId = Utils.GenerateId('STAGE'),
        evidenceType = evidenceType,
        data = data,
        createdAt = Utils.ToIso(),
    }

    bucket[#bucket + 1] = staged

    Fn.BroadcastToPlayer(source, 'evidenceStaged', {
        stagingId = staged.stagingId,
        evidenceType = staged.evidenceType,
        data = staged.data,
        createdAt = staged.createdAt,
    })

    return staged, nil
end

local function canUseSceneEvidenceActions(source)
    return canHandleWorldTrace(source)
end

RegisterNetEvent('cad:forensic:reveal', function(evidenceType, reference, radius)
    local source = source
    if not canUseSceneEvidenceActions(source) then
        return
    end

    local normalizedType = normalizeSceneEvidenceType(evidenceType)
    if normalizedType == '' then
        return
    end

    local evidences = ensureSceneEvidenceState()
    local evidenceId, entry = resolveSceneEvidence(evidences, normalizedType, reference, radius, source)
    if not evidenceId or not entry then
        return
    end

    entry.revealed = true
    entry.revealedAt = Utils.ToIso()

    syncSceneEvidenceState(evidences)
end)

RegisterNetEvent('cad:forensic:collect', function(evidenceType, reference, radius)
    local source = source
    local officer = Auth.GetOfficerData(source)
    if not officer or not canUseSceneEvidenceActions(source) then
        return
    end

    local normalizedType = normalizeSceneEvidenceType(evidenceType)
    if normalizedType == '' then
        return
    end

    local evidences = ensureSceneEvidenceState()
    local evidenceId, entry, coords = resolveSceneEvidence(evidences, normalizedType, reference, radius, source)

    if not evidenceId or not entry then
        Fn.Notify(source, 'No matching scene evidence found', 'error')
        return
    end

    if not coords then
        coords = asVector3Coords(reference)
    end
    if not coords then
        local ped = GetPlayerPed(source)
        if ped and ped > 0 then
            coords = GetEntityCoords(ped)
        end
    end

    local data = buildSceneEvidenceData(normalizedType, evidenceId, entry, coords, officer)
    local staged, stageErr = addSceneEvidenceToStaging(source, normalizedType, data)
    if not staged then
        Fn.Notify(source, ('Cannot collect evidence: %s'):format(stageErr or 'unknown_error'), 'error')
        return
    end

    local bucketKey = getSceneEvidenceBucketKey(normalizedType)
    if bucketKey and evidenceId and evidences[bucketKey] and evidences[bucketKey][evidenceId] then
        evidences[bucketKey][evidenceId] = nil
        syncSceneEvidenceState(evidences)
    end

    Fn.Notify(source, ('Evidence collected: %s'):format(staged.stagingId), 'success')
end)

RegisterNetEvent('cad:forensic:destroy', function(evidenceType, reference, radius)
    local source = source
    if not canUseSceneEvidenceActions(source) then
        return
    end

    local normalizedType = normalizeSceneEvidenceType(evidenceType)
    if normalizedType == '' then
        return
    end

    local evidences = ensureSceneEvidenceState()
    local evidenceId = resolveSceneEvidence(evidences, normalizedType, reference, radius, source)

    local bucketKey = getSceneEvidenceBucketKey(normalizedType)
    if not bucketKey or not evidenceId or not evidences[bucketKey] or not evidences[bucketKey][evidenceId] then
        return
    end

    evidences[bucketKey][evidenceId] = nil
    syncSceneEvidenceState(evidences)
    Fn.Notify(source, ('Evidence destroyed: %s'):format(evidenceId), 'success')
end)

lib.callback.register('cad:forensic:checkInLab', Auth.WithGuard('default', function(source)
    return {
        enabled = isForensicsEnabled(),
        inLab = isInLab(source),
    }
end))

lib.callback.register('cad:forensic:getPendingEvidence', Auth.WithGuard('default', function(_, payload)
    if not isForensicsEnabled() then
        return {}
    end

    local caseId = Fn.SanitizeString(payload and payload.caseId, 64)
    if caseId == '' or not State.Cases[caseId] then
        return {}
    end

    local evidence = State.Cases[caseId].evidence or {}
    local out = {}
    for i = 1, #evidence do
        out[#out + 1] = evidence[i]
    end
    return out
end))

lib.callback.register('cad:forensic:analyzeEvidence', Auth.WithGuard('heavy', function(source, payload, officer)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    if not isInLab(source) then
        return { ok = false, error = 'not_in_lab' }
    end

    local caseId = Fn.SanitizeString(payload and payload.caseId, 64)
    local evidenceId = Fn.SanitizeString(payload and payload.evidenceId, 64)
    if caseId == '' or evidenceId == '' then
        return { ok = false, error = 'invalid_payload' }
    end

    local caseObj = State.Cases[caseId]
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

    local analysisId = Utils.GenerateId('ANL')
    pendingAnalysis[analysisId] = {
        analysisId = analysisId,
        caseId = caseId,
        evidenceId = evidenceId,
        evidenceType = tostring(found.evidenceType or 'UNKNOWN'):upper(),
        startedBy = officer.identifier,
        startedAt = Utils.ToIso(),
        status = 'IN_PROGRESS',
    }

    Fn.BroadcastToJobs(
        {'police', 'sheriff', 'csi', 'ambulance', 'ems'},
        'forensicsAnalysisStarted',
        {
            analysis = {
                analysisId = analysisId,
                caseId = caseId,
                evidenceId = evidenceId,
                evidenceType = pendingAnalysis[analysisId].evidenceType,
                analystId = officer.identifier,
                startedBy = officer.identifier,
                startedAt = pendingAnalysis[analysisId].startedAt,
                status = 'IN_PROGRESS',
            }
        }
    )

    return pendingAnalysis[analysisId]
end))

lib.callback.register('cad:forensic:completeAnalysis', Auth.WithGuard('heavy', function(source, payload, officer)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    if not isInLab(source) then
        return { ok = false, error = 'not_in_lab' }
    end

    payload = type(payload) == 'table' and payload or {}

    local analysisId = Fn.SanitizeString(payload.analysisId, 64)
    if analysisId == '' then
        return { ok = false, error = 'invalid_payload' }
    end

    local analysis = pendingAnalysis[analysisId]
    if not analysis then
        return { ok = false, error = 'analysis_not_found' }
    end

    if analysis.status == 'COMPLETED' then
        return { ok = false, error = 'already_completed' }
    end

    if not officer.isAdmin and analysis.startedBy ~= officer.identifier then
        return { ok = false, error = 'forbidden' }
    end

    analysis.status = 'COMPLETED'
    analysis.result = type(payload.result) == 'table' and payload.result or {}
    analysis.completedAt = Utils.ToIso()
    analysis.completedBy = officer.identifier

    Fn.BroadcastToJobs(
        {'police', 'sheriff', 'csi', 'ambulance', 'ems'},
        'forensicsAnalysisCompleted',
        {
            analysisId = analysis.analysisId,
            caseId = analysis.caseId,
            evidenceId = analysis.evidenceId,
            results = analysis.result,
            completedBy = officer.identifier,
            completedAt = analysis.completedAt
        }
    )

    return analysis
end))

lib.callback.register('cad:forensic:getAnalysisResults', Auth.WithGuard('default', function(_, payload, officer)
    if not isForensicsEnabled() then
        return {}
    end

    local evidenceId = Fn.SanitizeString(payload and payload.evidenceId, 64)
    local caseId = Fn.SanitizeString(payload and payload.caseId, 64)
    if evidenceId == '' then
        evidenceId = nil
    end
    if caseId == '' then
        caseId = nil
    end

    local out = {}
    for _, entry in pairs(pendingAnalysis) do
        local matches = true
        if evidenceId and entry.evidenceId ~= evidenceId then
            matches = false
        end
        if caseId and entry.caseId ~= caseId then
            matches = false
        end
        if not officer.isAdmin and not evidenceId and not caseId and entry.startedBy ~= officer.identifier then
            matches = false
        end

        if matches then
            out[#out + 1] = entry
        end
    end
    return out
end))

lib.callback.register('cad:forensic:compareEvidence', Auth.WithGuard('default', function(source, payload)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    local evidenceA = Fn.SanitizeString(payload and (payload.evidenceA or payload.evidenceId1), 64)
    local evidenceB = Fn.SanitizeString(payload and (payload.evidenceB or payload.evidenceId2), 64)
    if evidenceA == '' or evidenceB == '' then
        return { ok = false, error = 'invalid_payload' }
    end

    local comparisonId = Utils.GenerateId('CMP')
    local confidence = math.random(60, 98) / 100
    local isMatch = confidence >= 0.8
    local summary = isMatch and 'Automated comparison found a probable match' or
        'Automated comparison found no reliable match'

    Fn.BroadcastToPlayer(source, 'forensicsEvidenceCompared', {
        evidenceId = evidenceA,
        comparisonId = comparisonId,
        matchResults = {
            match = isMatch,
            confidence = confidence,
            details = {
                evidenceA = evidenceA,
                evidenceB = evidenceB,
                summary = summary,
            },
        },
        comparedAt = Utils.ToIso(),
    })

    return {
        ok = true,
        evidenceA = evidenceA,
        evidenceB = evidenceB,
        comparisonId = comparisonId,
        confidence = confidence,
        match = isMatch,
        summary = summary,
    }
end))

lib.callback.register('cad:forensic:collectEvidence', Auth.WithGuard('heavy', function(source, payload, officer)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    payload = type(payload) == 'table' and payload or {}

    local caseId = Fn.SanitizeString(payload.caseId, 64)
    local evidenceType = Fn.SanitizeString(payload.evidenceType, 32):upper()

    if caseId == '' or evidenceType == '' then
        return { ok = false, error = 'missing_required_fields' }
    end

    local caseObj = State.Cases[caseId]
    if not caseObj then
        return { ok = false, error = 'case_not_found' }
    end

    local data = {}
    data.description = Fn.SanitizeString(payload.description, 500)
    data.collectedBy = officer.identifier
    data.collectedByName = officer.name
    data.collectedAt = Utils.ToIso()

    if evidenceType == 'FINGERPRINT' then
        data.fingerprintId = Utils.GenerateId('FPR')
        local quality = tonumber(payload.quality) or math.random(40, 100)
        if quality < 0 then quality = 0 end
        if quality > 100 then quality = 100 end
        data.quality = math.floor(quality)
        data.pattern = (math.random(1, 3) == 1 and 'loop') or (math.random(1, 2) == 1 and 'whorl' or 'arch')
    elseif evidenceType == 'BLOOD' then
        local bloodType = Fn.SanitizeString(payload.bloodType, 8)
        data.bloodType = bloodType ~= '' and bloodType or 'O+'
    elseif evidenceType == 'DNA' then
        data.dnaHash = Utils.GenerateId('DNA')
        data.profile = 'Generated DNA Profile'
    elseif evidenceType == 'CASING' or evidenceType == 'BULLET' then
        local caliber = Fn.SanitizeString(payload.caliber, 24)
        data.caliber = caliber ~= '' and caliber or '9mm'
        data.markings = Utils.GenerateId('MKS')
    elseif evidenceType == 'FIBERS' then
        local fiberColor = Fn.SanitizeString(payload.fiberColor, 64)
        data.color = fiberColor ~= '' and fiberColor or 'white'
        data.material = 'cotton'
    end

    local evidence = {
        evidenceId = Utils.GenerateId('EVI'),
        caseId = caseId,
        evidenceType = evidenceType,
        attachedBy = officer.identifier,
        attachedAt = Utils.ToIso(),
        data = data,
        custodyChain = {
            {
                eventId = Utils.GenerateId('CUST'),
                evidenceId = '',
                eventType = 'COLLECTED',
                location = 'Crime Scene',
                timestamp = Utils.ToIso(),
                recordedBy = officer.identifier,
                notes = 'Collected at crime scene',
            }
        },
        analysisStatus = 'PENDING',
    }

    evidence.custodyChain[1].evidenceId = evidence.evidenceId

    caseObj.evidence = caseObj.evidence or {}
    table.insert(caseObj.evidence, evidence)

    local saved, saveErr = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_evidence (evidence_id, case_id, evidence_type, payload, attached_by, attached_at, custody_chain)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], {
            evidence.evidenceId,
            evidence.caseId,
            evidence.evidenceType,
            json.encode(evidence.data),
            evidence.attachedBy,
            evidence.attachedAt,
            json.encode(evidence.custodyChain),
        })
    end)

    if not saved then
        table.remove(caseObj.evidence, #caseObj.evidence)
        Utils.Log('error', 'Failed saving forensic evidence %s: %s', tostring(evidence.evidenceId), tostring(saveErr))
        return { ok = false, error = 'db_write_failed' }
    end

    Fn.BroadcastToJobs(
        {'police', 'sheriff', 'csi', 'ambulance', 'ems'},
        'evidenceCollected',
        {
            evidenceId = evidence.evidenceId,
            caseId = caseId,
            evidenceType = evidenceType,
            data = data,
            attachedBy = evidence.attachedBy,
            attachedAt = evidence.attachedAt,
            collectedBy = officer.identifier,
            collectedAt = evidence.attachedAt,
            custodyChain = evidence.custodyChain,
        }
    )

    return { ok = true, evidence = evidence }
end))

lib.callback.register('cad:forensic:getNearbyWorldTraces', Auth.WithGuard('default', function(source)
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
    local cfg = getForensicsConfig()
    local detectRadius = tonumber(cfg.WorldTraceDetectRadius) or 18.0
    local out = {}
    local seenTraceIds = {}
    local usedGrid = false

    if traceGridEnabled then
        usedGrid = true
        -- Verified: Context7 /websites/coxdocs_dev ox_lib Grid Shared lib.grid.getNearbyEntries(point, filter)
        local nearbyEntries = lib.grid.getNearbyEntries(coords, function(entry)
            if type(entry) ~= 'table' or type(entry.traceId) ~= 'string' then
                return false
            end

            local trace = worldTraces[entry.traceId]
            if not trace then
                return false
            end

            local traceCoords = getTraceVectorCoords(trace.coords)
            if not traceCoords then
                return false
            end

            return #(coords - traceCoords) <= detectRadius
        end)

        for i = 1, #nearbyEntries do
            local entry = nearbyEntries[i]
            local traceId = entry and entry.traceId
            if type(traceId) == 'string' and not seenTraceIds[traceId] then
                local trace = worldTraces[traceId]
                local traceCoords = trace and getTraceVectorCoords(trace.coords) or nil
                if trace and traceCoords then
                    seenTraceIds[traceId] = true
                    local distance = #(coords - traceCoords)
                    if distance <= detectRadius then
                        out[#out + 1] = {
                            traceId = trace.traceId,
                            evidenceType = trace.evidenceType,
                            description = trace.description,
                            coords = { x = traceCoords.x, y = traceCoords.y, z = traceCoords.z },
                            distance = distance,
                            metadata = trace.metadata,
                            createdAt = trace.createdAt,
                            expiresAt = trace.expiresAt,
                        }
                    end
                end
            end
        end
    end

    if not usedGrid then
        for _, trace in pairs(worldTraces) do
            local traceCoords = getTraceVectorCoords(trace.coords)
            if traceCoords then
                local distance = #(coords - traceCoords)
                if distance <= detectRadius then
                    out[#out + 1] = {
                        traceId = trace.traceId,
                        evidenceType = trace.evidenceType,
                        description = trace.description,
                        coords = { x = traceCoords.x, y = traceCoords.y, z = traceCoords.z },
                        distance = distance,
                        metadata = trace.metadata,
                        createdAt = trace.createdAt,
                        expiresAt = trace.expiresAt,
                    }
                end
            end
        end
    end

    if #out > 1 then
        table.sort(out, function(a, b)
            return (a.distance or 99999) < (b.distance or 99999)
        end)
    end

    return {
        ok = true,
        traces = out,
    }
end))

lib.callback.register('cad:forensic:bagWorldTrace', Auth.WithGuard('heavy', function(source, payload, officer)
    if not isForensicsEnabled() then
        return { ok = false, error = 'forensics_disabled' }
    end

    payload = type(payload) == 'table' and payload or {}

    if not canHandleWorldTrace(source) then
        return { ok = false, error = 'forbidden' }
    end

    local traceId = Fn.SanitizeString(payload.traceId, 64)
    local bagLabel = Fn.SanitizeString(payload.bagLabel, 120)
    local caseId = Fn.SanitizeString(payload.caseId, 64)
    local evidenceType = Fn.SanitizeString(payload.evidenceType, 64)
    local notes = Fn.SanitizeString(payload.notes, 800)

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
    local interactRadius = tonumber(Config.Forensics.WorldTraceInteractRadius) or 1.8
    if #(coords - trace.coords) > interactRadius then
        return { ok = false, error = 'too_far' }
    end

    local bucket = State.Evidence.Staging[source] or {}
    State.Evidence.Staging[source] = bucket
    local maxStaging = tonumber(Config.Evidence.MaxStagingPerOfficer) or 60
    if #bucket >= maxStaging then
        return { ok = false, error = 'staging_limit_reached' }
    end

    local chosenType = evidenceType ~= '' and evidenceType:upper() or trace.evidenceType
    local staged = {
        stagingId = Utils.GenerateId('STAGE'),
        evidenceType = chosenType,
        data = {
            bagLabel = bagLabel,
            description = trace.description,
            notes = notes,
            location = ('%.2f, %.2f, %.2f'):format(trace.coords.x, trace.coords.y, trace.coords.z),
            sourceTraceId = trace.traceId,
            sourceResource = trace.sourceResource,
            collectedAt = Utils.ToIso(),
            collectedBy = officer.identifier,
            metadata = trace.metadata,
        },
        createdAt = Utils.ToIso(),
    }

    bucket[#bucket + 1] = staged
    removeTraceGridEntry(trace.traceId)
    worldTraces[trace.traceId] = nil

    if caseId ~= '' and State.Cases[caseId] then
        local noteId = Utils.GenerateId('NOTE')
        local content = ('Trace bagged: %s\nType: %s\nBag: %s\nStaging: %s'):format(
            trace.traceId,
            chosenType,
            bagLabel,
            staged.stagingId
        )
        local caseObj = State.Cases[caseId]
        caseObj.notes = caseObj.notes or {}
        caseObj.notes[#caseObj.notes + 1] = {
            id = noteId,
            caseId = caseId,
            author = officer.identifier,
            content = content,
            timestamp = Utils.ToIso(),
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
                Utils.ToIso(),
                'EVIDENCE',
            })
        end)

        if not inserted then
            table.remove(caseObj.notes, #caseObj.notes)
            table.remove(bucket, #bucket)
            worldTraces[trace.traceId] = trace
            upsertTraceGridEntry(trace)
            Utils.Log('error', 'Failed saving forensic case note %s: %s', tostring(noteId), tostring(insertErr))
            return { ok = false, error = 'db_write_failed' }
        end
    end

    Fn.BroadcastToPlayer(source, 'forensicsTraceBagged', {
        traceId = trace.traceId,
        evidenceId = staged.stagingId,
        baggedBy = officer.identifier,
        baggedAt = staged.createdAt,
        staging = staged,
    })

    return {
        ok = true,
        staging = staged,
        traceId = trace.traceId,
    }
end))

lib.callback.register('cad:forensic:debugCreateTrace', Auth.WithGuard('heavy', function(source, payload)
    if Config.Debug ~= true then
        return { ok = false, error = 'debug_disabled' }
    end

    payload = type(payload) == 'table' and payload or {}

    if not Fn.HasRole(source, { 'police', 'sheriff', 'csi', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then
        return { ok = false, error = 'player_not_found' }
    end

    local coords = GetEntityCoords(ped)
    local trace, err = ingestWorldTrace({
        coords = vector3(coords.x, coords.y, coords.z),
        evidenceType = payload.evidenceType or 'DNA',
        description = payload.description or 'Debug forensic trace',
        ttlSeconds = payload.ttlSeconds,
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
        Utils.Log('debug', 'Rejected world trace ingest from %s', invoking)
        return
    end

    if not canIngestNow(invoking) then
        return
    end

    local trace, err = ingestWorldTrace(payload)
    if not trace then
        Utils.Log('debug', 'Failed world trace ingest from %s: %s', invoking, tostring(err))
        return
    end

    Utils.Log('debug', 'World trace ingested: %s (%s)', trace.traceId, trace.evidenceType)
end)

exports('IngestWorldTrace', function(payload)
    local invoking = GetInvokingResource() or 'unknown'
    if not shouldAcceptIngestFrom(invoking) then
        return nil, 'ingest_resource_not_allowed'
    end

    if not canIngestNow(invoking) then
        return nil, 'ingest_rate_limited'
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
    return Config.ForensicLabs.Locations
end)
