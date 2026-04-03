local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'
local EvidenceTypes = require 'shared.evidence_types'


local MAX_COORD_ABS = 100000.0

---@return boolean
local function isForensicsEnabled()
    if Config.IsFeatureEnabled then
        return Config.IsFeatureEnabled('Forensics')
    end

    return true
end

---@param playerSource any
---@return integer|nil
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

---@param evidenceType string
---@param ownerId any
---@param source any
---@return integer
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

---@param raw any
---@return vector3|nil
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

---@param value any
---@return string
local function normalizeBloodType(value)
    local bloodType = Fn.SanitizeString(value, 16):upper()
    if bloodType == '' then
        return 'UNKNOWN'
    end
    return bloodType
end

---@return table
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
    if not isForensicsEnabled() then
        return
    end

    ensureEvidenceState()
end)

RegisterNetEvent('cad:forensic:sync', function(evidenceType, ownerId, ...)
    if not isForensicsEnabled() then
        return
    end

    local src = tonumber(source)
    if not src or src <= 0 then
        return
    end

    local officer = Auth.GetOfficerData(src)
    if not officer then
        return
    end

    local normalizedType = tostring(evidenceType or ''):lower()
    if normalizedType == '' then
        return
    end

    local evidenceConfig = EvidenceTypes.GetType(normalizedType)
    if not evidenceConfig then
        return
    end

    local inActiveCrime = false
    for _, call in pairs(State.Dispatch.Calls or {}) do
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

        local bloodId = Utils.GenerateId('BLOOD')

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

        local fpId = Utils.GenerateId('FP')

        evidences.fingerprints[fpId] = {
            id = fpId,
            type = 'fingerprint',
            entityNetId = entityNetId,
            entity = entityNetId,
            bone = Fn.SanitizeString(boneName, 64),
            surface = Fn.SanitizeString(surfaceType, 64),
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

        local casingId = Utils.GenerateId('CASING')

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

lib.callback.register('cad:forensic:getEvidence', Auth.WithGuard('default', function()
    local evidences = ensureEvidenceState()
    return {
        blood = evidences.blood or {},
        fingerprints = evidences.fingerprints or {},
        casings = evidences.casings or {}
    }
end))
