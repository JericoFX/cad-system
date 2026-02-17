--[[
DEBUG: Vehicle CAD Mock Data
Temporary script for testing vehicle CAD integration
]]

CAD = CAD or {}

-- Mock police vehicle models
local DEBUG_VEHICLES = {
    'debug_police',
    'debug_sheriff',
    'police',
    'sheriff'
}

-- Current mock state
local isInPoliceVehicle = false
local currentSpeed = 0
local debugMode = true

-- Toggle vehicle CAD context
local function toggleVehicleCAD()
    isInPoliceVehicle = not isInPoliceVehicle
    currentSpeed = isInPoliceVehicle and 35.0 or 0.0

    exports['cad-system']:setVehicleContext(isInPoliceVehicle)
    exports['cad-system']:setVehicleSpeed(currentSpeed)

    if isInPoliceVehicle then
        exports['cad-system']:openVehicleCAD()
        lib.notify({
            title = 'DEBUG',
            description = 'Vehicle CAD activated',
            type = 'success'
        })
    else
        exports['cad-system']:closeVehicleCAD()
        lib.notify({
            title = 'DEBUG',
            description = 'Vehicle CAD deactivated',
            type = 'inform'
        })
    end
end

-- Generate mock radar data
local function generateMockRadarData()
    if not isInPoliceVehicle then return {} end

    local playerCoords = GetEntityCoords(PlayerPedId())
    local data = {}

    -- Add normal vehicle
    table.insert(data, {
        id = 1,
        coords = {
            x = playerCoords.x + math.random(-50, 50),
            y = playerCoords.y + math.random(-50, 50),
            z = playerCoords.z
        },
        distance = math.random(5, 80),
        isWanted = false
    })

    -- Add wanted vehicle (25% chance)
    if math.random(1, 4) == 1 then
        table.insert(data, {
            id = 2,
            coords = {
                x = playerCoords.x + math.random(-80, 80),
                y = playerCoords.y + math.random(-80, 80),
                z = playerCoords.z
            },
            distance = math.random(10, 90),
            isWanted = true
        })
    end

    return data
end

-- Mock license scan
local function mockLicenseScan()
    if not isInPoliceVehicle then
        lib.notify({
            title = 'CAD',
            description = 'Not in police vehicle',
            type = 'error'
        })
        return
    end

    lib.progressBar({
        duration = 2000,
        label = 'Scanning license plate...',
        useWhileDead = false,
        canCancel = true,
        disable = {
            car = true,
            move = true,
            combat = true
        },
        anim = {
            dict = 'anim@amb@business@weed@weed_inspecting_lo_med_hi',
            clip = 'weed_squat_over_inspect_loop_aggressive'
        }
    })

    Wait(2000)

    local plate = string.format('CAD-%03d', math.random(100, 999))
    exports['cad-system']:searchVehicle(plate)
end

-- Register debug commands
if CAD.Config.Debug then
    RegisterCommand('vehiclecad', toggleVehicleCAD, false)
    RegisterKeyMapping('+debugVehicleCAD', 'Toggle Vehicle CAD', 'keyboard', 'f10')
    RegisterCommand('+debugVehicleCAD', toggleVehicleCAD, false)

    RegisterCommand('scanplate', mockLicenseScan, false)
end

-- Mock vehicle context for testing
CreateThread(function()
    while true do
        Wait(1000)
        
        -- Update speed (simulates driving)
        if isInPoliceVehicle then
            currentSpeed = math.min(currentSpeed + math.random(-5, 10), 90)
            exports['cad-system']:setVehicleSpeed(currentSpeed)
        end
        
        -- Simulate radar updates
        if debugMode and isInPoliceVehicle then
            local radarData = generateMockRadarData()
            -- Would normally send to NUI, but for debug just log
            -- In real implementation, this would trigger NUI update
        end
    end
end)

-- Debug notifications
if CAD.Config.Debug then
    lib.notify({
        title = 'DEBUG',
        description = 'Vehicle CAD mock system loaded',
        type = 'inform'
    })
    lib.notify({
        title = 'DEBUG',
        description = 'Press F10 to toggle vehicle CAD context',
        type = 'inform'
    })
    lib.notify({
        title = 'DEBUG',
        description = 'Type /scanplate to simulate license scan',
        type = 'inform'
    })
end