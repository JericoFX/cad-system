local Config = require 'modules.shared.config'
local Utils = require 'modules.shared.utils'

local function getAction(name) return _G.CadActions and _G.CadActions[name] end

local Vehicle = {}

---@class CadVehicleQuickLock
---@field plate string
---@field model string
---@field riskLevel 'NONE'|'MEDIUM'|'HIGH'
---@field riskTags string[]
---@field noteHint string|nil
---@field ownerId string|nil
---@field ownerName string|nil
---@field distance number|nil
---@field scannedAt number
---@field stopId string|nil

local POLICE_VEHICLES = {
    police = true,
    police2 = true,
    police3 = true,
    police4 = true,
    policeb = true,
    policet = true,
    sheriff = true,
    sheriff2 = true,
    fbi = true,
    fbi2 = true,
    pranger = true,
    riot = true,
}

local isInPoliceVehicle = false
local tabletOpen = false
local lastScanMs = 0
local radarHidden = false
local cachedSeat = cache.seat
local configuredPoliceModels = nil
local quickDockEnabled = true
---@type CadVehicleQuickLock|nil
local lastQuickLock = nil

local function getVehicleTabletConfig()
    local cfg = Config.Forensics and Config.Forensics.IdReader or {}
    if type(cfg.VehicleTablet) == 'table' then
        return cfg.VehicleTablet
    end
    return {}
end

local function isPoliceVehicle(vehicle)
    if not vehicle or vehicle == 0 then
        return false
    end

    local model = GetEntityModel(vehicle)
    if IsThisModelAPoliceCar and IsThisModelAPoliceCar(model) then
        return true
    end

    if configuredPoliceModels == nil then
        configuredPoliceModels = {}
        local vehicleCfg = getVehicleTabletConfig()
        local models = vehicleCfg.PoliceModels or vehicleCfg.AllowedVehicleModels
        if type(models) == 'table' then
            for i = 1, #models do
                local modelName = Utils.Trim(models[i]):lower()
                if modelName ~= '' then
                    configuredPoliceModels[modelName] = true
                end
            end
        end
    end

    local modelName = GetDisplayNameFromVehicleModel(model)
    modelName = Utils.Trim(modelName):lower()
    if modelName == '' then
        return false
    end

    if configuredPoliceModels[modelName] == true then
        return true
    end

    return POLICE_VEHICLES[modelName] == true
end

local function getVehicleLabel(vehicle)
    local model = GetEntityModel(vehicle)
    local display = GetDisplayNameFromVehicleModel(model)
    local label = GetLabelText(display)
    if not label or label == 'NULL' then
        label = display
    end
    return Utils.Trim(label)
end

local function getVehicleRole(vehicle)
    if type(cachedSeat) == 'number' then
        if cachedSeat == -1 or cachedSeat == 0 then
            return 'DRIVER'
        end
        if cachedSeat == 1 then
            return 'PASSENGER'
        end
        return 'OTHER'
    end

    if not vehicle or vehicle == 0 then
        return 'NONE'
    end

    local ped = cache.ped or PlayerPedId()
    if GetPedInVehicleSeat(vehicle, -1) == ped then
        return 'DRIVER'
    end
    if GetPedInVehicleSeat(vehicle, 0) == ped then
        return 'PASSENGER'
    end

    return 'OTHER'
end

local function canUseScanner()
    if not isInPoliceVehicle then
        return false
    end

    local vehicle = GetVehiclePedIsIn(cache.ped or PlayerPedId(), false)
    if not vehicle or vehicle == 0 then
        return false
    end

    local role = getVehicleRole(vehicle)
    return role == 'DRIVER' or role == 'PASSENGER'
end

local function updateRadarVisibility()
    local shouldHide = isInPoliceVehicle and tabletOpen

    if shouldHide and not radarHidden then
        DisplayRadar(false)
        radarHidden = true
        return
    end

    if (not shouldHide) and radarHidden then
        DisplayRadar(true)
        radarHidden = false
    end
end

local function sendVehicleContextNui()
    local ped = cache.ped or PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    local plate = ''
    local model = ''
    if vehicle and vehicle ~= 0 then
        plate = Utils.Trim(GetVehicleNumberPlateText(vehicle))
        model = getVehicleLabel(vehicle)
    end

    SendNUIMessage({
        action = 'vehicle:context',
        data = {
            isInPoliceVehicle = isInPoliceVehicle,
            tabletOpen = tabletOpen,
            plate = plate,
            model = model,
            role = getVehicleRole(vehicle),
            quickDockEnabled = quickDockEnabled,
            quickLock = lastQuickLock,
        },
    })
end

local function openVehicleCad(autoOpened)
    if autoOpened == true then
        quickDockEnabled = true
    end

    tabletOpen = true

    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    Wait(25)
    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(false)

    SendNUIMessage({
        action = 'vehicle:cadOpen',
        data = {
            timestamp = GetGameTimer(),
        },
    })

    sendVehicleContextNui()
    updateRadarVisibility()
end

local function closeVehicleCad(forceClose)
    tabletOpen = false

    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)

    SendNUIMessage({
        action = 'vehicle:cadClose',
        data = {
            timestamp = GetGameTimer(),
        },
    })

    if forceClose == true and not isInPoliceVehicle then
        quickDockEnabled = false
    end

    sendVehicleContextNui()
    updateRadarVisibility()
end

local function setPoliceVehicleContext(nextState, autoOpen)
    local desired = nextState == true
    if desired == isInPoliceVehicle then
        if isInPoliceVehicle then
            sendVehicleContextNui()
            updateRadarVisibility()
        end
        return
    end

    isInPoliceVehicle = desired
    if isInPoliceVehicle then
        quickDockEnabled = getVehicleTabletConfig().QuickDockEnabled ~= false
        tabletOpen = false
        sendVehicleContextNui()
        updateRadarVisibility()
    else
        lastQuickLock = nil
        closeVehicleCad(true)
        sendVehicleContextNui()
    end
end

local function raycastVehicleFromCamera(maxDistance)
    local distance = tonumber(maxDistance) or 60.0
    if distance < 5.0 then
        distance = 5.0
    end
    if distance > 120.0 then
        distance = 120.0
    end

    local flags = { 10, 26, 511 }
    for i = 1, #flags do
        local hit, entityHit, endCoords = lib.raycast.fromCamera(flags[i], 4, distance)
        if hit and entityHit and entityHit ~= 0 and GetEntityType(entityHit) == 2 then
            return entityHit, endCoords
        end
    end

    return nil, nil
end

---@param payload { maxDistance?: number }|nil
---@return table
function Vehicle.ScanFront(payload)
    if not canUseScanner() then
        return {
            ok = false,
            error = 'scanner_not_available',
        }
    end

    local nowMs = GetGameTimer()
    if (nowMs - lastScanMs) < 500 then
        return {
            ok = false,
            error = 'scan_cooldown',
        }
    end
    lastScanMs = nowMs

    local maxDistance = payload and payload.maxDistance or nil
    local targetVehicle, hitCoords = raycastVehicleFromCamera(maxDistance)
    if not targetVehicle then
        return {
            ok = false,
            error = 'no_vehicle_target',
        }
    end

    local plate = Utils.Trim(GetVehicleNumberPlateText(targetVehicle))
    local vehicleCoords = GetEntityCoords(targetVehicle)
    local pedCoords = GetEntityCoords(cache.ped or PlayerPedId())
    local distance = #(pedCoords - vehicleCoords)

    return {
        ok = true,
        plate = plate,
        model = getVehicleLabel(targetVehicle),
        entityNetId = NetworkGetNetworkIdFromEntity(targetVehicle),
        distance = math.floor((distance * 10.0) + 0.5) / 10.0,
        coords = {
            x = vehicleCoords.x,
            y = vehicleCoords.y,
            z = vehicleCoords.z,
        },
        hitCoords = hitCoords and {
            x = hitCoords.x,
            y = hitCoords.y,
            z = hitCoords.z,
        } or nil,
        scannedAt = nowMs,
    }
end

---@return { ok: boolean, error?: string, quickLock?: CadVehicleQuickLock }
function Vehicle.LockFrontQuick()
    local scan = Vehicle.ScanFront({
        maxDistance = 70,
    })

    if not scan or scan.ok ~= true then
        return scan or {
            ok = false,
            error = 'scan_failed',
        }
    end

    local summary = lib.callback.await('cad:vehicle:quickSummary', false, {
        plate = scan.plate,
        model = scan.model,
    })

    if not summary or summary.ok ~= true then
        return {
            ok = false,
            error = summary and summary.error or 'quick_summary_failed',
        }
    end

    local stop = lib.callback.await('cad:vehicle:logStop', false, {
        plate = summary.plate,
        model = summary.model,
        ownerId = summary.ownerId,
        ownerName = summary.ownerName,
        riskLevel = summary.riskLevel,
        riskTags = summary.riskTags,
        noteHint = summary.noteHint,
        stopSource = 'KEYBIND',
    })

    lastQuickLock = {
        plate = summary.plate,
        model = summary.model,
        riskLevel = summary.riskLevel,
        riskTags = type(summary.riskTags) == 'table' and summary.riskTags or {},
        noteHint = summary.noteHint,
        ownerId = summary.ownerId,
        ownerName = summary.ownerName,
        distance = scan.distance,
        scannedAt = scan.scannedAt,
        stopId = stop and stop.stopId or nil,
    }

    sendVehicleContextNui()

    local tags = ''
    if type(lastQuickLock.riskTags) == 'table' and #lastQuickLock.riskTags > 0 then
        tags = (' [%s]'):format(table.concat(lastQuickLock.riskTags, ', '))
    end

    lib.notify({
        title = 'Traffic Dock',
        description = ('LOCK %s - %s%s'):format(lastQuickLock.plate, lastQuickLock.riskLevel, tags),
        type = lastQuickLock.riskLevel == 'HIGH' and 'error' or 'inform',
    })

    return {
        ok = true,
        quickLock = lastQuickLock,
    }
end

function Vehicle.PlayAlert(payload)
    local alertType = Utils.Trim(payload and payload.type or 'wanted'):lower()

    local SoundsAction = getAction('Sounds')
    if SoundsAction then
        if alertType == 'wanted' and SoundsAction.EmergencyAlert then
            SoundsAction.EmergencyAlert()
            return { ok = true }
        end
        if SoundsAction.DispatchIncoming then
            SoundsAction.DispatchIncoming()
            return { ok = true }
        end
    end

    PlaySoundFrontend(-1, 'TIMER_STOP', 'HUD_MINI_GAME_SOUNDSET', true)
    return { ok = true }
end

function Vehicle.SetTabletOpen(open)
    if open == true and not isInPoliceVehicle then
        return {
            ok = false,
            error = 'not_in_police_vehicle',
        }
    end

    if open == true then
        openVehicleCad(false)
    else
        closeVehicleCad(false)
    end

    return {
        ok = true,
        tabletOpen = tabletOpen,
    }
end

function Vehicle.OpenTablet(autoOpened)
    openVehicleCad(autoOpened == true)
end

function Vehicle.CloseTablet(forceClose)
    closeVehicleCad(forceClose == true)
end

function Vehicle.IsTabletOpen()
    return tabletOpen == true
end

function Vehicle.IsPoliceVehicleContext()
    return isInPoliceVehicle == true
end

function Vehicle.GetContext()
    return {
        ok = true,
        isInPoliceVehicle = isInPoliceVehicle,
        tabletOpen = tabletOpen,
        quickDockEnabled = quickDockEnabled,
        quickLock = lastQuickLock,
    }
end

function Vehicle.GetReaderContext()
    local vehicleReaderCfg = getVehicleTabletConfig()
    if vehicleReaderCfg.Enabled ~= true then
        return {
            ok = false,
            error = 'vehicle_reader_disabled',
        }
    end

    if not isInPoliceVehicle then
        return {
            ok = false,
            error = 'not_in_police_vehicle',
        }
    end

    local ped = cache.ped or PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    if not vehicle or vehicle == 0 then
        return {
            ok = false,
            error = 'vehicle_not_found',
        }
    end

    local vehicleNetId = NetworkGetNetworkIdFromEntity(vehicle)
    if not vehicleNetId or vehicleNetId == 0 then
        return {
            ok = false,
            error = 'vehicle_netid_not_found',
        }
    end

    return {
        ok = true,
        hasReader = true,
        endpointType = 'vehicle',
        endpointId = ('vehicle:%s'):format(vehicleNetId),
        vehicleNetId = vehicleNetId,
    }
end

function Vehicle.SetQuickDockEnabled(enabled)
    quickDockEnabled = enabled == true
    sendVehicleContextNui()
    return {
        ok = true,
        quickDockEnabled = quickDockEnabled,
    }
end

local function toggleQuickDock()
    if not isInPoliceVehicle then
        return
    end

    quickDockEnabled = not quickDockEnabled
    sendVehicleContextNui()

    lib.notify({
        title = 'Traffic Dock',
        description = quickDockEnabled and 'Quick dock enabled' or 'Quick dock hidden',
        type = 'inform',
    })
end

local function runQuickLockKeybind()
    if not isInPoliceVehicle then
        return
    end

    local result = Vehicle.LockFrontQuick()
    if not result or result.ok ~= true then
        lib.notify({
            title = 'Traffic Dock',
            description = ('Front lock failed: %s'):format(result and result.error or 'unknown_error'),
            type = 'error',
        })
    end
end

CreateThread(function()
    while true do
        if isInPoliceVehicle then
            Wait(500)
            updateRadarVisibility()
        else
            Wait(900)
            updateRadarVisibility()
        end
    end
end)

lib.onCache('vehicle', function(vehicle)
    setPoliceVehicleContext(isPoliceVehicle(vehicle), true)
end)

lib.onCache('seat', function(seat)
    cachedSeat = seat
    if isInPoliceVehicle then
        sendVehicleContextNui()
    end
end)

setPoliceVehicleContext(isPoliceVehicle(cache.vehicle), true)

do
    local cfg = getVehicleTabletConfig()
    quickDockEnabled = cfg.QuickDockEnabled ~= false

    if lib and lib.addKeybind then
        lib.addKeybind({
            name = 'cad_vehicle_lock_front',
            description = 'Traffic dock: lock front vehicle',
            defaultKey = Utils.Trim(cfg.QuickDockLockKey ~= nil and cfg.QuickDockLockKey or 'K'):upper(),
            onPressed = function()
                runQuickLockKeybind()
            end,
        })

        lib.addKeybind({
            name = 'cad_vehicle_toggle_dock',
            description = 'Traffic dock: toggle quick panel',
            defaultKey = Utils.Trim(cfg.QuickDockToggleKey ~= nil and cfg.QuickDockToggleKey or 'U'):upper(),
            onPressed = function()
                toggleQuickDock()
            end,
        })
    end

    if isInPoliceVehicle then
        sendVehicleContextNui()
    end
end

exports('setVehicleContext', function(context)
    setPoliceVehicleContext(context == true, false)
end)

exports('setUIMode', function(_)

end)

exports('setVehicleSpeed', function(speed)
    local _ = speed
    sendVehicleContextNui()
end)

exports('openVehicleCAD', function()
    openVehicleCad(false)
end)

exports('closeVehicleCAD', function()
    closeVehicleCad(true)
end)

exports('searchVehicle', function(plate)
    SendNUIMessage({
        action = 'vehicle:prefillSearch',
        data = {
            plate = Utils.Trim(plate),
        },
    })
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    if radarHidden then
        DisplayRadar(true)
        radarHidden = false
    end
end)

_G.CadActions = _G.CadActions or {}
_G.CadActions.Vehicle = Vehicle
