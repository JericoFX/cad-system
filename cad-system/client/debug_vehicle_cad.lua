CAD = CAD or {}

local DEBUG_VEHICLES = {
    'debug_police',
    'debug_sheriff',
    'police',
    'sheriff'
}

local isInPoliceVehicle = false
local currentSpeed = 0
local debugMode = true

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

local function generateMockRadarData()
    if not isInPoliceVehicle then return {} end

    local playerCoords = GetEntityCoords(PlayerPedId())
    local data = {}

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

local function mockLicenseScan()
    if not isInPoliceVehicle then
        lib.notify({
            title = 'CAD',
            description = 'Not in police vehicle',
            type = 'error'
        })
        return
    end

    local completed = CAD.Progress.Run({
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

    if not completed then
        return
    end

    local plate = string.format('CAD-%03d', math.random(100, 999))
    exports['cad-system']:searchVehicle(plate)
end

if CAD.Config.Debug then
    RegisterCommand('vehiclecad', toggleVehicleCAD, false)
    RegisterKeyMapping('+debugVehicleCAD', 'Toggle Vehicle CAD', 'keyboard', 'f10')
    RegisterCommand('+debugVehicleCAD', toggleVehicleCAD, false)

    RegisterCommand('scanplate', mockLicenseScan, false)


    CreateThread(function()
        while true do
            Wait(1000)

            if isInPoliceVehicle then
                currentSpeed = math.min(currentSpeed + math.random(-5, 10), 90)
                exports['cad-system']:setVehicleSpeed(currentSpeed)
            end

            if debugMode and isInPoliceVehicle then
                local radarData = generateMockRadarData()
            end
        end
    end)


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
