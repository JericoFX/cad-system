--[[
CAD Forensic - Target Interaction System
Handles ox_target interactions for evidence collection and examination
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Targets = {
    blood = {},
    fingerprints = {},
    casings = {}
}

-- Helper to check if player has required tool
local function hasTool(toolName)
    return exports.ox_inventory:Search('count', toolName) > 0
end

-- Helper to play progress bar
local function showProgress(duration, label)
    lib.progressBar({
        duration = duration,
        label = label,
        useWhileDead = false,
        canCancel = true,
        disable = {
            car = true,
            move = true,
            combat = true
        },
        anim = {
            dict = 'amb@prop_human_parking_meter@interact',
            clip = 'idle_a'
        }
    })
end

-- Blood target handlers
local function setupBloodTargets()
    for bloodId, blood in pairs(CAD.Forensic.Blood.Evidence or {}) do
        if CAD.Forensic.Targets.blood[bloodId] then goto continue end

        local config = CAD.EvidenceTypes.GetType('blood')
        local distance = #(GetEntityCoords(PlayerPedId()) - blood.coords)

        if distance > 2.0 then goto continue end

        local options = {}

        -- Collect option
        if hasTool(config.requiredTool) then
            table.insert(options, {
                icon = config.icon,
                label = 'Collect Blood Sample',
                onSelect = function()
                    showProgress(5000, 'Collecting blood sample...')
                    TriggerServerEvent('cad:forensic:collect', 'blood', bloodId)
                end
            })
        end

        -- Clean option
        if hasTool('hydrogen_peroxide') then
            table.insert(options, {
                icon = 'fa-broom',
                label = 'Clean Blood',
                onSelect = function()
                    showProgress(3000, 'Cleaning blood...')
                    TriggerServerEvent('cad:forensic:destroy', 'blood', bloodId)
                end
            })
        end

        if #options > 0 then
            CAD.Forensic.Targets.blood[bloodId] = ox_target:addSphereZone({
                coords = blood.coords,
                radius = 1.0,
                debug = false,
                options = options
            })
        end

        ::continue::
    end
end

-- Fingerprint target handlers
local function setupFingerprintTargets()
    for fpId, fp in pairs(CAD.Forensic.Fingerprints.Evidence or {}) do
        if CAD.Forensic.Targets.fingerprints[fpId] then goto continue end

        local entity = NetworkGetEntityFromNetworkId(fp.entity)
        if not DoesEntityExist(entity) then goto continue end

        local boneIndex = GetEntityBoneIndexByName(entity, fp.bone)
        if boneIndex == -1 then goto continue end

        local coords = GetWorldPositionOfEntityBone(entity, boneIndex)
        local distance = #(GetEntityCoords(PlayerPedId()) - coords)

        if distance > 1.5 then goto continue end

        local config = CAD.EvidenceTypes.GetType('fingerprint')
        local options = {}

        -- Reveal option
        if hasTool(config.revealTool) and not fp.revealed then
            table.insert(options, {
                icon = 'fa-magnifying-glass',
                label = 'Dust for Fingerprints',
                onSelect = function()
                    showProgress(5000, 'Dusting surface...')
                    TriggerServerEvent('cad:forensic:reveal', 'fingerprint', fpId)
                end
            })
        end

        -- Collect option
        if hasTool(config.requiredTool) and fp.revealed then
            table.insert(options, {
                icon = config.icon,
                label = 'Lift Fingerprint',
                onSelect = function()
                    showProgress(8000, 'Lifting fingerprint...')
                    TriggerServerEvent('cad:forensic:collect', 'fingerprint', fpId)
                end
            })
        end

        if #options > 0 then
            CAD.Forensic.Targets.fingerprints[fpId] = ox_target:addBoxZone({
                coords = coords,
                size = vec3(0.5, 0.5, 0.5),
                rotation = GetEntityRotation(entity, 2),
                debug = false,
                options = options
            })
        end

        ::continue::
    end
end

-- Casing target handlers
local function setupCasingTargets()
    for casingId, casing in pairs(CAD.Forensic.Casings.Evidence or {}) do
        if CAD.Forensic.Targets.casings[casingId] then goto continue end

        local coords = GetEntityCoords(casing.entity)
        local distance = #(GetEntityCoords(PlayerPedId()) - coords)
        if distance > 1.0 then goto continue end

        local config = CAD.EvidenceTypes.GetType('casing')
        if hasTool(config.requiredTool) then
            CAD.Forensic.Targets.casings[casingId] = ox_target:addSphereZone({
                coords = coords,
                radius = 0.5,
                debug = false,
                options = {
                    {
                        icon = config.icon,
                        label = 'Collect Casing',
                        onSelect = function()
                            showProgress(3000, 'Collecting casing...')
                            TriggerServerEvent('cad:forensic:collect', 'casing', casingId)
                        end
                    }
                }
            })
        end

        ::continue::
    end
end

-- Main target update loop
CreateThread(function()
    while true do
        Wait(1000)

        -- Clean up removed targets
        for bloodId, target in pairs(CAD.Forensic.Targets.blood) do
            if not CAD.Forensic.Blood.Evidence[bloodId] then
                ox_target:removeZone(target)
                CAD.Forensic.Targets.blood[bloodId] = nil
            end
        end

        for fpId, target in pairs(CAD.Forensic.Targets.fingerprints) do
            if not CAD.Forensic.Fingerprints.Evidence[fpId] then
                ox_target:removeZone(target)
                CAD.Forensic.Targets.fingerprints[fpId] = nil
            end
        end

        for casingId, target in pairs(CAD.Forensic.Targets.casings) do
            if not CAD.Forensic.Casings.Evidence[casingId] then
                ox_target:removeZone(target)
                CAD.Forensic.Targets.casings[casingId] = nil
            end
        end

        -- Setup new targets
        setupBloodTargets()
        setupFingerprintTargets()
        setupCasingTargets()
    end
end)

-- Handle evidence updates from server
RegisterNetEvent('cad:forensic:decay:blood', function(blood)
    if blood.visibility <= 0 and blood.quality <= 0 then
        CAD.Forensic.Blood.Evidence[blood.id] = nil
    else
        CAD.Forensic.Blood.Evidence[blood.id] = blood
    end
end)

RegisterNetEvent('cad:forensic:decay:fingerprint', function(fp)
    CAD.Forensic.Fingerprints.Evidence[fp.id] = fp
end)

RegisterNetEvent('cad:forensic:decay:casing', function(casing)
    if casing.visibility <= 0 and casing.quality <= 0 then
        CAD.Forensic.Casings.Evidence[casing.id] = nil
    else
        CAD.Forensic.Casings.Evidence[casing.id] = casing
    end
end)