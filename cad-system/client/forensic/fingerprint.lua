--[[
CAD Forensic - Fingerprint Evidence System
Generates fingerprints on vehicle entry/exit and weapon use during crimes
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Fingerprints = {}

local function isWearingGloves()
    local player = exports['qb-core']:GetPlayerData()
    return player.metadata.glove ~= 0
end

local function isCrimeContext()
    local calls = CAD.State.Dispatch.Calls or {}
    for _, call in ipairs(calls) do
        if call.status == 'ACTIVE' then return true end
    end
    return false
end

local function createFingerprintEvidence(entity, boneName, surfaceType)
    local coords = GetEntityCoords(entity)
    local evidence = {
        id = 'FP_' .. math.random(1000000),
        type = 'fingerprint',
        entity = entity,
        bone = boneName,
        surface = surfaceType,
        createdAt = os.time(),
        quality = 100
    }
    CAD.Forensic.Fingerprints.Evidence[evidence.id] = evidence
    TriggerServerEvent('cad:forensic:sync', 'fingerprint', PlayerId(), entity, boneName, surfaceType)
    return evidence
end

-- Vehicle fingerprint generation
lib.onCache('seat', function(seat)
    if not isCrimeContext() then return end

    local ped = PlayerPedId()
    if isWearingGloves(ped) then return end

    local vehicle = GetVehiclePedIsIn(ped, false)
    if not DoesEntityExist(vehicle) then return end

    -- Map seat to door bone
    local boneMap = {
        [0] = 'door_dside_f',
        [1] = 'door_pside_f',
        [2] = 'door_dside_r',
        [3] = 'door_pside_r'
    }
    local boneName = boneMap[seat]
    if not boneName then return end

    createFingerprintEvidence(vehicle, boneName, 'Vehicle Door')
end)

-- Weapon fingerprint generation
AddEventHandler('ox_inventory:usedItem', function(data)
    if not isCrimeContext() then return end

    local ped = PlayerPedId()
    if isWearingGloves(ped) then return end

    -- Check if item is a weapon
    if data.name:find('weapon_') then
        createFingerprintEvidence(ped, 'weapon', 'Weapon Grip')
    end
end)

-- Initialize
CAD.Forensic.Fingerprints.Evidence = {}

-- Cleanup expired evidence
CreateThread(function()
    while true do
        local now = os.time()
        local config = CAD.EvidenceTypes.GetType('fingerprint')
        
        for id, evidence in pairs(CAD.Forensic.Fingerprints.Evidence) do
            local age = now - evidence.createdAt
            if age > config.decay.visibilityHalfLife * 2 then
                CAD.Forensic.Fingerprints.Evidence[id] = nil
            end
        end
        Wait(5000)
    end
end)