--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

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
    local ped = cache.ped
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
    
    -- Always disable NUI focus first to ensure clean state
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)

    -- Small delay to ensure focus is released before re-enabling if opening
    if uiOpen then
        Wait(50)
        SetNuiFocus(true, true)
        -- KeepInput false to prevent other apps from receiving input while CAD is open
        SetNuiFocusKeepInput(false)
    end
    
    -- Send NUI message with detailed context
    if uiOpen then
        SendNUIMessage({
            action = 'cad:opened',
            data = {
                terminalId = activeTerminalContext and activeTerminalContext.terminalId or 'unknown',
                location = activeTerminalContext and activeTerminalContext.coords or nil,
                hasContainer = activeTerminalContext and activeTerminalContext.hasContainer or false,
                hasReader = activeTerminalContext and activeTerminalContext.hasReader or false,
            }
        })
    else
        SendNUIMessage({
            action = 'cad:closed',
            data = {
                timestamp = GetGameTimer()
            }
        })
    end
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

        local ped = cache.ped
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

-- ============================================================
-- NUI Event Forwarding - Server to Client to NUI
-- ============================================================

-- Dispatch events
RegisterNetEvent('cad:client:dispatchCreated')
AddEventHandler('cad:client:dispatchCreated', function(data)
    SendNUIMessage({ action = 'dispatch:callCreated', data = data })
end)

RegisterNetEvent('cad:client:dispatchUpdated')
AddEventHandler('cad:client:dispatchUpdated', function(data)
    SendNUIMessage({ action = 'dispatch:callUpdated', data = data })
end)

RegisterNetEvent('cad:client:dispatchClosed')
AddEventHandler('cad:client:dispatchClosed', function(data)
    SendNUIMessage({ action = 'dispatch:callClosed', data = data })
end)

RegisterNetEvent('cad:client:dispatchAssigned')
AddEventHandler('cad:client:dispatchAssigned', function(data)
    SendNUIMessage({ action = 'dispatch:callAssigned', data = data })
end)

RegisterNetEvent('cad:client:unitStatusChanged')
AddEventHandler('cad:client:unitStatusChanged', function(data)
    SendNUIMessage({ action = 'dispatch:unitStatusChanged', data = data })
end)

-- Case events
RegisterNetEvent('cad:client:caseCreated')
AddEventHandler('cad:client:caseCreated', function(data)
    SendNUIMessage({ action = 'case:created', data = data })
end)

RegisterNetEvent('cad:client:caseUpdated')
AddEventHandler('cad:client:caseUpdated', function(data)
    SendNUIMessage({ action = 'case:updated', data = data })
end)

RegisterNetEvent('cad:client:caseClosed')
AddEventHandler('cad:client:caseClosed', function(data)
    SendNUIMessage({ action = 'case:closed', data = data })
end)

RegisterNetEvent('cad:client:caseNoteAdded')
AddEventHandler('cad:client:caseNoteAdded', function(data)
    SendNUIMessage({ action = 'case:noteAdded', data = data })
end)

-- Evidence events
RegisterNetEvent('cad:client:evidenceStaged')
AddEventHandler('cad:client:evidenceStaged', function(data)
    SendNUIMessage({ action = 'evidence:staged', data = data })
end)

RegisterNetEvent('cad:client:evidenceAnalyzed')
AddEventHandler('cad:client:evidenceAnalyzed', function(data)
    SendNUIMessage({ action = 'evidence:analyzed', data = data })
end)

-- EMS events
RegisterNetEvent('cad:client:emsAlertCreated')
AddEventHandler('cad:client:emsAlertCreated', function(data)
    SendNUIMessage({ action = 'ems:alertCreated', data = data })
end)

RegisterNetEvent('cad:client:emsAlertUpdated')
AddEventHandler('cad:client:emsAlertUpdated', function(data)
    SendNUIMessage({ action = 'ems:alertUpdated', data = data })
end)

RegisterNetEvent('cad:client:emsCriticalPatient')
AddEventHandler('cad:client:emsCriticalPatient', function(data)
    SendNUIMessage({ action = 'ems:criticalPatient', data = data })
end)

RegisterNetEvent('cad:client:emsLowStock')
AddEventHandler('cad:client:emsLowStock', function(data)
    SendNUIMessage({ action = 'ems:lowStock', data = data })
end)

RegisterNetEvent('cad:client:emsBloodRequest')
AddEventHandler('cad:client:emsBloodRequest', function(data)
    SendNUIMessage({ action = 'ems:bloodRequestCreated', data = data })
end)

-- Forensics events
RegisterNetEvent('cad:client:forensicsAnalysisStarted')
AddEventHandler('cad:client:forensicsAnalysisStarted', function(data)
    SendNUIMessage({ action = 'forensics:analysisStarted', data = data })
end)

RegisterNetEvent('cad:client:forensicsAnalysisCompleted')
AddEventHandler('cad:client:forensicsAnalysisCompleted', function(data)
    SendNUIMessage({ action = 'forensics:analysisCompleted', data = data })
end)

-- Photo events
RegisterNetEvent('cad:client:photoCaptured')
AddEventHandler('cad:client:photoCaptured', function(data)
    SendNUIMessage({ action = 'photo:captured', data = data })
end)

-- Fine events
RegisterNetEvent('cad:client:fineCreated')
AddEventHandler('cad:client:fineCreated', function(data)
    SendNUIMessage({ action = 'fine:created', data = data })
end)

RegisterNetEvent('cad:client:finePaid')
AddEventHandler('cad:client:finePaid', function(data)
    SendNUIMessage({ action = 'fine:paid', data = data })
end)

-- Offline sync
RegisterNetEvent('cad:client:syncOffline')
AddEventHandler('cad:client:syncOffline', function(data)
    SendNUIMessage({ action = 'cad:syncOffline', data = data })
end)
