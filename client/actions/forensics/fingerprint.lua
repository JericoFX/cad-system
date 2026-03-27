local State = require 'modules.shared.state'
local EvidenceTypes = require 'shared.evidence_types'

local function getPed()
    return cache.ped or PlayerPedId()
end

local function getLocalServerId()
    return GetPlayerServerId(PlayerId())
end

local function isWearingGloves()
    if GetResourceState('qb-core') ~= 'started' then
        return false
    end

    local player = exports['qb-core']:GetPlayerData()
    local metadata = player and player.metadata or {}
    return tonumber(metadata.glove) ~= 0
end

local function isCrimeContext()
    local calls = State.Dispatch.Calls or {}
    for _, call in pairs(calls) do
        if type(call) == 'table' and call.status == 'ACTIVE' then
            return true
        end
    end

    return false
end

local function createFingerprintEvidence(entity, boneName, surfaceType)
    if not DoesEntityExist(entity) then
        return
    end

    local config = EvidenceTypes.GetType('fingerprint')
    if not config then
        return
    end

    local chance = tonumber(config.generation and config.generation.chance) or 1.0
    if chance < 1.0 and math.random() > chance then
        return
    end

    local entityNetId = NetworkGetNetworkIdFromEntity(entity)
    if not entityNetId or entityNetId <= 0 then
        return
    end

    TriggerServerEvent(
        'cad:forensic:sync',
        'fingerprint',
        getLocalServerId(),
        entityNetId,
        boneName,
        surfaceType
    )
end

lib.onCache('seat', function(seat)
    if not isCrimeContext() then
        return
    end

    local ped = getPed()
    if not ped or ped == 0 or isWearingGloves() then
        return
    end

    local vehicle = GetVehiclePedIsIn(ped, false)
    if not DoesEntityExist(vehicle) then
        return
    end

    local boneMap = {
        [-1] = 'door_dside_f',
        [0] = 'door_pside_f',
        [1] = 'door_dside_r',
        [2] = 'door_pside_r',
    }

    local boneName = boneMap[seat]
    if not boneName then
        return
    end

    createFingerprintEvidence(vehicle, boneName, 'Vehicle Door')
end)

AddEventHandler('ox_inventory:usedItem', function(data)
    if not isCrimeContext() then
        return
    end

    if type(data) ~= 'table' or type(data.name) ~= 'string' then
        return
    end

    local ped = getPed()
    if not ped or ped == 0 or isWearingGloves() then
        return
    end

    if data.name:find('weapon_', 1, true) then
        createFingerprintEvidence(ped, 'weapon', 'Weapon Grip')
    end
end)
