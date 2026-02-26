CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}

CAD.Forensic.Blood = CAD.Forensic.Blood or {}
CAD.Forensic.Fingerprints = CAD.Forensic.Fingerprints or {}
CAD.Forensic.Casings = CAD.Forensic.Casings or {}

CAD.Forensic.Blood.Evidence = CAD.Forensic.Blood.Evidence or {}
CAD.Forensic.Fingerprints.Evidence = CAD.Forensic.Fingerprints.Evidence or {}
CAD.Forensic.Casings.Evidence = CAD.Forensic.Casings.Evidence or {}

CAD.Forensic.Targets = CAD.Forensic.Targets or {
    blood = {},
    fingerprints = {},
    casings = {},
}

CAD.Forensic.Visuals = CAD.Forensic.Visuals or {
    blood = {},
    casings = {},
}

local CASING_MODEL = joaat('prop_cs_casing_01')

local function deepCopy(value)
    if CAD.DeepCopy then
        return CAD.DeepCopy(value)
    end

    if type(value) ~= 'table' then
        return value
    end

    local out = {}
    for key, entry in pairs(value) do
        out[key] = deepCopy(entry)
    end
    return out
end

local function getPed()
    return cache.ped or PlayerPedId()
end

local function isOxTargetReady()
    return GetResourceState('ox_target') == 'started'
end

local function hasTool(toolName)
    if GetResourceState('ox_inventory') ~= 'started' then
        return false
    end

    return exports.ox_inventory:Search('count', toolName) > 0
end

local function showProgress(duration, label)
    return CAD.Progress.Run({
        duration = duration,
        label = label,
        useWhileDead = false,
        canCancel = true,
        disable = {
            car = true,
            move = true,
            combat = true,
        },
        anim = {
            dict = 'amb@prop_human_parking_meter@interact',
            clip = 'idle_a',
        },
    })
end

local function asVector3Coords(value)
    if type(value) == 'vector3' then
        return value
    end

    if type(value) ~= 'table' then
        return nil
    end

    local x = tonumber(value.x)
    local y = tonumber(value.y)
    local z = tonumber(value.z)
    if not x or not y or not z then
        return nil
    end

    return vector3(x, y, z)
end

local function clampVisibility(value)
    local visibility = tonumber(value) or 1.0
    if visibility < 0.0 then
        return 0.0
    end
    if visibility > 1.0 then
        return 1.0
    end
    return visibility
end

local function cloneEvidenceMap(input)
    if type(input) ~= 'table' then
        return {}
    end

    local out = {}
    for key, entry in pairs(input) do
        out[key] = deepCopy(entry)
    end
    return out
end

local function getFingerprintCoords(entry)
    local entityNetId = tonumber(entry and (entry.entityNetId or entry.entity))
    if not entityNetId or entityNetId <= 0 then
        return nil
    end

    if not NetworkDoesNetworkIdExist(entityNetId) then
        return nil
    end

    local entity = NetworkGetEntityFromNetworkId(entityNetId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then
        return nil
    end

    local boneName = type(entry.bone) == 'string' and entry.bone or ''
    if boneName ~= '' then
        local boneIndex = GetEntityBoneIndexByName(entity, boneName)
        if boneIndex and boneIndex ~= -1 then
            return GetWorldPositionOfEntityBone(entity, boneIndex)
        end
    end

    return GetEntityCoords(entity)
end

local function applySceneEvidenceState(state)
    local evidences = type(state) == 'table' and state or {}
    CAD.Forensic.Blood.Evidence = cloneEvidenceMap(evidences.blood)
    CAD.Forensic.Fingerprints.Evidence = cloneEvidenceMap(evidences.fingerprints)
    CAD.Forensic.Casings.Evidence = cloneEvidenceMap(evidences.casings)
end

local function refreshSceneEvidenceFromStateBag()
    local state = GlobalState and GlobalState.evidences or nil
    applySceneEvidenceState(state)
end

local function removeTargetZone(zoneId)
    if not zoneId or not isOxTargetReady() then
        return
    end

    exports.ox_target:removeZone(zoneId)
end

local function clearAllTargets()
    for bloodId, zoneId in pairs(CAD.Forensic.Targets.blood) do
        removeTargetZone(zoneId)
        CAD.Forensic.Targets.blood[bloodId] = nil
    end

    for fpId, zoneId in pairs(CAD.Forensic.Targets.fingerprints) do
        removeTargetZone(zoneId)
        CAD.Forensic.Targets.fingerprints[fpId] = nil
    end

    for casingId, zoneId in pairs(CAD.Forensic.Targets.casings) do
        removeTargetZone(zoneId)
        CAD.Forensic.Targets.casings[casingId] = nil
    end
end

local function createBloodDecal(coords, visibility)
    local config = CAD.EvidenceTypes.GetType('blood')
    local decalType = config and config.visualization and tonumber(config.visualization.decalType) or 1010
    local alpha = math.max(40, math.floor(clampVisibility(visibility) * 220))

    return AddDecal(
        decalType,
        coords.x,
        coords.y,
        coords.z + 0.02,
        0.0,
        0.0,
        -1.0,
        0.0,
        0.0,
        0.0,
        0.45,
        0.45,
        0.0,
        175,
        0,
        0,
        alpha,
        false,
        false,
        false,
        0.0
    )
end

local function removeBloodVisual(bloodId)
    local visual = CAD.Forensic.Visuals.blood[bloodId]
    if not visual then
        return
    end

    if visual.decal and visual.decal ~= 0 then
        RemoveDecal(visual.decal)
    end

    CAD.Forensic.Visuals.blood[bloodId] = nil
end

local function requestModel(model, timeoutMs)
    if HasModelLoaded(model) then
        return true
    end

    RequestModel(model)

    local deadline = GetGameTimer() + (timeoutMs or 2000)
    while not HasModelLoaded(model) and GetGameTimer() < deadline do
        Wait(0)
    end

    return HasModelLoaded(model)
end

local function removeCasingVisual(casingId)
    local visual = CAD.Forensic.Visuals.casings[casingId]
    if not visual then
        return
    end

    if visual.entity and DoesEntityExist(visual.entity) then
        DeleteEntity(visual.entity)
    end

    CAD.Forensic.Visuals.casings[casingId] = nil
end

local function syncBloodVisuals()
    local evidences = CAD.Forensic.Blood.Evidence or {}

    for bloodId, blood in pairs(evidences) do
        local coords = asVector3Coords(blood.coords)
        local visibility = clampVisibility(blood.visibility)

        if not coords or visibility <= 0.01 then
            removeBloodVisual(bloodId)
            goto continue
        end

        local bucket = math.floor(visibility * 10 + 0.5)
        local visual = CAD.Forensic.Visuals.blood[bloodId]
        if not visual or visual.bucket ~= bucket then
            removeBloodVisual(bloodId)
            CAD.Forensic.Visuals.blood[bloodId] = {
                decal = createBloodDecal(coords, visibility),
                bucket = bucket,
            }
        end

        ::continue::
    end

    for bloodId in pairs(CAD.Forensic.Visuals.blood) do
        if not evidences[bloodId] then
            removeBloodVisual(bloodId)
        end
    end
end

local function syncCasingVisuals()
    local evidences = CAD.Forensic.Casings.Evidence or {}

    for casingId, casing in pairs(evidences) do
        local coords = asVector3Coords(casing.coords)
        local visibility = clampVisibility(casing.visibility)

        if not coords or visibility <= 0.01 then
            removeCasingVisual(casingId)
            goto continue
        end

        local visual = CAD.Forensic.Visuals.casings[casingId]
        if not visual then
            if not requestModel(CASING_MODEL, 1800) then
                goto continue
            end

            local entity = CreateObjectNoOffset(CASING_MODEL, coords.x, coords.y, coords.z, false, false, false)
            if not entity or entity == 0 then
                goto continue
            end

            PlaceObjectOnGroundProperly(entity)
            FreezeEntityPosition(entity, true)
            SetEntityCollision(entity, false, false)
            SetEntityInvincible(entity, true)

            visual = {
                entity = entity,
            }

            CAD.Forensic.Visuals.casings[casingId] = visual
            SetModelAsNoLongerNeeded(CASING_MODEL)
        end

        if visual.entity and DoesEntityExist(visual.entity) then
            local alpha = math.max(35, math.floor(visibility * 255))
            SetEntityAlpha(visual.entity, alpha, false)
        end

        ::continue::
    end

    for casingId in pairs(CAD.Forensic.Visuals.casings) do
        if not evidences[casingId] then
            removeCasingVisual(casingId)
        end
    end
end

local function clearAllVisuals()
    for bloodId in pairs(CAD.Forensic.Visuals.blood) do
        removeBloodVisual(bloodId)
    end

    for casingId in pairs(CAD.Forensic.Visuals.casings) do
        removeCasingVisual(casingId)
    end
end

local function setupBloodTargets()
    if not isOxTargetReady() then
        return
    end

    local ped = getPed()
    if not ped or ped == 0 then
        return
    end

    local pedCoords = GetEntityCoords(ped)
    for bloodId, blood in pairs(CAD.Forensic.Blood.Evidence or {}) do
        if CAD.Forensic.Targets.blood[bloodId] then
            goto continue
        end

        local coords = asVector3Coords(blood.coords)
        if not coords then
            goto continue
        end

        local visibility = clampVisibility(blood.visibility)
        if visibility <= 0.01 then
            goto continue
        end

        if #(pedCoords - coords) > 2.0 then
            goto continue
        end

        local config = CAD.EvidenceTypes.GetType('blood')
        if not config then
            goto continue
        end

        local options = {}

        if hasTool(config.requiredTool) then
            options[#options + 1] = {
                icon = config.icon,
                label = 'Collect Blood Sample',
                onSelect = function()
                    local completed = showProgress(5000, 'Collecting blood sample...')
                    if not completed then
                        return
                    end

                    TriggerServerEvent('cad:forensic:collect', 'blood', bloodId)
                end,
            }
        end

        if hasTool('hydrogen_peroxide') then
            options[#options + 1] = {
                icon = 'fa-broom',
                label = 'Clean Blood',
                onSelect = function()
                    local completed = showProgress(3000, 'Cleaning blood...')
                    if not completed then
                        return
                    end

                    TriggerServerEvent('cad:forensic:destroy', 'blood', bloodId)
                end,
            }
        end

        if #options > 0 then
            CAD.Forensic.Targets.blood[bloodId] = exports.ox_target:addSphereZone({
                coords = coords,
                radius = 1.0,
                debug = false,
                options = options,
            })
        end

        ::continue::
    end
end

local function setupFingerprintTargets()
    if not isOxTargetReady() then
        return
    end

    local ped = getPed()
    if not ped or ped == 0 then
        return
    end

    local pedCoords = GetEntityCoords(ped)
    for fpId, fingerprint in pairs(CAD.Forensic.Fingerprints.Evidence or {}) do
        if CAD.Forensic.Targets.fingerprints[fpId] then
            goto continue
        end

        local coords = getFingerprintCoords(fingerprint)
        if not coords then
            goto continue
        end

        local visibility = clampVisibility(fingerprint.visibility)
        if visibility <= 0.01 then
            goto continue
        end

        if #(pedCoords - coords) > 1.5 then
            goto continue
        end

        local config = CAD.EvidenceTypes.GetType('fingerprint')
        if not config then
            goto continue
        end

        local options = {}
        if hasTool(config.revealTool) and not fingerprint.revealed then
            options[#options + 1] = {
                icon = 'fa-magnifying-glass',
                label = 'Dust for Fingerprints',
                onSelect = function()
                    local completed = showProgress(5000, 'Dusting surface...')
                    if not completed then
                        return
                    end

                    TriggerServerEvent('cad:forensic:reveal', 'fingerprint', fpId)
                end,
            }
        end

        if hasTool(config.requiredTool) and fingerprint.revealed then
            options[#options + 1] = {
                icon = config.icon,
                label = 'Lift Fingerprint',
                onSelect = function()
                    local completed = showProgress(8000, 'Lifting fingerprint...')
                    if not completed then
                        return
                    end

                    TriggerServerEvent('cad:forensic:collect', 'fingerprint', fpId)
                end,
            }
        end

        if #options > 0 then
            CAD.Forensic.Targets.fingerprints[fpId] = exports.ox_target:addBoxZone({
                coords = coords,
                size = vec3(0.5, 0.5, 0.5),
                rotation = 0.0,
                debug = false,
                options = options,
            })
        end

        ::continue::
    end
end

local function setupCasingTargets()
    if not isOxTargetReady() then
        return
    end

    local ped = getPed()
    if not ped or ped == 0 then
        return
    end

    local pedCoords = GetEntityCoords(ped)
    for casingId, casing in pairs(CAD.Forensic.Casings.Evidence or {}) do
        if CAD.Forensic.Targets.casings[casingId] then
            goto continue
        end

        local coords = asVector3Coords(casing.coords)
        if not coords then
            goto continue
        end

        local visibility = clampVisibility(casing.visibility)
        if visibility <= 0.01 then
            goto continue
        end

        if #(pedCoords - coords) > 1.0 then
            goto continue
        end

        local config = CAD.EvidenceTypes.GetType('casing')
        if not config or not hasTool(config.requiredTool) then
            goto continue
        end

        CAD.Forensic.Targets.casings[casingId] = exports.ox_target:addSphereZone({
            coords = coords,
            radius = 0.5,
            debug = false,
            options = {
                {
                    icon = config.icon,
                    label = 'Collect Casing',
                    onSelect = function()
                        local completed = showProgress(3000, 'Collecting casing...')
                        if not completed then
                            return
                        end

                        TriggerServerEvent('cad:forensic:collect', 'casing', casingId)
                    end,
                },
            },
        })

        ::continue::
    end
end

local function cleanupRemovedTargets()
    for bloodId, zoneId in pairs(CAD.Forensic.Targets.blood) do
        if not CAD.Forensic.Blood.Evidence[bloodId] then
            removeTargetZone(zoneId)
            CAD.Forensic.Targets.blood[bloodId] = nil
        end
    end

    for fpId, zoneId in pairs(CAD.Forensic.Targets.fingerprints) do
        if not CAD.Forensic.Fingerprints.Evidence[fpId] then
            removeTargetZone(zoneId)
            CAD.Forensic.Targets.fingerprints[fpId] = nil
        end
    end

    for casingId, zoneId in pairs(CAD.Forensic.Targets.casings) do
        if not CAD.Forensic.Casings.Evidence[casingId] then
            removeTargetZone(zoneId)
            CAD.Forensic.Targets.casings[casingId] = nil
        end
    end
end

local function drawFingerprintMarkers()
    local ped = getPed()
    if not ped or ped == 0 then
        return false
    end

    local drawn = false
    local pedCoords = GetEntityCoords(ped)
    for _, fingerprint in pairs(CAD.Forensic.Fingerprints.Evidence or {}) do
        if fingerprint.revealed == true and clampVisibility(fingerprint.visibility) > 0.01 then
            local coords = getFingerprintCoords(fingerprint)
            if coords then
                local distance = #(pedCoords - coords)
                if distance <= 12.0 then
                    local alpha = math.max(40, math.floor(clampVisibility(fingerprint.visibility) * 220))
                    DrawMarker(
                        2,
                        coords.x,
                        coords.y,
                        coords.z + 0.03,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        0.08,
                        0.08,
                        0.08,
                        60,
                        180,
                        255,
                        alpha,
                        false,
                        true,
                        2,
                        false,
                        nil,
                        nil,
                        false
                    )
                    drawn = true
                end
            end
        end
    end

    return drawn
end

if type(AddStateBagChangeHandler) == 'function' then
    AddStateBagChangeHandler('evidences', nil, function(bagName, key, value)
        if bagName ~= 'global' or key ~= 'evidences' then
            return
        end

        applySceneEvidenceState(value)
    end)
else
    print('[CAD] AddStateBagChangeHandler unavailable; forensic scene evidence sync disabled')
end

CreateThread(function()
    Wait(500)
    refreshSceneEvidenceFromStateBag()
end)

CreateThread(function()
    while true do
        Wait(1000)

        syncBloodVisuals()
        syncCasingVisuals()

        if not isOxTargetReady() then
            clearAllTargets()
            goto continue
        end

        cleanupRemovedTargets()
        setupBloodTargets()
        setupFingerprintTargets()
        setupCasingTargets()

        ::continue::
    end
end)

CreateThread(function()
    while true do
        local drawn = drawFingerprintMarkers()
        Wait(drawn and 0 or 250)
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    clearAllTargets()
    clearAllVisuals()
end)
