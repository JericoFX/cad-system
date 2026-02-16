--[[
CAD Forensic - Bullet Casing System
Generates casings from gunfire during active crimes
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Casings = {}

local function isCrimeContext()
    local calls = CAD.State.Dispatch.Calls or {}
    for _, call in ipairs(calls) do
        if call.status == 'ACTIVE' then return true end
    end
    return false
end

local function createCasing(coords)
    local model = "prop_cs_casing_01"
    RequestModel(model)
    while not HasModelLoaded(model) do Wait(0) end

    local casing = CreateObjectNoOffset(model, coords.x, coords.y, coords.z, true, true, false)
    PlaceObjectOnGroundProperly(casing)

    SetEntityHeading(casing, GetEntityHeading(PlayerPedId()))
    FreezeEntityPosition(casing, true)

    local evidence = {
        id = 'CASING_' .. math.random(1000000),
        type = 'casing',
        entity = casing,
        coords = coords,
        createdAt = os.time(),
        quality = 100
    }
    CAD.Forensic.Casings.Evidence[evidence.id] = evidence
    TriggerServerEvent('cad:forensic:sync', 'casing', PlayerId(), coords)
    return evidence
end

AddEventHandler('gameEventTriggered', function(name, args)
    if name ~= 'CEventGunShot' or #args < 1 then return end

    local shooterPed = args[1]
    if NetworkGetPlayerIndexFromPed(shooterPed) ~= PlayerId() then return end
    if not isCrimeContext() then return end

    local config = CAD.EvidenceTypes.GetType('casing')
    if math.random() > config.generation.chance then return end

    local forward = GetEntityForwardVector(shooterPed)
    local right = vector3(-forward.y, forward.x, 0.0)
    local offset = (forward * -0.5) + (right * 0.2)
    local coords = GetOffsetFromEntityInWorldCoords(shooterPed, offset.x, offset.y, -0.5)

    createCasing(coords)
end)

-- Initialize
CAD.Forensic.Casings.Evidence = {}

-- Cleanup expired casings
CreateThread(function()
    while true do
        local now = os.time()
        local config = CAD.EvidenceTypes.GetType('casing')
        
        for id, evidence in pairs(CAD.Forensic.Casings.Evidence) do
            local age = now - evidence.createdAt
            if age > config.decay.visibilityHalfLife * 2 then
                DeleteEntity(evidence.entity)
                CAD.Forensic.Casings.Evidence[id] = nil
            end
        end
        Wait(5000)
    end
end)