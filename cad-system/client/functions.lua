-- CAD Client Functions

-- Get street name at coords
function CAD.Client.GetStreetName(coords)
    local streetHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    return GetStreetNameFromHashKey(streetHash)
end

-- Get zone name
function CAD.Client.GetZoneName(coords)
    local zoneName = GetLabelText(GetNameOfZone(coords.x, coords.y, coords.z))
    return zoneName
end

-- Format coords for display
function CAD.Client.FormatCoords(coords)
    return string.format('%.2f, %.2f, %.2f', coords.x, coords.y, coords.z)
end

-- Get direction from heading
function CAD.Client.GetDirection(heading)
    local directions = { 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW' }
    local index = math.floor((heading + 22.5) / 45) % 8
    return directions[index + 1]
end

-- Check if player is in vehicle
function CAD.Client.IsInVehicle()
    return cache.vehicle ~= nil
end

-- Get vehicle info
function CAD.Client.GetVehicleInfo()
    if not cache.vehicle then return nil end
    
    local vehicle = cache.vehicle
    local model = GetEntityModel(vehicle)
    local name = GetDisplayNameFromVehicleModel(model)
    local plate = GetVehicleNumberPlateText(vehicle)
    
    return {
        model = model,
        name = name,
        plate = plate
    }
end

-- Play animation
function CAD.Client.PlayAnim(dict, anim, duration)
    lib.requestAnimDict(dict)
    TaskPlayAnim(cache.ped, dict, anim, 8.0, -8.0, duration, 0, 0, false, false, false)
    RemoveAnimDict(dict)
end

-- Show help text
function CAD.Client.ShowHelpText(text)
    lib.showTextUI(text)
end

-- Hide help text
function CAD.Client.HideHelpText()
    lib.hideTextUI()
end

-- Create blip
function CAD.Client.CreateBlip(coords, sprite, color, scale, label)
    local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(blip, sprite)
    SetBlipColour(blip, color)
    SetBlipScale(blip, scale)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(label)
    EndTextCommandSetBlipName(blip)
    return blip
end

-- Remove blip
function CAD.Client.RemoveBlip(blip)
    if blip then
        RemoveBlip(blip)
    end
end

-- Draw 3D text
function CAD.Client.Draw3DText(coords, text)
    local onScreen, x, y = GetScreenCoordFromWorldCoord(coords.x, coords.y, coords.z)
    if onScreen then
        SetTextScale(0.35, 0.35)
        SetTextFont(4)
        SetTextProportional(1)
        SetTextColour(255, 255, 255, 215)
        SetTextEntry('STRING')
        SetTextCentre(1)
        AddTextComponentString(text)
        DrawText(x, y)
        
        local factor = (string.len(text)) / 370
        DrawRect(x, y + 0.0125, 0.015 + factor, 0.03, 41, 11, 41, 68)
    end
end

-- Raycast from camera
function CAD.Client.RayCastGamePlayCamera(distance)
    local cameraRotation = GetGameplayCamRot()
    local cameraCoord = GetGameplayCamCoord()
    local direction = CAD.Client.RotationToDirection(cameraRotation)
    local destination = {
        x = cameraCoord.x + direction.x * distance,
        y = cameraCoord.y + direction.y * distance,
        z = cameraCoord.z + direction.z * distance
    }
    
    local rayHandle = StartShapeTestRay(cameraCoord.x, cameraCoord.y, cameraCoord.z, destination.x, destination.y, destination.z, -1, cache.ped, 0)
    local _, hit, hitCoords, _, entityHit = GetShapeTestResult(rayHandle)
    
    return hit, hitCoords, entityHit
end

-- Convert rotation to direction vector
function CAD.Client.RotationToDirection(rotation)
    local adjustedRotation = {
        x = math.rad(rotation.x),
        y = math.rad(rotation.y),
        z = math.rad(rotation.z)
    }
    local direction = {
        x = -math.sin(adjustedRotation.z) * math.abs(math.cos(adjustedRotation.x)),
        y = math.cos(adjustedRotation.z) * math.abs(math.cos(adjustedRotation.x)),
        z = math.sin(adjustedRotation.x)
    }
    return direction
end

-- Check if coords are valid
function CAD.Client.IsValidCoords(coords)
    return coords and coords.x and coords.y and coords.z and
           coords.x ~= 0 and coords.y ~= 0
end
