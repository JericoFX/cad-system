local State = require 'modules.shared.state'
local EvidenceTypes = require 'shared.evidence_types'

local lastEmitAt = 0

local function getPed()
    return cache.ped or PlayerPedId()
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

local function emitCasingEvidence(shooterPed)
    local now = GetGameTimer()
    if now - lastEmitAt < 250 then
        return
    end
    lastEmitAt = now

    local forward = GetEntityForwardVector(shooterPed)
    local right = vector3(-forward.y, forward.x, 0.0)
    local offset = (forward * -0.5) + (right * 0.2)
    local coords = GetOffsetFromEntityInWorldCoords(shooterPed, offset.x, offset.y, -0.5)

    local ownerId = GetPlayerServerId(PlayerId())
    TriggerServerEvent('cad:forensic:sync', 'casing', ownerId, vector3(coords.x, coords.y, coords.z))
end

AddEventHandler('gameEventTriggered', function(name, args)
    if name ~= 'CEventGunShot' then
        return
    end

    local ped = getPed()
    if not ped or ped == 0 then
        return
    end

    if type(args) ~= 'table' or type(args[1]) ~= 'number' then
        return
    end

    local shooterPed = args[1]
    if shooterPed ~= ped then
        return
    end

    if not isCrimeContext() then
        return
    end

    local config = EvidenceTypes.GetType('casing')
    if not config then
        return
    end

    local chance = tonumber(config.generation and config.generation.chance) or 1.0
    if chance < 1.0 and math.random() > chance then
        return
    end

    emitCasingEvidence(shooterPed)
end)
