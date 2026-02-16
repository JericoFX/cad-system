--[[
CAD Forensic - State Synchronization
Handles evidence state bag management and cross-client synchronization
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Sync = {}

-- Initialize state bags
CreateThread(function()
    while true do
        Wait(1000)
        
        -- Register state bags for evidence tracking
        if not GlobalState.evidences then
            GlobalState:set('evidences', {
                blood = {},
                fingerprints = {},
                casings = {}
            }, true)
        end
    end
end)

-- Sync handler
RegisterNetEvent('cad:forensic:sync', function(evidenceType, ownerId, ...)
    local src = source
    local officer = CAD.Auth.GetOfficerData(src)
    if not officer then return end

    -- Validate evidence type
    local evidenceConfig = CAD.EvidenceTypes.GetType(evidenceType)
    if not evidenceConfig then return end

    -- Server-side crime context validation
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

    -- Process evidence based on type
    if evidenceType == 'blood' then
        local coords, bloodType = ...
        local bloodId = 'BLOOD_' .. math.random(1000000)
        
        GlobalState.evidences.blood[bloodId] = {
            id = bloodId,
            type = 'blood',
            coords = coords,
            bloodType = bloodType,
            createdAt = os.time(),
            quality = 100,
            ownerId = ownerId
        }

        
        -- Notify nearby players
        TriggerClientEvent('cad:forensic:sync:blood', -1, GlobalState.evidences.blood[bloodId])

        
    elseif evidenceType == 'fingerprint' then
        local entityNetId, boneName, surfaceType = ...
        local fpId = 'FP_' .. math.random(1000000)
        
        GlobalState.evidences.fingerprints[fpId] = {
            id = fpId,
            type = 'fingerprint',
            entityNetId = entityNetId,
            bone = boneName,
            surface = surfaceType,
            createdAt = os.time(),
            quality = 100,
            ownerId = ownerId
        }
        
        -- Notify vehicle occupants
        local entity = NetworkGetEntityFromNetworkId(entityNetId)
        if DoesEntityExist(entity) then
            local occupants = {}
            for seat = -1, 5 do
                local ped = GetPedInVehicleSeat(entity, seat)
                if DoesEntityExist(ped) then
                    table.insert(occupants, NetworkGetPlayerIndexFromPed(ped))
                end
            end
            TriggerClientEvent('cad:forensic:sync:fingerprint', occupants, GlobalState.evidences.fingerprints[fpId])
        end
        
    elseif evidenceType == 'casing' then
        local coords = ...
        local casingId = 'CASING_' .. math.random(1000000)
        
        GlobalState.evidences.casings[casingId] = {
            id = casingId,
            type = 'casing',
            coords = coords,
            createdAt = os.time(),
            quality = 100,
            ownerId = ownerId
        }
        
        -- Notify nearby players
        TriggerClientEvent('cad:forensic:sync:casing', -1, GlobalState.evidences.casings[casingId])
    end
end)

-- API for clients to request evidence
lib.callback.register('cad:forensic:getEvidence', function(source)
    return {
        blood = GlobalState.evidences.blood or {},
        fingerprints = GlobalState.evidences.fingerprints or {},
        casings = GlobalState.evidences.casings or {}
    }
end)
