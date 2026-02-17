--[[
CAD Vehicle Integration Module
Adds vehicle-specific CAD functionality for police vehicles
]]

CAD = CAD or {}
CAD.Vehicle = CAD.Vehicle or {}

-- Police vehicle models (QB Core compatible)
local POLICE_VEHICLES = {
    'police', 'police2', 'police3', 'police4',
    'policeb', 'policet', 'sheriff', 'sheriff2',
    'fbi', 'fbi2', 'pranger', 'riot'
}

-- Track vehicle context
local isInPoliceVehicle = false
local currentSpeed = 0

-- Check if vehicle is police vehicle
local function isPoliceVehicle(vehicle)
    if not vehicle or vehicle == 0 then return false end
    
    local model = GetEntityModel(vehicle)
    local modelName = GetDisplayNameFromVehicleModel(model):lower()
    
    for _, name in ipairs(POLICE_VEHICLES) do
        if modelName == name then
            return true
        end
    end
    return false
end

-- Update UI context based on vehicle
local function updateVehicleContext()
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    local wasInPoliceVehicle = isInPoliceVehicle

    isInPoliceVehicle = isPoliceVehicle(vehicle)

    if isInPoliceVehicle ~= wasInPoliceVehicle then
        exports['cad-system']:setVehicleContext(isInPoliceVehicle)
        if isInPoliceVehicle then
            exports['cad-system']:openVehicleCAD()
        else
            exports['cad-system']:closeVehicleCAD()
        end
    end
end

-- Speed-based UI adjustments
local function updateSpeedContext()
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if vehicle and vehicle ~= 0 then
        currentSpeed = GetEntitySpeed(vehicle) * 2.23694 -- m/s to mph
    else
        currentSpeed = 0
    end

    -- Auto-minimize UI at high speeds
    if currentSpeed > 40 then
        exports['cad-system']:setUIMode('compact')
    elseif currentSpeed < 10 then
        exports['cad-system']:setUIMode('normal')
    end
end

-- License plate scanner
local function startLicenseScan()
    local vehicle = GetVehicleInDirection(15.0)
    if not vehicle or vehicle == 0 then
        lib.notify({ title = 'CAD', description = 'No vehicle in range', type = 'error' })
        return
    end

    local plate = GetVehicleNumberPlateText(vehicle)
    exports['cad-system']:searchVehicle(plate)
end

-- Get vehicle in direction
local function GetVehicleInDirection(maxDistance)
    maxDistance = maxDistance or 15.0
    
    local playerPed = PlayerPedId()
    local playerCoords = GetEntityCoords(playerPed)
    local forwardVector = GetEntityForwardVector(playerPed)
    
    local targetCoords = playerCoords + (forwardVector * maxDistance)
    
    local rayHandle = StartShapeTestRay(
        playerCoords.x, playerCoords.y, playerCoords.z,
        targetCoords.x, targetCoords.y, targetCoords.z,
        10,
        playerPed,
        0
    )
    
    local _, hit, _, _, entity = GetShapeTestResult(rayHandle)
    
    if hit == 1 and GetEntityType(entity) == 2 then
        return entity
    end
    
    return 0
end

-- Vehicle radar system
CAD.Vehicle.Radar = {
    enabled = true,
    range = 100.0,
    updateInterval = 1000,

    toggle = function(self)
        self.enabled = not self.enabled
        lib.notify({
            title = 'Radar',
            description = self.enabled and 'Radar activated' or 'Radar disabled',
            type = 'inform'
        })
    end,

    scan = function(self)
        if not self.enabled then return {} end

        local playerCoords = GetEntityCoords(PlayerPedId())
        local results = {}

        for _, vehicle in ipairs(GetAllVehicles()) do
            if vehicle ~= GetVehiclePedIsIn(PlayerPedId(), false) then
                local coords = GetEntityCoords(vehicle)
                local distance = #(playerCoords - coords)

                if distance <= self.range then
                    table.insert(results, {
                        id = vehicle,
                        coords = coords,
                        distance = distance,
                        model = GetEntityModel(vehicle),
                        isWanted = CAD.Vehicle.isWantedVehicle(vehicle)
                    })
                end
            end
        end

        return results
    end,

    isWantedVehicle = function(vehicle)
        local plate = GetVehicleNumberPlateText(vehicle)
        -- Check against CAD wanted list
        local officerData = CAD.Auth.GetOfficerData(PlayerId())
        if officerData and officerData.wantedList then
            for _, wanted in ipairs(officerData.wantedList) do
                if wanted.plate == plate then
                    return true
                end
            end
        end
        return false
    end
}

-- Initialize
CreateThread(function()
    while true do
        Wait(500)
        
        updateVehicleContext()
        updateSpeedContext()
        
        -- Vehicle radar updates
        if isInPoliceVehicle and CAD.Vehicle.Radar.enabled then
            CAD.Vehicle.Radar:scan()
        end
    end
end)

-- Register exports
exports('setVehicleContext', function(context)
    isInPoliceVehicle = context
end)

exports('setUIMode', function(mode)
    -- Will be handled by NUI
end)

exports('searchVehicle', function(plate)
    -- Trigger vehicle search
    TriggerServerEvent('cad:vehicle:search', plate)
end)

-- Bind license scan
RegisterKeyMapping('+licenseScan', 'Scan Vehicle License', 'keyboard', 'x')
RegisterCommand('+licenseScan', startLicenseScan, false)