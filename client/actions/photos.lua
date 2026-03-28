local ClientFn = require 'modules.client.functions'
local Registry = require 'modules.shared.registry'
local Utils = require 'modules.shared.utils'

---@class PhotosModule
---@field CapturePolicePhoto fun(): nil
---@field CaptureNewsPhoto fun(): nil

---@class PhotoCaptureState
---@field ped number|nil
---@field isCapturing boolean
---@field captureConfig table|nil
---@field captureConfigAt number

---@class FovData
---@field hit boolean
---@field hitCoords { x: number, y: number, z: number }|nil
---@field distance number
---@field entityType string|nil
---@field location { x: number, y: number, z: number }

local Photos = {}

local PHOTO_CONFIG = {
    animations = {
        policeCamera = 'WORLD_HUMAN_PAPARAZZI',
        newsCamera = 'WORLD_HUMAN_PAPARAZZI',
        duration = 2000,
    },
    fov = {
        maxDistance = 50.0,
        showMarker = true,
        markerSize = 0.1,
    },
}

local state = {
    ped = nil,
    isCapturing = false,
    captureConfig = nil,
    captureConfigAt = 0,
}

---@return number
local function getPed()
    return cache.ped or PlayerPedId()
end

---@param message string
---@param nType string|nil
---@return nil
local function notify(message, nType)
    lib.notify({
        title = 'CAD',
        description = message,
        type = nType or 'inform',
    })
end

---@param distance number
---@return boolean, vector3|nil, number|nil
local function raycastFromCamera(distance)
    local hit, entity, hitCoords = lib.raycast.fromCamera(511, 4, distance)
    if ClientFn.NormalizeRaycastHit(hit) and hitCoords and hitCoords.x and hitCoords.y and hitCoords.z then
        return true, hitCoords, entity
    end

    return false, nil, nil
end

---@param coords vector3
---@return nil
local function drawHitMarker(coords)
    if not PHOTO_CONFIG.fov.showMarker then
        return
    end

    DrawMarker(
        0,
        coords.x,
        coords.y,
        coords.z,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        PHOTO_CONFIG.fov.markerSize,
        PHOTO_CONFIG.fov.markerSize,
        PHOTO_CONFIG.fov.markerSize,
        255,
        0,
        0,
        200,
        false,
        false,
        2,
        false,
        nil,
        nil,
        false
    )
end

---@param entity number|nil
---@return string|nil
local function getEntityTypeString(entity)
    if not entity or entity == 0 then
        return nil
    end

    local entityType = GetEntityType(entity)
    if entityType == 1 then
        return 'ped'
    end
    if entityType == 2 then
        return 'vehicle'
    end
    if entityType == 3 then
        return 'object'
    end

    return 'unknown'
end

---@param force boolean
---@return table|nil, string|nil
local function getCaptureConfig(force)
    local now = GetGameTimer()
    if not force and state.captureConfig and (now - state.captureConfigAt) < 30000 then
        return state.captureConfig
    end

    local response = lib.callback.await('cad:photos:getCaptureConfig', false, {})
    if not response or response.ok ~= true then
        return nil, response and response.error or 'capture_config_unavailable'
    end

    state.captureConfig = {
        mode = tostring(response.mode or 'client_direct'),
        provider = tostring(response.provider or 'screenshot-basic'),
        endpoint = tostring(response.endpoint or ''),
        fieldName = tostring(response.fieldName or 'files[]'),
        options = type(response.options) == 'table' and response.options or {},
    }
    state.captureConfigAt = now

    if state.captureConfig.mode ~= 'server_proxy' and state.captureConfig.endpoint == '' then
        return nil, 'capture_endpoint_missing'
    end

    return state.captureConfig
end

---@param data string|nil
---@return string|nil
local function parseScreenshotUpload(data)
    local decoded = json.decode(data or '{}')
    if type(decoded) ~= 'table' then
        return nil
    end

    if decoded.attachments and decoded.attachments[1] then
        return decoded.attachments[1].proxy_url or decoded.attachments[1].url
    end

    if type(decoded.url) == 'string' and decoded.url ~= '' then
        return decoded.url
    end

    if type(decoded.data) == 'table' and type(decoded.data.url) == 'string' and decoded.data.url ~= '' then
        return decoded.data.url
    end

    if type(decoded.image) == 'string' and decoded.image ~= '' then
        return decoded.image
    end

    if type(decoded.link) == 'string' and decoded.link ~= '' then
        return decoded.link
    end

    return nil
end

---@param captureConfig table
---@return string|nil, string|nil
local function requestScreenshotUrl(captureConfig)
    if GetResourceState('screenshot-basic') ~= 'started' then
        return nil, 'screenshot_basic_missing'
    end

    local result = nil
    local uploadOptions = type(captureConfig.options) == 'table' and captureConfig.options or {}
    local callback = function(data)
        local imageUrl = parseScreenshotUpload(data)
        if not imageUrl then
            result = { ok = false, error = 'upload_response_invalid' }
            return
        end

        result = { ok = true, url = imageUrl }
    end

    if next(uploadOptions) ~= nil then
        local ok = pcall(function()
            exports['screenshot-basic']:requestScreenshotUpload(
                captureConfig.endpoint,
                captureConfig.fieldName,
                uploadOptions,
                callback
            )
        end)

        if not ok then
            exports['screenshot-basic']:requestScreenshotUpload(
                captureConfig.endpoint,
                captureConfig.fieldName,
                callback
            )
        end
    else
        exports['screenshot-basic']:requestScreenshotUpload(
            captureConfig.endpoint,
            captureConfig.fieldName,
            callback
        )
    end

    local timeout = GetGameTimer() + 30000
    while result == nil do
        if GetGameTimer() > timeout then
            Utils.Log('error', 'Screenshot upload timed out after 30s')
            result = false
            break
        end
        Wait(100)
    end

    if result.ok ~= true then
        return nil, result.error or 'upload_failed'
    end

    return result.url, nil
end

---@param job string
---@return string|nil, string|nil, string|nil
local function requestServerProxyUpload(job)
    local response = lib.callback.await('cad:photos:uploadCapture', false, {
        job = job,
    })

    if not response or response.ok ~= true then
        return nil, nil, response and response.error or 'upload_failed'
    end

    return response.url, tostring(response.provider or 'server_proxy'), nil
end

---@param job string
---@param payload table
---@return table|nil, string|nil
local function persistCapture(job, payload)
    local callbackName = job == 'police' and 'cad:photos:capturePolicePhoto' or 'cad:photos:captureNewsPhoto'
    local response = lib.callback.await(callbackName, false, payload)
    if not response or response.ok ~= true then
        return nil, response and response.error or 'capture_store_failed'
    end

    return response.metadata, nil
end

---@param job string
---@param fovData FovData
---@return nil
local function runCapture(job, fovData)
    local captureConfig, captureConfigErr = getCaptureConfig(false)
    if not captureConfig then
        notify(('Capture config error: %s'):format(captureConfigErr or 'unknown_error'), 'error')
        return
    end

    local imageUrl, uploadProvider, uploadErr = nil, captureConfig.provider, nil
    if captureConfig.mode == 'server_proxy' then
        imageUrl, uploadProvider, uploadErr = requestServerProxyUpload(job)
    else
        imageUrl, uploadErr = requestScreenshotUrl(captureConfig)
    end

    if not imageUrl then
        notify(('Upload failed: %s'):format(uploadErr or 'unknown_error'), 'error')
        return
    end

    local metadata, storeErr = persistCapture(job, {
        url = imageUrl,
        provider = uploadProvider or captureConfig.provider,
        location = fovData.location,
        fov = fovData,
    })

    if not metadata then
        notify(('Save failed: %s'):format(storeErr or 'unknown_error'), 'error')
        return
    end

    notify(('Photo saved: %s'):format(metadata.photoId), 'success')
end

---@return nil
function Photos.CapturePolicePhoto()
    if state.isCapturing then
        return
    end

    state.isCapturing = true
    state.ped = getPed()

    TaskStartScenarioInPlace(state.ped, PHOTO_CONFIG.animations.policeCamera, 0, true)
    local completed = lib.progressBar({
        duration = PHOTO_CONFIG.animations.duration,
        label = 'Focusing camera...',
        useWhileDead = false,
        canCancel = true,
        disable = {
            move = true,
            car = true,
            combat = true,
        },
    })

    if not completed then
        ClearPedTasks(state.ped)
        state.isCapturing = false
        return
    end

    local hit, hitCoords, entity = raycastFromCamera(PHOTO_CONFIG.fov.maxDistance)
    local pedCoords = GetEntityCoords(state.ped)
    local impactCoords = hitCoords or pedCoords

    if hit and hitCoords and PHOTO_CONFIG.fov.showMarker then
        local markerEnd = GetGameTimer() + 1000
        CreateThread(function()
            while GetGameTimer() < markerEnd do
                drawHitMarker(hitCoords)
                Wait(0)
            end
        end)
    end

    runCapture('police', {
        hit = hit,
        hitCoords = hitCoords,
        distance = #(pedCoords - impactCoords),
        entityType = getEntityTypeString(entity),
        location = {
            x = pedCoords.x,
            y = pedCoords.y,
            z = pedCoords.z,
        },
    })

    ClearPedTasks(state.ped)
    state.isCapturing = false
end

---@return nil
function Photos.CaptureNewsPhoto()
    if state.isCapturing then
        return
    end

    state.isCapturing = true
    state.ped = getPed()

    TaskStartScenarioInPlace(state.ped, PHOTO_CONFIG.animations.newsCamera, 0, true)
    local completed = lib.progressBar({
        duration = PHOTO_CONFIG.animations.duration,
        label = 'Taking press photo...',
        useWhileDead = false,
        canCancel = true,
        disable = {
            move = true,
            car = true,
            combat = true,
        },
    })

    if not completed then
        ClearPedTasks(state.ped)
        state.isCapturing = false
        return
    end

    local pedCoords = GetEntityCoords(state.ped)
    runCapture('reporter', {
        hit = false,
        hitCoords = nil,
        distance = 0,
        entityType = nil,
        location = {
            x = pedCoords.x,
            y = pedCoords.y,
            z = pedCoords.z,
        },
    })

    ClearPedTasks(state.ped)
    state.isCapturing = false
end

exports('useNewsCamera', function(_, _)
    Photos.CaptureNewsPhoto()
    return nil
end)

exports('viewPhotoItem', function(data, _)
    local metadata = type(data) == 'table' and data.metadata or nil
    if not metadata or not metadata.photoUrl then
        notify('Invalid photo data', 'error')
        return nil
    end

    SendNUIMessage({
        action = 'photo:view',
        data = {
            url = metadata.photoUrl,
            metadata = metadata,
        },
    })
    return nil
end)

Registry.Register('Photos', Photos)
