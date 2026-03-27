local Config = require 'modules.shared.config'
local ClientFn = require 'modules.client.functions'
local Registry = require 'modules.shared.registry'

local SecurityCamera = {}

local state = {
    installing = false,
    watchCam = nil,
    watchCameraId = nil,
}

local function getCameraConfig()
    return Config.SecurityCameras or {}
end

local function notify(message, nType)
    lib.notify({
        title = 'Security Cameras',
        description = message,
        type = nType or 'inform',
    })
end

local function canUseCameraSystem()
    local response = lib.callback.await('cad:getPlayerData', false, {})
    if not response then
        return false, 'player_data_unavailable'
    end

    if response.ok == false then
        return false, response.error or 'not_authorized'
    end

    if response.isAdmin == true then
        return true
    end

    local job = tostring(response.job or ''):lower()
    local allowedJobs = getCameraConfig().AllowedJobs or {}
    if allowedJobs[job] ~= true then
        return false, 'forbidden'
    end

    return true
end

local function normalizeRaycastHit(hit)
    if type(hit) == 'boolean' then
        return hit
    end

    if type(hit) == 'number' then
        return hit == 1
    end

    return false
end

local function getInstallPoint()
    local config = getCameraConfig()
    local maxDistance = tonumber(config.MaxInstallDistance) or 12.0

    lib.showTextUI('[E] Confirm install point  [BACKSPACE] Cancel', {
        position = 'left-center',
    })

    while true do
        Wait(0)

        local hit, _, endCoords, surfaceNormal = lib.raycast.fromCamera(511, 4, maxDistance)
        local hasHit = normalizeRaycastHit(hit)

        if hasHit and endCoords and endCoords.x and endCoords.y and endCoords.z then
            DrawMarker(
                28,
                endCoords.x,
                endCoords.y,
                endCoords.z,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                0.04,
                0.04,
                0.04,
                255,
                255,
                0,
                180,
                false,
                false,
                2,
                false,
                nil,
                nil,
                false
            )

            if IsControlJustReleased(0, 38) then
                lib.hideTextUI()
                return {
                    coords = {
                        x = endCoords.x,
                        y = endCoords.y,
                        z = endCoords.z,
                    },
                    surfaceNormal = surfaceNormal and {
                        x = surfaceNormal.x,
                        y = surfaceNormal.y,
                        z = surfaceNormal.z,
                    } or nil,
                }
            end
        end

        if IsControlJustReleased(0, 177) or IsControlJustReleased(0, 194) then
            lib.hideTextUI()
            return nil
        end
    end
end

local function computeInitialYaw(surfaceNormal)
    if type(surfaceNormal) == 'table' and surfaceNormal.x and surfaceNormal.y then
        return GetHeadingFromVector_2d(-surfaceNormal.x, -surfaceNormal.y)
    end

    local camRot = GetGameplayCamRot(2)
    return tonumber(camRot.z) or 0.0
end

local function adjustCameraPlacement(hitData)
    local config = getCameraConfig()
    local minFov = tonumber(config.MinFov) or 20.0
    local maxFov = tonumber(config.MaxFov) or 90.0
    local defaultFov = tonumber(config.DefaultFov) or 55.0
    local rotationSpeed = tonumber(config.RotationSpeed) or 45.0
    local pitchMin = tonumber(config.PitchMin) or -80.0
    local pitchMax = tonumber(config.PitchMax) or 25.0

    local camRot = GetGameplayCamRot(2)
    local yaw = computeInitialYaw(hitData.surfaceNormal)
    local pitch = math.max(pitchMin, math.min(pitchMax, tonumber(camRot.x) or 0.0))
    local fov = defaultFov

    local offsetX = 0.0
    local offsetY = 0.0
    local offsetZ = 0.0
    if hitData.surfaceNormal then
        offsetX = (tonumber(hitData.surfaceNormal.x) or 0.0) * 0.02
        offsetY = (tonumber(hitData.surfaceNormal.y) or 0.0) * 0.02
        offsetZ = (tonumber(hitData.surfaceNormal.z) or 0.0) * 0.02
    end

    local cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    if not cam or cam == 0 then
        return nil
    end

    local cameraPos = {
        x = hitData.coords.x + offsetX,
        y = hitData.coords.y + offsetY,
        z = hitData.coords.z + offsetZ,
    }

    local previewObject = nil
    local modelName = tostring(config.PlacementModel or 'prop_cctv_cam_01a')
    local modelHash = joaat(modelName)
    if modelHash and modelHash ~= 0 then
        local requested = pcall(function()
            lib.requestModel(modelHash, 3000)
        end)

        if requested then
            previewObject = CreateObjectNoOffset(
                modelHash,
                hitData.coords.x,
                hitData.coords.y,
                hitData.coords.z,
                false,
                false,
                false
            )
            if previewObject and previewObject ~= 0 then
                SetEntityCollision(previewObject, false, false)
                SetEntityAlpha(previewObject, 180, false)
                FreezeEntityPosition(previewObject, true)
            end
            SetModelAsNoLongerNeeded(modelHash)
        end
    end

    SetCamCoord(cam, cameraPos.x, cameraPos.y, cameraPos.z)
    SetCamRot(cam, pitch, 0.0, yaw, 2)
    SetCamFov(cam, fov)
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 250, true, false)

    lib.showTextUI('[A/D] Yaw  [W/S] Pitch  [Scroll] Zoom  [E] Save  [BACKSPACE] Cancel', {
        position = 'left-center',
    })

    local confirmed = false

    while true do
        Wait(0)

        local frameRotation = rotationSpeed * GetFrameTime()
        if IsControlPressed(0, 34) then
            yaw = yaw + frameRotation
        end
        if IsControlPressed(0, 35) then
            yaw = yaw - frameRotation
        end
        if IsControlPressed(0, 32) then
            pitch = math.max(pitchMin, pitch - frameRotation)
        end
        if IsControlPressed(0, 33) then
            pitch = math.min(pitchMax, pitch + frameRotation)
        end

        if IsControlJustPressed(0, 241) then
            fov = math.max(minFov, fov - 1.0)
        end
        if IsControlJustPressed(0, 242) then
            fov = math.min(maxFov, fov + 1.0)
        end

        SetCamRot(cam, pitch, 0.0, yaw, 2)
        SetCamFov(cam, fov)

        if previewObject and previewObject ~= 0 then
            SetEntityRotation(previewObject, pitch, 0.0, yaw + 180.0, 2, true)
        end

        DrawMarker(
            0,
            hitData.coords.x,
            hitData.coords.y,
            hitData.coords.z,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            0.08,
            0.08,
            0.08,
            255,
            255,
            255,
            180,
            false,
            false,
            2,
            false,
            nil,
            nil,
            false
        )

        if IsControlJustReleased(0, 38) then
            confirmed = true
            break
        end

        if IsControlJustReleased(0, 177) or IsControlJustReleased(0, 194) then
            break
        end
    end

    lib.hideTextUI()
    RenderScriptCams(false, true, 250, true, false)
    DestroyCam(cam, false)

    if previewObject and previewObject ~= 0 then
        DeleteEntity(previewObject)
    end

    if not confirmed then
        return nil
    end

    return {
        rotation = {
            x = pitch,
            y = 0.0,
            z = yaw,
        },
        fov = fov,
    }
end

local function buildAddress(coords)
    local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    local street = streetHash and GetStreetNameFromHashKey(streetHash) or ''
    local crossStreet = ''

    if crossingHash and crossingHash ~= 0 then
        crossStreet = GetStreetNameFromHashKey(crossingHash)
    end

    if street == '' then
        street = ClientFn.GetStreetName(coords) or ''
    end

    local zone = ClientFn.GetZoneName(coords) or ''

    local display = street
    if display == '' then
        display = 'Unknown street'
    end

    if crossStreet ~= '' then
        display = ('%s / %s'):format(display, crossStreet)
    end

    if zone ~= '' then
        display = ('%s [%s]'):format(display, zone)
    end

    return {
        street = street,
        crossStreet = crossStreet,
        zone = zone,
        display = display,
    }
end

local function getCameraNumberPreview()
    local result = lib.callback.await('cad:cameras:getNextNumber', false, {})
    if not result or result.ok ~= true then
        return nil
    end

    return tonumber(result.nextNumber)
end

local function installSecurityCamera()
    if state.installing then
        notify('Installation already in progress', 'error')
        return
    end

    if state.watchCam then
        notify('Stop active camera view before installing a new one', 'error')
        return
    end

    local allowed, errorCode = canUseCameraSystem()
    if not allowed then
        notify(('Access denied (%s)'):format(tostring(errorCode or 'forbidden')), 'error')
        return
    end

    state.installing = true

    local hitData = getInstallPoint()
    if not hitData then
        state.installing = false
        notify('Installation cancelled', 'inform')
        return
    end

    local placement = adjustCameraPlacement(hitData)
    if not placement then
        state.installing = false
        notify('Installation cancelled during camera alignment', 'inform')
        return
    end

    local address = buildAddress(hitData.coords)
    local previewNumber = getCameraNumberPreview()
    local cameraNumberText = previewNumber and string.format('%04d', previewNumber) or '----'

    local confirm = lib.alertDialog({
        header = 'Install Security Camera',
        content = ('**Camera #%s**\nAddress: **%s**\n\nSave this CCTV node to the CAD dispatch grid?'):format(
            cameraNumberText,
            address.display
        ),
        centered = true,
        cancel = true,
        labels = {
            cancel = 'Cancel',
            confirm = 'Install',
        },
    })

    if confirm ~= 'confirm' then
        state.installing = false
        notify('Installation cancelled', 'inform')
        return
    end

    local payload = {
        coords = hitData.coords,
        rotation = placement.rotation,
        fov = placement.fov,
        street = address.street,
        crossStreet = address.crossStreet,
        zone = address.zone,
        label = previewNumber and ('Camera %04d'):format(previewNumber) or 'Security Camera',
    }

    local response = lib.callback.await('cad:cameras:install', false, payload)
    state.installing = false

    if not response or response.ok ~= true or not response.camera then
        notify(('Installation failed: %s'):format(tostring(response and response.error or 'unknown_error')), 'error')
        return
    end

    notify(
        ('Camera #%04d installed at %s'):format(
            tonumber(response.camera.cameraNumber) or 0,
            response.camera.street ~= '' and response.camera.street or address.display
        ),
        'success'
    )
end

local function stopWatchInternal()
    if state.watchCam and state.watchCam ~= 0 then
        RenderScriptCams(false, true, 250, true, false)
        DestroyCam(state.watchCam, false)
    end

    state.watchCam = nil
    state.watchCameraId = nil

    SendNUIMessage({
        action = 'camera:viewStopped',
        data = {
            timestamp = GetGameTimer(),
        },
    })
end

local function startWatchInternal(camera)
    if not camera or type(camera) ~= 'table' then
        return false, 'camera_not_found'
    end

    local coords = camera.coords
    local rotation = camera.rotation
    if type(coords) ~= 'table' or type(rotation) ~= 'table' then
        return false, 'camera_missing_transform'
    end

    stopWatchInternal()

    local cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    if not cam or cam == 0 then
        return false, 'camera_create_failed'
    end

    SetCamCoord(cam, tonumber(coords.x) or 0.0, tonumber(coords.y) or 0.0, tonumber(coords.z) or 0.0)
    SetCamRot(
        cam,
        tonumber(rotation.x) or 0.0,
        tonumber(rotation.y) or 0.0,
        tonumber(rotation.z) or 0.0,
        2
    )
    SetCamFov(cam, tonumber(camera.fov) or (tonumber(getCameraConfig().DefaultFov) or 55.0))
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 250, true, false)

    state.watchCam = cam
    state.watchCameraId = camera.cameraId

    SendNUIMessage({
        action = 'camera:viewStarted',
        data = {
            camera = camera,
        },
    })

    return true
end

function SecurityCamera.StartWatch(payload)
    local cameraId = payload and tostring(payload.cameraId or '') or ''
    if cameraId == '' then
        return {
            ok = false,
            error = 'camera_id_required',
        }
    end

    local response = lib.callback.await('cad:cameras:get', false, {
        cameraId = cameraId,
    })

    if not response or response.ok ~= true or not response.camera then
        return {
            ok = false,
            error = response and response.error or 'camera_not_found',
        }
    end

    local camera = response.camera
    if tostring(camera.status or ''):upper() ~= 'ACTIVE' then
        return {
            ok = false,
            error = 'camera_disabled',
        }
    end

    local ok, err = startWatchInternal(camera)
    if not ok then
        return {
            ok = false,
            error = err or 'camera_view_failed',
        }
    end

    return {
        ok = true,
        camera = camera,
    }
end

function SecurityCamera.StopWatch()
    stopWatchInternal()
    return {
        ok = true,
    }
end

exports('useSecurityCamera', function(data)
    local _ = data
    installSecurityCamera()
    return nil
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    if state.installing then
        lib.hideTextUI()
        state.installing = false
    end

    stopWatchInternal()
end)

Registry.Register('SecurityCamera', SecurityCamera)
