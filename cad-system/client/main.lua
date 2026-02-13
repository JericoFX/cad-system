CAD = CAD or {}
CAD.Client = CAD.Client or {}

local uiOpen = false
local canUseCad = false
local accessZoneIds = {}
local useTargetAccess = false
local activeTerminalContext = nil

local function normalizeTerminal(point, index)
    if type(point) ~= 'table' then
        return nil
    end

    local terminalId = point.id or ('terminal_%s'):format(index)
    local container = type(point.evidenceContainer) == 'table' and point.evidenceContainer or nil
    local reader = type(point.idReader) == 'table' and point.idReader or nil

    return {
        terminalId = terminalId,
        label = point.label or ('CAD Terminal %s'):format(index),
        coords = point.coords,
        radius = point.radius or 1.25,
        hasContainer = container and container.enabled == true or false,
        container = container,
        hasReader = reader and reader.enabled == true or false,
        reader = reader,
    }
end

local function setActiveTerminal(point, index)
    activeTerminalContext = normalizeTerminal(point, index)
end

local function getNearestTerminal()
    local ped = PlayerPedId()
    if not ped or ped == 0 then
        return nil
    end

    local coords = GetEntityCoords(ped)
    local points = CAD.Config.UI.AccessPoints or {}
    local nearest, nearestDistance = nil, nil

    for i = 1, #points do
        local terminal = normalizeTerminal(points[i], i)
        if terminal and terminal.coords then
            local distance = #(coords - terminal.coords)
            local threshold = (terminal.radius or 1.25) + 3.0
            if distance <= threshold and (not nearestDistance or distance < nearestDistance) then
                nearest = terminal
                nearestDistance = distance
            end
        end
    end

    return nearest
end

local function refreshAccess()
    local data = lib.callback.await('cad:getPlayerData', false, {})
    canUseCad = data ~= nil
end

local function setupAccessZones()
    local points = CAD.Config.UI.AccessPoints or {}

    if useTargetAccess then
        for i = 1, #points do
            local point = points[i]
            local zoneName = ('cad_access_%s'):format(i)
            local zoneId = exports.ox_target:addSphereZone({
                name = zoneName,
                coords = point.coords,
                radius = point.radius or 1.25,
                debug = CAD.Config.Debug == true,
                options = {
                    {
                        name = ('%s_option'):format(zoneName),
                        icon = 'fa-solid fa-desktop',
                        label = ('Abrir CAD (%s)'):format(point.label or 'Terminal'),
                        canInteract = function()
                            return canUseCad
                        end,
                        onSelect = function()
                            setActiveTerminal(point, i)
                            CAD.Client.SetUIState(true)
                        end,
                    },
                },
            })
            accessZoneIds[#accessZoneIds + 1] = zoneId
        end
        return
    end

    for i = 1, #points do
        local point = points[i]
        lib.zones.sphere({
            coords = point.coords,
            radius = point.radius or 1.25,
            onEnter = function()
                lib.showTextUI(('[E] %s'):format(point.label or 'CAD PC'))
            end,
            inside = function()
                if IsControlJustPressed(0, 38) then
                    if canUseCad then
                        setActiveTerminal(point, i)
                        CAD.Client.SetUIState(true)
                    else
                        lib.notify({ title = 'CAD', description = 'No tienes acceso al CAD', type = 'error' })
                    end
                end
            end,
            onExit = function()
                lib.hideTextUI()
            end,
        })
    end
end

local function setupFrameworkBridge()
    CAD.Core.Client.RegisterAccessEvents(refreshAccess)
end

function CAD.Client.SetUIState(open)
    if open == true then
        local nearest = getNearestTerminal()
        if nearest then
            activeTerminalContext = nearest
        end
    end

    uiOpen = open == true
    SetNuiFocus(uiOpen, uiOpen)
    SetNuiFocusKeepInput(uiOpen)
    SendNUIMessage({ action = uiOpen and 'openCad' or 'closeCad' })
end

function CAD.Client.GetComputerContext()
    if not activeTerminalContext then
        local nearest = getNearestTerminal()
        if nearest then
            activeTerminalContext = nearest
        end
    end

    if not activeTerminalContext then
        return {
            ok = false,
            error = 'no_terminal_context',
        }
    end

    return {
        ok = true,
        terminalId = activeTerminalContext.terminalId,
        label = activeTerminalContext.label,
        hasContainer = activeTerminalContext.hasContainer,
        container = activeTerminalContext.container,
        hasReader = activeTerminalContext.hasReader,
        reader = activeTerminalContext.reader,
    }
end

function CAD.Client.ToggleUI()
    CAD.Client.SetUIState(not uiOpen)
end

RegisterCommand(CAD.Config.UI.Command, function()
    if not canUseCad then
        lib.notify({ title = 'CAD', description = 'No tienes acceso al CAD', type = 'error' })
        return
    end
    CAD.Client.ToggleUI()
end, false)

if CAD.Config.UI.Keybind then
    RegisterKeyMapping(CAD.Config.UI.Command, 'Open CAD', 'keyboard', CAD.Config.UI.Keybind)
end

RegisterNUICallback('closeUI', function(_, cb)
    CAD.Client.SetUIState(false)
    cb({ ok = true })
end)

CreateThread(function()
    Wait(1000)
    refreshAccess()

    local mode = tostring((CAD.Config.UI.AccessMode or 'auto')):lower()
    useTargetAccess = mode ~= 'zone' and GetResourceState('ox_target') == 'started'

    setupFrameworkBridge()
    setupAccessZones()
end)

CreateThread(function()
    if CAD.IsFeatureEnabled and not CAD.IsFeatureEnabled('Dispatch') then
        return
    end

    while true do
        Wait(CAD.Config.Dispatch.PositionBroadcastMs)

        local ped = PlayerPedId()
        if ped and ped ~= 0 then
            local coords = GetEntityCoords(ped)
            TriggerServerEvent('cad:server:updatePosition', {
                x = coords.x,
                y = coords.y,
                z = coords.z,
            })
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    if useTargetAccess and GetResourceState('ox_target') == 'started' then
        for i = 1, #accessZoneIds do
            pcall(function()
                exports.ox_target:removeZone(accessZoneIds[i])
            end)
        end
    end

    lib.hideTextUI()
    CAD.Client.SetUIState(false)
end)
