local ClientFn = {}

---@param coords vector3
---@return string
function ClientFn.GetStreetName(coords)
    local streetHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    return GetStreetNameFromHashKey(streetHash)
end

---@param coords vector3
---@return string
function ClientFn.GetZoneName(coords)
    return GetLabelText(GetNameOfZone(coords.x, coords.y, coords.z))
end

---@param coords vector3
---@return string
function ClientFn.FormatCoords(coords)
    return string.format('%.2f, %.2f, %.2f', coords.x, coords.y, coords.z)
end

---@param heading number
---@return string
function ClientFn.GetDirection(heading)
    local directions = { 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW' }
    local index = math.floor((heading + 22.5) / 45) % 8
    return directions[index + 1]
end

---@return boolean
function ClientFn.IsInVehicle()
    return cache.vehicle ~= nil
end

---@return { model: integer, name: string, plate: string }|nil
function ClientFn.GetVehicleInfo()
    if not cache.vehicle then return nil end
    local vehicle = cache.vehicle
    local model = GetEntityModel(vehicle)
    local name = GetDisplayNameFromVehicleModel(model)
    local plate = GetVehicleNumberPlateText(vehicle)
    return { model = model, name = name, plate = plate }
end

---@param coords vector3
---@param sprite integer
---@param color integer
---@param scale number
---@param label string
---@return integer
function ClientFn.CreateBlip(coords, sprite, color, scale, label)
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

---@param blip integer|nil
function ClientFn.RemoveBlip(blip)
    if blip then RemoveBlip(blip) end
end

---@param coords vector3
---@param text string
function ClientFn.Draw3DText(coords, text)
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

---@param rotation vector3
---@return { x: number, y: number, z: number }
function ClientFn.RotationToDirection(rotation)
    local adjustedRotation = {
        x = math.rad(rotation.x),
        y = math.rad(rotation.y),
        z = math.rad(rotation.z)
    }
    return {
        x = -math.sin(adjustedRotation.z) * math.abs(math.cos(adjustedRotation.x)),
        y = math.cos(adjustedRotation.z) * math.abs(math.cos(adjustedRotation.x)),
        z = math.sin(adjustedRotation.x)
    }
end

---@param coords any
---@return boolean
function ClientFn.IsValidCoords(coords)
    return coords and coords.x and coords.y and coords.z
        and coords.x ~= 0 and coords.y ~= 0
end

---@param value vector3|table|any
---@return vector3|nil
function ClientFn.AsVector3(value)
    if type(value) == 'vector3' then
        return value
    end

    if type(value) == 'table' then
        local x = tonumber(value.x)
        local y = tonumber(value.y)
        local z = tonumber(value.z)
        if x and y and z then
            return vector3(x, y, z)
        end
    end

    return nil
end

---@param hit boolean|number|any
---@return boolean
function ClientFn.NormalizeRaycastHit(hit)
    if type(hit) == 'boolean' then
        return hit
    end

    if type(hit) == 'number' then
        return hit == 1
    end

    return false
end

return ClientFn
