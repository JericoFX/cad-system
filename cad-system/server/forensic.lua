CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}

local pendingAnalysis = {}

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
    
    return { ok = true, evidence = evidence }
end))

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
