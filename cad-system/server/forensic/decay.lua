--[[
CAD Forensic - Evidence Decay System
Handles visibility and data quality decay over time
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Decay = {}

CreateThread(function()
    while true do
        Wait(30000) -- Check every 3 seconds
        
        local now = os.time()
        
        -- Process blood evidence
        for bloodId, blood in pairs(GlobalState.evidences.blood or {}) do
            local age = now - blood.createdAt
            local config = CAD.EvidenceTypes.GetType('blood')
            
            -- Visibility decay
            local visibility = 1.0
            if age > config.decay.visibilityHalfLife then
                local decayAge = age - config.decay.visibilityHalfLife
                visibility = math.max(0, 1 - (decayAge / config.decay.visibilityHalfLife))
            end
            
            -- Quality decay
            local quality = 100
            if age > config.decay.qualityHalfLife then
                local decayAge = age - config.decay.qualityHalfLife
                quality = math.max(0, 100 - (decayAge / config.decay.qualityHalfLife) * 100)
            end
            
            -- Rain destruction
            if IsRaining() and age > config.decay.rainDestroySeconds then
                GlobalState.evidences.blood[bloodId] = nil
                TriggerClientEvent('cad:forensic:decay:blood', -1, bloodId)
                goto continue
            end
            
            -- Update if values changed
            if visibility < blood.visibility or quality < blood.quality then
                GlobalState.evidences.blood[bloodId] = {
                    id = blood.id,
                    type = 'blood',
                    coords = blood.coords,
                    bloodType = blood.bloodType,
                    createdAt = blood.createdAt,
                    visibility = visibility,
                    quality = quality,
                    ownerId = blood.ownerId
                }
                TriggerClientEvent('cad:forensic:decay:blood', -1, GlobalState.evidences.blood[bloodId])
            end
            
            ::continue::
        end
        
        -- Process fingerprint evidence
        for fpId, fp in pairs(GlobalState.evidences.fingerprints or {}) do
            local age = now - fp.createdAt
            local config = CAD.EvidenceTypes.GetType('fingerprint')
            
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
            
            if visibility < fp.visibility or quality < fp.quality then
                GlobalState.evidences.fingerprints[fpId] = {
                    id = fp.id,
                    type = 'fingerprint',
                    entityNetId = fp.entityNetId,
                    bone = fp.bone,
                    surface = fp.surface,
                    createdAt = fp.createdAt,
                    visibility = visibility,
                    quality = quality,
                    ownerId = fp.ownerId
                }
                TriggerClientEvent('cad:forensic:decay:fingerprint', -1, GlobalState.evidences.fingerprints[fpId])
            end
        end
        
        -- Process casing evidence
        for casingId, casing in pairs(GlobalState.evidences.casings or {}) do
            local age = now - casing.createdAt
            local config = CAD.EvidenceTypes.GetType('casing')
            
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
            
            if visibility < casing.visibility or quality < casing.quality then
                GlobalState.evidences.casings[casingId] = {
                    id = casing.id,
                    type = 'casing',
                    coords = casing.coords,
                    createdAt = casing.createdAt,
                    visibility = visibility,
                    quality = quality,
                    ownerId = casing.ownerId
                }
                TriggerClientEvent('cad:forensic:decay:casing', -1, GlobalState.evidences.casings[casingId])
            end
        end
    end
end)

-- Helper to check rain status
function IsRaining()
    return GetRainLevel() > 0.3
end