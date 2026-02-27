

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Sync = {}

local MAX_COORD_ABS = 100000.0

local function isConnectedPlayer(playerSource)
    local src = tonumber(playerSource)
    if not src or src <= 0 then
        return nil
    end

    if GetPlayerName(src) == nil then
        return nil
    end

    return src
end

local function normalizeOwnerId(evidenceType, ownerId, source)
    local src = tonumber(source) or 0
    if src <= 0 then
        return 0
    end

    if evidenceType == 'blood' then
        return isConnectedPlayer(ownerId) or src
    end

    return src
end

local function parseCoords(raw)
    local x, y, z

    if type(raw) == 'vector3' then
        x = tonumber(raw.x)
        y = tonumber(raw.y)
        z = tonumber(raw.z)
    elseif type(raw) == 'table' then
        x = tonumber(raw.x)
        y = tonumber(raw.y)
        z = tonumber(raw.z)
    else
        return nil
    end

    if not x or not y or not z then
        return nil
    end

    if math.abs(x) > MAX_COORD_ABS or math.abs(y) > MAX_COORD_ABS or math.abs(z) > MAX_COORD_ABS then
        return nil
    end

    return vector3(x, y, z)
end

local function normalizeBloodType(value)
    local bloodType = CAD.Server.SanitizeString(value, 16):upper()
    if bloodType == '' then
        return 'UNKNOWN'
    end
    return bloodType
end

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
    ensureEvidenceState()
end)

RegisterNetEvent('cad:forensic:sync', function(evidenceType, ownerId, ...)
    local src = tonumber(source)
    if not src or src <= 0 then
        return
    end

    local officer = CAD.Auth.GetOfficerData(src)
    if not officer then
        return
    end

    local normalizedType = tostring(evidenceType or ''):lower()
    if normalizedType == '' then
        return
    end

    local evidenceConfig = CAD.EvidenceTypes.GetType(normalizedType)
    if not evidenceConfig then
        return
    end

    local inActiveCrime = false
    for _, call in pairs(CAD.State.Dispatch.Calls or {}) do
        if type(call) == 'table' and call.status == 'ACTIVE' then
            inActiveCrime = true
            break
        end
    end
    local generation = type(evidenceConfig.generation) == 'table' and evidenceConfig.generation or {}
    if not inActiveCrime and generation.requireCrimeContext then
        return
    end

    local normalizedOwnerId = normalizeOwnerId(normalizedType, ownerId, src)
    local evidences = ensureEvidenceState()

    if normalizedType == 'blood' then
        local coords, bloodType = ...
        local normalizedCoords = parseCoords(coords)
        if not normalizedCoords then
            return
        end

        local bloodId = 'BLOOD_' .. math.random(1000000)

        evidences.blood[bloodId] = {
            id = bloodId,
            type = 'blood',
            coords = normalizedCoords,
            bloodType = normalizeBloodType(bloodType),
            createdAt = os.time(),
            visibility = 1.0,
            quality = 100,
            ownerId = normalizedOwnerId
        }

        GlobalState:set('evidences', evidences, true)

    elseif normalizedType == 'fingerprint' then
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
            bone = CAD.Server.SanitizeString(boneName, 64),
            surface = CAD.Server.SanitizeString(surfaceType, 64),
            createdAt = os.time(),
            visibility = 1.0,
            quality = 100,
            ownerId = normalizedOwnerId
        }

        GlobalState:set('evidences', evidences, true)

    elseif normalizedType == 'casing' then
        local coords = ...
        local normalizedCoords = parseCoords(coords)
        if not normalizedCoords then
            return
        end

        local casingId = 'CASING_' .. math.random(1000000)

        evidences.casings[casingId] = {
            id = casingId,
            type = 'casing',
            coords = normalizedCoords,
            createdAt = os.time(),
            visibility = 1.0,
            quality = 100,
            ownerId = normalizedOwnerId
        }

        GlobalState:set('evidences', evidences, true)
    end
end)

lib.callback.register('cad:forensic:getEvidence', CAD.Auth.WithGuard('default', function()
    local evidences = ensureEvidenceState()
    return {
        blood = evidences.blood or {},
        fingerprints = evidences.fingerprints or {},
        casings = evidences.casings or {}
    }
end))
