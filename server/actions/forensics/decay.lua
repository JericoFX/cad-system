

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Decay = {}

CreateThread(function()
    while true do
        Wait(30000)

        local now = os.time()
        local evidences = GlobalState.evidences
        if type(evidences) ~= 'table' then
            evidences = {
                blood = {},
                fingerprints = {},
                casings = {},
            }
            GlobalState:set('evidences', evidences, true)
        end

        evidences.blood = type(evidences.blood) == 'table' and evidences.blood or {}
        evidences.fingerprints = type(evidences.fingerprints) == 'table' and evidences.fingerprints or {}
        evidences.casings = type(evidences.casings) == 'table' and evidences.casings or {}

        for bloodId, blood in pairs(evidences.blood) do
            local createdAt = tonumber(blood.createdAt) or now
            local age = now - createdAt
            local config = CAD.EvidenceTypes.GetType('blood')
            if not config or type(config.decay) ~= 'table' then
                goto continue
            end

            local visibility = 1.0
            if age > config.decay.visibilityHalfLife then
                local decayAge = age - config.decay.visibilityHalfLife
                visibility = math.max(0, 1 - (decayAge / config.decay.visibilityHalfLife))
            end

            local quality = 100
            if age > config.decay.qualityHalfLife then
                local decayAge = age - config.decay.qualityHalfLife
                quality = math.max(0, 100 - (decayAge / config.decay.qualityHalfLife) * 100)
            end

            if IsRaining() and age > config.decay.rainDestroySeconds then
                evidences.blood[bloodId] = nil
                goto continue
            end

            if visibility <= 0.01 or quality <= 0 then
                evidences.blood[bloodId] = nil
                goto continue
            end

            local currentVisibility = tonumber(blood.visibility) or 1.0
            local currentQuality = tonumber(blood.quality) or 100

            if visibility < currentVisibility or quality < currentQuality then
                evidences.blood[bloodId] = {
                    id = blood.id,
                    type = 'blood',
                    coords = blood.coords,
                    bloodType = blood.bloodType,
                    createdAt = createdAt,
                    visibility = visibility,
                    quality = quality,
                    ownerId = blood.ownerId
                }
            end

            ::continue::
        end

        for fpId, fp in pairs(evidences.fingerprints) do
            local createdAt = tonumber(fp.createdAt) or now
            local age = now - createdAt
            local config = CAD.EvidenceTypes.GetType('fingerprint')
            if not config or type(config.decay) ~= 'table' then
                goto continueFingerprint
            end

            local visibility = 1.0
            if age > config.decay.visibilityHalfLife then
                local decayAge = age - config.decay.visibilityHalfLife
                visibility = math.max(0, 1 - (decayAge / config.decay.visibilityHalfLife))
            end

            local quality = 100
            if age > config.decay.qualityHalfLife then
                local decayAge = age - config.decay.qualityHalfLife
                quality = math.max(0, 100 - (decayAge / config.decay.qualityHalfLife) * 100)
            end

            local currentVisibility = tonumber(fp.visibility) or 1.0
            local currentQuality = tonumber(fp.quality) or 100

            if visibility <= 0.01 or quality <= 0 then
                evidences.fingerprints[fpId] = nil
                goto continueFingerprint
            end

            if visibility < currentVisibility or quality < currentQuality then
                evidences.fingerprints[fpId] = {
                    id = fp.id,
                    type = 'fingerprint',
                    entityNetId = fp.entityNetId,
                    bone = fp.bone,
                    surface = fp.surface,
                    createdAt = createdAt,
                    visibility = visibility,
                    quality = quality,
                    ownerId = fp.ownerId
                }
            end

            ::continueFingerprint::
        end

        for casingId, casing in pairs(evidences.casings) do
            local createdAt = tonumber(casing.createdAt) or now
            local age = now - createdAt
            local config = CAD.EvidenceTypes.GetType('casing')
            if not config or type(config.decay) ~= 'table' then
                goto continueCasing
            end

            local visibility = 1.0
            if age > config.decay.visibilityHalfLife then
                local decayAge = age - config.decay.visibilityHalfLife
                visibility = math.max(0, 1 - (decayAge / config.decay.visibilityHalfLife))
            end

            local quality = 100
            if age > config.decay.qualityHalfLife then
                local decayAge = age - config.decay.qualityHalfLife
                quality = math.max(0, 100 - (decayAge / config.decay.qualityHalfLife) * 100)
            end

            local currentVisibility = tonumber(casing.visibility) or 1.0
            local currentQuality = tonumber(casing.quality) or 100

            if visibility <= 0.01 or quality <= 0 then
                evidences.casings[casingId] = nil
                goto continueCasing
            end

            if visibility < currentVisibility or quality < currentQuality then
                evidences.casings[casingId] = {
                    id = casing.id,
                    type = 'casing',
                    coords = casing.coords,
                    createdAt = createdAt,
                    visibility = visibility,
                    quality = quality,
                    ownerId = casing.ownerId
                }
            end

            ::continueCasing::
        end

        GlobalState:set('evidences', evidences, true)
    end
end)

function IsRaining()
    return GetRainLevel() > 0.3
end
