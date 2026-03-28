local EvidenceTypes = require 'shared.evidence_types'
local ClientFn = require 'modules.client.functions'

---@class BloodEvidence
---@field coords { x: number, y: number, z: number }
---@field visibility number

---@class FingerprintEvidence
---@field entityNetId number
---@field entity number|nil
---@field bone string|nil
---@field visibility number
---@field revealed boolean|nil

---@class CasingEvidence
---@field coords { x: number, y: number, z: number }
---@field visibility number

---@type table<string, BloodEvidence>
local ForensicBloodEvidence = {}
---@type table<string, FingerprintEvidence>
local ForensicFingerprintsEvidence = {}
---@type table<string, CasingEvidence>
local ForensicCasingsEvidence = {}

local ForensicTargets = {
    blood = {},
    fingerprints = {},
    casings = {},
}

local ForensicVisuals = {
    blood = {},
    casings = {},
}

---@type number
local CASING_MODEL = joaat('prop_cs_casing_01')
---@type number
local lastFingerprintTargetRefresh = 0

---@param value any
---@return any
local function deepCopy(value)
    if type(value) ~= 'table' then
        return value
    end

    local out = {}
    for key, entry in pairs(value) do
        out[key] = deepCopy(entry)
    end
    return out
end

---@return number
local function getPed()
    return cache.ped or PlayerPedId()
end

---@return boolean
local function isOxTargetReady()
    return GetResourceState('ox_target') == 'started'
end

---@param toolName string
---@return boolean
local function hasTool(toolName)
    if GetResourceState('ox_inventory') ~= 'started' then
        return false
    end

    return exports.ox_inventory:Search('count', toolName) > 0
end

---@param duration number
---@param label string
---@return boolean
local function showProgress(duration, label)
    return lib.progressBar({
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


---@param value any
---@return number
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

---@param input table|nil
---@return table
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

---@param entry FingerprintEvidence|nil
---@return vector3|nil
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

---@param evidenceState { blood?: table<string, BloodEvidence>, fingerprints?: table<string, FingerprintEvidence>, casings?: table<string, CasingEvidence> }|nil
---@return nil
local function applySceneEvidenceState(evidenceState)
    local evidences = type(evidenceState) == 'table' and evidenceState or {}
    ForensicBloodEvidence = cloneEvidenceMap(evidences.blood)
    ForensicFingerprintsEvidence = cloneEvidenceMap(evidences.fingerprints)
    ForensicCasingsEvidence = cloneEvidenceMap(evidences.casings)
end

---@return nil
local function refreshSceneEvidenceFromStateBag()
    local evidenceState = GlobalState and GlobalState.evidences or nil
    applySceneEvidenceState(evidenceState)
end

---@param zoneId any
---@return nil
local function removeTargetZone(zoneId)
    if not zoneId or not isOxTargetReady() then
        return
    end

    exports.ox_target:removeZone(zoneId)
end

---@param entry { zoneId: any }|any
---@return nil
local function removeTargetEntry(entry)
    if type(entry) == 'table' then
        removeTargetZone(entry.zoneId)
        return
    end

    removeTargetZone(entry)
end

---@param targetMap table
---@return nil
local function clearTargetMap(targetMap)
    for evidenceId, entry in pairs(targetMap) do
        removeTargetEntry(entry)
        targetMap[evidenceId] = nil
    end
end

---@param previousCoords vector3|nil
---@param currentCoords vector3|nil
---@param threshold number|nil
---@return boolean
local function coordsChanged(previousCoords, currentCoords, threshold)
    if not previousCoords or not currentCoords then
        return true
    end

    return #(previousCoords - currentCoords) > (threshold or 0.15)
end

---@return nil
local function clearAllTargets()
    clearTargetMap(ForensicTargets.blood)
    clearTargetMap(ForensicTargets.fingerprints)
    clearTargetMap(ForensicTargets.casings)
end

---@param coords vector3
---@param visibility number
---@return number
local function createBloodDecal(coords, visibility)
    local config = EvidenceTypes.GetType('blood')
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

---@param bloodId string
---@return nil
local function removeBloodVisual(bloodId)
    local visual = ForensicVisuals.blood[bloodId]
    if not visual then
        return
    end

    if visual.decal and visual.decal ~= 0 then
        RemoveDecal(visual.decal)
    end

    ForensicVisuals.blood[bloodId] = nil
end

---@param model number
---@param timeoutMs number|nil
---@return boolean
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

---@param casingId string
---@return nil
local function removeCasingVisual(casingId)
    local visual = ForensicVisuals.casings[casingId]
    if not visual then
        return
    end

    if visual.entity and DoesEntityExist(visual.entity) then
        DeleteEntity(visual.entity)
    end

    ForensicVisuals.casings[casingId] = nil
end

---@return nil
local function syncBloodVisuals()
    local evidences = ForensicBloodEvidence or {}

    for bloodId, blood in pairs(evidences) do
        local coords = ClientFn.AsVector3(blood.coords)
        local visibility = clampVisibility(blood.visibility)

        if not coords or visibility <= 0.01 then
            removeBloodVisual(bloodId)
            goto continue
        end

        local bucket = math.floor(visibility * 10 + 0.5)
        local visual = ForensicVisuals.blood[bloodId]
        if not visual or visual.bucket ~= bucket then
            removeBloodVisual(bloodId)
            ForensicVisuals.blood[bloodId] = {
                decal = createBloodDecal(coords, visibility),
                bucket = bucket,
            }
        end

        ::continue::
    end

    for bloodId in pairs(ForensicVisuals.blood) do
        if not evidences[bloodId] then
            removeBloodVisual(bloodId)
        end
    end
end

---@return nil
local function syncCasingVisuals()
    local evidences = ForensicCasingsEvidence or {}

    for casingId, casing in pairs(evidences) do
        local coords = ClientFn.AsVector3(casing.coords)
        local visibility = clampVisibility(casing.visibility)

        if not coords or visibility <= 0.01 then
            removeCasingVisual(casingId)
            goto continue
        end

        local visual = ForensicVisuals.casings[casingId]
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

            ForensicVisuals.casings[casingId] = visual
            SetModelAsNoLongerNeeded(CASING_MODEL)
        end

        if visual.entity and DoesEntityExist(visual.entity) then
            local alpha = math.max(35, math.floor(visibility * 255))
            SetEntityAlpha(visual.entity, alpha, false)
        end

        ::continue::
    end

    for casingId in pairs(ForensicVisuals.casings) do
        if not evidences[casingId] then
            removeCasingVisual(casingId)
        end
    end
end

---@return nil
local function clearAllVisuals()
    for bloodId in pairs(ForensicVisuals.blood) do
        removeBloodVisual(bloodId)
    end

    for casingId in pairs(ForensicVisuals.casings) do
        removeCasingVisual(casingId)
    end
end

---@param bloodId string
---@param blood BloodEvidence
---@return nil
local function createBloodTarget(bloodId, blood)
    if not isOxTargetReady() then
        return
    end

    local coords = ClientFn.AsVector3(blood.coords)
    if not coords or clampVisibility(blood.visibility) <= 0.01 then
        return
    end

    local config = EvidenceTypes.GetType('blood')
    if not config then
        return
    end

    ForensicTargets.blood[bloodId] = {
        zoneId = exports.ox_target:addSphereZone({
            coords = coords,
            radius = 1.0,
            debug = false,
            options = {
                {
                    icon = config.icon,
                    label = 'Collect Blood Sample',
                    canInteract = function()
                        return hasTool(config.requiredTool)
                    end,
                    onSelect = function()
                        local completed = showProgress(5000, 'Collecting blood sample...')
                        if not completed then
                            return
                        end

                        TriggerServerEvent('cad:forensic:collect', 'blood', bloodId)
                    end,
                },
                {
                    icon = 'fa-broom',
                    label = 'Clean Blood',
                    canInteract = function()
                        return hasTool('hydrogen_peroxide')
                    end,
                    onSelect = function()
                        local completed = showProgress(3000, 'Cleaning blood...')
                        if not completed then
                            return
                        end

                        TriggerServerEvent('cad:forensic:destroy', 'blood', bloodId)
                    end,
                },
            },
        }),
    }
end

---@param fpId string
---@param fingerprint FingerprintEvidence
---@param coords vector3
---@return nil
local function createFingerprintTarget(fpId, fingerprint, coords)
    if not isOxTargetReady() then
        return
    end

    local config = EvidenceTypes.GetType('fingerprint')
    if not config or not coords or clampVisibility(fingerprint.visibility) <= 0.01 then
        return
    end

    ForensicTargets.fingerprints[fpId] = {
        zoneId = exports.ox_target:addBoxZone({
            coords = coords,
            size = vec3(0.5, 0.5, 0.5),
            rotation = 0.0,
            debug = false,
            options = {
                {
                    icon = 'fa-magnifying-glass',
                    label = 'Dust for Fingerprints',
                    canInteract = function()
                        local current = ForensicFingerprintsEvidence[fpId]
                        return current ~= nil and current.revealed ~= true and hasTool(config.revealTool)
                    end,
                    onSelect = function()
                        local completed = showProgress(5000, 'Dusting surface...')
                        if not completed then
                            return
                        end

                        TriggerServerEvent('cad:forensic:reveal', 'fingerprint', fpId)
                    end,
                },
                {
                    icon = config.icon,
                    label = 'Lift Fingerprint',
                    canInteract = function()
                        local current = ForensicFingerprintsEvidence[fpId]
                        return current ~= nil and current.revealed == true and hasTool(config.requiredTool)
                    end,
                    onSelect = function()
                        local completed = showProgress(8000, 'Lifting fingerprint...')
                        if not completed then
                            return
                        end

                        TriggerServerEvent('cad:forensic:collect', 'fingerprint', fpId)
                    end,
                },
            },
        }),
        coords = coords,
    }
end

---@param casingId string
---@param casing CasingEvidence
---@return nil
local function createCasingTarget(casingId, casing)
    if not isOxTargetReady() then
        return
    end

    local coords = ClientFn.AsVector3(casing.coords)
    if not coords or clampVisibility(casing.visibility) <= 0.01 then
        return
    end

    local config = EvidenceTypes.GetType('casing')
    if not config then
        return
    end

    ForensicTargets.casings[casingId] = {
        zoneId = exports.ox_target:addSphereZone({
            coords = coords,
            radius = 0.5,
            debug = false,
            options = {
                {
                    icon = config.icon,
                    label = 'Collect Casing',
                    canInteract = function()
                        return hasTool(config.requiredTool)
                    end,
                    onSelect = function()
                        local completed = showProgress(3000, 'Collecting casing...')
                        if not completed then
                            return
                        end

                        TriggerServerEvent('cad:forensic:collect', 'casing', casingId)
                    end,
                },
            },
        }),
    }
end

---@return nil
local function rebuildBloodTargets()
    clearTargetMap(ForensicTargets.blood)

    if not isOxTargetReady() then
        return
    end

    for bloodId, blood in pairs(ForensicBloodEvidence or {}) do
        createBloodTarget(bloodId, blood)
    end
end

---@return nil
local function rebuildCasingTargets()
    clearTargetMap(ForensicTargets.casings)

    if not isOxTargetReady() then
        return
    end

    for casingId, casing in pairs(ForensicCasingsEvidence or {}) do
        createCasingTarget(casingId, casing)
    end
end

---@param force boolean
---@return nil
local function refreshFingerprintTargets(force)
    if not isOxTargetReady() then
        clearTargetMap(ForensicTargets.fingerprints)
        return
    end

    for fpId, entry in pairs(ForensicTargets.fingerprints) do
        if not ForensicFingerprintsEvidence[fpId] then
            removeTargetEntry(entry)
            ForensicTargets.fingerprints[fpId] = nil
        end
    end

    for fpId, fingerprint in pairs(ForensicFingerprintsEvidence or {}) do
        local coords = getFingerprintCoords(fingerprint)
        local visibility = clampVisibility(fingerprint.visibility)
        local entry = ForensicTargets.fingerprints[fpId]

        if not coords or visibility <= 0.01 then
            if entry then
                removeTargetEntry(entry)
                ForensicTargets.fingerprints[fpId] = nil
            end
        elseif force or not entry or coordsChanged(entry.coords, coords, 0.2) then
            if entry then
                removeTargetEntry(entry)
                ForensicTargets.fingerprints[fpId] = nil
            end

            createFingerprintTarget(fpId, fingerprint, coords)
        end
    end
end

---@return boolean
local function drawFingerprintMarkers()
    local ped = getPed()
    if not ped or ped == 0 then
        return false
    end

    local drawn = false
    local pedCoords = GetEntityCoords(ped)
    for _, fingerprint in pairs(ForensicFingerprintsEvidence or {}) do
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

---@return nil
local function reconcileSceneEvidence()
    syncBloodVisuals()
    syncCasingVisuals()

    if not isOxTargetReady() then
        clearAllTargets()
        return
    end

    rebuildBloodTargets()
    rebuildCasingTargets()
    refreshFingerprintTargets(true)
    lastFingerprintTargetRefresh = GetGameTimer()
end

if type(AddStateBagChangeHandler) == 'function' then
    AddStateBagChangeHandler('evidences', nil, function(bagName, key, value)
        if bagName ~= 'global' or key ~= 'evidences' then
            return
        end

        applySceneEvidenceState(value)
        reconcileSceneEvidence()
    end)
else
    print('[CAD] AddStateBagChangeHandler unavailable; forensic scene evidence sync disabled')
end

CreateThread(function()
    Wait(500)
    refreshSceneEvidenceFromStateBag()
    reconcileSceneEvidence()
end)

CreateThread(function()
    while true do
        if next(ForensicFingerprintsEvidence or {}) == nil then
            Wait(1000)
        else
            local now = GetGameTimer()
            if now - lastFingerprintTargetRefresh >= 1000 then
                refreshFingerprintTargets(false)
                lastFingerprintTargetRefresh = now
            end

            local drawn = drawFingerprintMarkers()
            Wait(drawn and 0 or 350)
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    clearAllTargets()
    clearAllVisuals()
end)
