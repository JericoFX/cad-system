--[[
CAD Forensic - Blood Evidence System
Generates blood decals from damage events during active crimes
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Blood = {}

local function getGroundZ(x, y)
    local z = 0.0
    local groundFound = false
    for i = 0, 1000, 10 do
        z = i
        groundFound = IsPointOnGround(x, y, z)
        if groundFound then break end
    end
    return z
end

local function isCrimeContext(victimPed)
    local victimId = NetworkGetPlayerIndexFromPed(victimPed)
    if not victimId or victimId == -1 then return false end

    -- Check if victim is involved in active dispatch call
    local calls = CAD.State.Dispatch.Calls or {}
    for _, call in ipairs(calls) do
        if call.status == 'ACTIVE' and call.subjects then
            for _, subject in ipairs(call.subjects) do
                if subject.id == GetPlayerServerId(victimId) then
                    return true
                end
            end
        end
    end

    -- Check if victim is wanted
    local officerData = CAD.Auth.GetOfficerData(PlayerId())
    if officerData and officerData.wantedList then
        for _, wanted in ipairs(officerData.wantedList) do
            if wanted.citizenId == GetPlayerServerId(victimId) then
                return true
            end
        end
    end

    return false
end

local function createBloodDecal(coords, bloodType)
    local decalType = CAD.EvidenceTypes.GetType('blood').visualization.decalType
    local decal = AddDecal(
        decalType,
        coords.x, coords.y, coords.z,
        0.0, 0.0, -1.0,
        0.0, 0.0, 0.0,
        1.0, 1.0, 0.0,
        255, 0, 0, 200,
        false, false, false, 0.0
    )
    
    local evidence = {
        id = 'BLOOD_' .. math.random(1000000),
        type = 'blood',
        coords = coords,
        decal = decal,
        bloodType = bloodType,
        createdAt = os.time(),
        quality = 100
    }

    CAD.Forensic.Blood.Evidence[evidence.id] = evidence
    return evidence
end

local function handleBloodEvidence(damageEvent)
    local victimPed = damageEvent:GetEntityAffected()
    if not DoesEntityExist(victimPed) or not IsPedAPlayer(victimPed) then return end

    local damage = damageEvent:GetDamageAmount()
    local bloodConfig = CAD.EvidenceTypes.GetType('blood')
    if damage < bloodConfig.generation.minDamage then return end

    if not isCrimeContext(victimPed) then return end

    local coords = GetEntityCoords(victimPed)
    coords.z = getGroundZ(coords.x, coords.y)

    local bloodType = CAD.EvidenceTypes.GetRandomBloodType()
    createBloodDecal(coords, bloodType)

    TriggerServerEvent('cad:forensic:sync', 'blood', NetworkGetPlayerIndexFromPed(victimPed), coords, bloodType)
end

-- Initialize
CAD.Forensic.Blood.Evidence = {}

AddEventHandler('gameEventTriggered', function(name, args)
    if name == 'CEventNetworkEntityDamage' and #args >= 1 then
        local damageEvent = args[1]
        handleBloodEvidence(damageEvent)
    end
end)

-- Cleanup expired evidence
CreateThread(function()
    while true do
        local now = os.time()
        for id, evidence in pairs(CAD.Forensic.Blood.Evidence) do
            local age = now - evidence.createdAt
            local config = CAD.EvidenceTypes.GetType('blood')
            
            -- Visibility decay
            if age > config.decay.visibilityHalfLife then
                RemoveDecal(evidence.decal)
                CAD.Forensic.Blood.Evidence[id] = nil
            end
        end
        Wait(5000)
    end
end)
