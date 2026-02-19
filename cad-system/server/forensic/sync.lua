

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Sync = {}

local function ensureEvidenceState()
    local evidences = GlobalState.evidences
    local changed = false

    if type(evidences) ~= 'table' then
        evidences = {
            blood = {},
            fingerprints = {},
            casings = {}
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

CreateThread(function()
    while true do
        Wait(1000)
        ensureEvidenceState()
    end
end)

RegisterNetEvent('cad:forensic:sync', function(evidenceType, ownerId, ...)
    local src = source
    local officer = CAD.Auth.GetOfficerData(src)
    if not officer then return end

    local evidenceConfig = CAD.EvidenceTypes.GetType(evidenceType)
    if not evidenceConfig then return end

    local inActiveCrime = false
    for _, call in ipairs(CAD.State.Dispatch.Calls or {}) do
        if call.status == 'ACTIVE' then
            inActiveCrime = true
            break
        end
    end
    if not inActiveCrime and evidenceConfig.generation.requireCrimeContext then
        return
    end

    local evidences = ensureEvidenceState()

    if evidenceType == 'blood' then
        local coords, bloodType = ...
        local bloodId = 'BLOOD_' .. math.random(1000000)

        evidences.blood[bloodId] = {
            id = bloodId,
            type = 'blood',
            coords = coords,
            bloodType = bloodType,
            createdAt = os.time(),
            visibility = 1.0,
            quality = 100,
            ownerId = ownerId
        }

        GlobalState:set('evidences', evidences, true)

    elseif evidenceType == 'fingerprint' then
        local entityRef, boneName, surfaceType = ...
        local entityNetId = tonumber(entityRef) or 0
        local entity = nil

        if entityNetId > 0 and NetworkDoesNetworkIdExist(entityNetId) then
            entity = NetworkGetEntityFromNetworkId(entityNetId)
        end

        if (not entity or not DoesEntityExist(entity)) and tonumber(entityRef) and tonumber(entityRef) > 0 then
            local handle = tonumber(entityRef)
            if DoesEntityExist(handle) then
                entity = handle
                entityNetId = NetworkGetNetworkIdFromEntity(handle)
            end
        end

        if not entity or not DoesEntityExist(entity) then
            return
        end

        local fpId = 'FP_' .. math.random(1000000)

        evidences.fingerprints[fpId] = {
            id = fpId,
            type = 'fingerprint',
            entityNetId = entityNetId,
            entity = entityNetId,
            bone = boneName,
            surface = surfaceType,
            createdAt = os.time(),
            visibility = 1.0,
            quality = 100,
            ownerId = ownerId
        }

        GlobalState:set('evidences', evidences, true)

    elseif evidenceType == 'casing' then
        local coords = ...
        local casingId = 'CASING_' .. math.random(1000000)

        evidences.casings[casingId] = {
            id = casingId,
            type = 'casing',
            coords = coords,
            createdAt = os.time(),
            visibility = 1.0,
            quality = 100,
            ownerId = ownerId
        }

        GlobalState:set('evidences', evidences, true)
    end
end)

lib.callback.register('cad:forensic:getEvidence', function(source)
    local evidences = ensureEvidenceState()
    return {
        blood = evidences.blood or {},
        fingerprints = evidences.fingerprints or {},
        casings = evidences.casings or {}
    }
end)
