local State = require 'modules.shared.state'
local EvidenceTypes = require 'shared.evidence_types'

local lastEmitAt = 0

local function getGroundZ(x, y, fallbackZ)
    for i = 0, 1000, 10 do
        local ok, groundZ = GetGroundZFor_3dCoord(x, y, i + 0.0, false)
        if ok then
            return groundZ
        end
    end

    return fallbackZ
end

local function getPlayerServerIdFromPed(ped)
    local playerIndex = NetworkGetPlayerIndexFromPed(ped)
    if not playerIndex or playerIndex == -1 then
        return 0
    end

    local source = GetPlayerServerId(playerIndex)
    return source and source > 0 and source or 0
end

local function isCrimeContext(victimPed)
    local victimSource = getPlayerServerIdFromPed(victimPed)
    local calls = State.Dispatch.Calls or {}

    for _, call in pairs(calls) do
        if type(call) == 'table' and call.status == 'ACTIVE' then
            if victimSource == 0 or type(call.subjects) ~= 'table' then
                return true
            end

            for j = 1, #call.subjects do
                if call.subjects[j].id == victimSource then
                    return true
                end
            end
        end
    end

    return false
end

local function emitBloodEvidence(victimPed)
    local now = GetGameTimer()
    if now - lastEmitAt < 1000 then
        return
    end

    lastEmitAt = now

    local coords = GetEntityCoords(victimPed)
    local z = getGroundZ(coords.x, coords.y, coords.z)
    local bloodType = EvidenceTypes.GetRandomBloodType()
    local ownerId = getPlayerServerIdFromPed(victimPed)

    TriggerServerEvent('cad:forensic:sync', 'blood', ownerId, vector3(coords.x, coords.y, z), bloodType)
end

AddEventHandler('gameEventTriggered', function(name, args)
    if name ~= 'CEventNetworkEntityDamage' then
        return
    end

    if type(args) ~= 'table' or type(args[1]) ~= 'number' then
        return
    end

    local victimPed = args[1]
    if not DoesEntityExist(victimPed) or not IsPedAPlayer(victimPed) then
        return
    end

    local config = EvidenceTypes.GetType('blood')
    if not config then
        return
    end

    local chance = tonumber(config.generation and config.generation.chance) or 1.0
    if chance < 1.0 and math.random() > chance then
        return
    end

    if not isCrimeContext(victimPed) then
        return
    end

    emitBloodEvidence(victimPed)
end)
