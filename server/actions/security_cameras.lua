local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'

State.SecurityCameras = State.SecurityCameras or {
    Cameras = {},
    LastNumber = 0,
}

local cameraState = State.SecurityCameras
cameraState.Cameras = cameraState.Cameras or {}
cameraState.LastNumber = tonumber(cameraState.LastNumber) or 0

local cameras = cameraState.Cameras

local function clone(value)
    return lib.table.deepclone(value)
end

local function getConfig()
    return Config.SecurityCameras or {}
end

local function isDispatchFeatureEnabled()
    if Config.IsFeatureEnabled then
        return Config.IsFeatureEnabled('Dispatch')
    end

    return true
end

local function isSecurityCameraFeatureEnabled()
    if Config.IsFeatureEnabled then
        return Config.IsFeatureEnabled('SecurityCameras')
    end

    return true
end

local function isCameraSystemEnabled()
    local config = getConfig()
    if config.Enabled == false then
        return false
    end

    return isDispatchFeatureEnabled() and isSecurityCameraFeatureEnabled()
end

local function getAllowedJobs()
    local config = getConfig()
    if type(config.AllowedJobs) == 'table' then
        return config.AllowedJobs
    end

    return {
        police = true,
        sheriff = true,
        dispatch = true,
        admin = true,
    }
end

local function canUseCameraSystem(officer)
    if not officer then
        return false
    end

    if officer.isAdmin then
        return true
    end

    local job = tostring(officer.job or ''):lower()
    if job == '' then
        return false
    end

    return getAllowedJobs()[job] == true
end

local function getBroadcastJobs()
    local jobs = {}
    for jobName, enabled in pairs(getAllowedJobs()) do
        if enabled == true then
            jobs[#jobs + 1] = tostring(jobName)
        end
    end

    if #jobs == 0 then
        return { 'police', 'sheriff', 'dispatch', 'admin' }
    end

    return jobs
end

local function withCameraGuard(bucket, handler)
    return Auth.WithGuard(bucket, function(source, payload, officer)
        if not isCameraSystemEnabled() then
            return {
                ok = false,
                error = 'security_camera_disabled',
            }
        end

        if not canUseCameraSystem(officer) then
            return {
                ok = false,
                error = 'forbidden',
            }
        end

        return handler(source, payload or {}, officer)
    end)
end

local function normalizeNumber(value, min, max, fallback)
    local parsed = tonumber(value)
    if not parsed then
        return fallback
    end

    if parsed < min then
        return min
    end

    if parsed > max then
        return max
    end

    return parsed
end

local function parseVector3(raw, maxAbs)
    if type(raw) ~= 'table' then
        return nil
    end

    local x = tonumber(raw.x)
    local y = tonumber(raw.y)
    local z = tonumber(raw.z)
    if not x or not y or not z then
        return nil
    end

    if math.abs(x) > maxAbs or math.abs(y) > maxAbs or math.abs(z) > maxAbs then
        return nil
    end

    return {
        x = x,
        y = y,
        z = z,
    }
end

local function cameraToClient(camera)
    return {
        cameraId = camera.cameraId,
        cameraNumber = camera.cameraNumber,
        label = camera.label,
        street = camera.street,
        crossStreet = camera.crossStreet,
        zone = camera.zone,
        coords = clone(camera.coords),
        rotation = clone(camera.rotation),
        fov = camera.fov,
        status = camera.status,
        installedBy = camera.installedBy,
        installedByName = camera.installedByName,
        createdAt = camera.createdAt,
        updatedAt = camera.updatedAt,
    }
end

local function getCameraList()
    local list = {}
    for _, camera in pairs(cameras) do
        list[#list + 1] = cameraToClient(camera)
    end

    table.sort(list, function(a, b)
        if a.cameraNumber ~= b.cameraNumber then
            return (a.cameraNumber or 0) < (b.cameraNumber or 0)
        end

        return tostring(a.cameraId or '') < tostring(b.cameraId or '')
    end)

    return list
end

local function saveCameraDb(camera)
    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_security_cameras (
                camera_id,
                camera_number,
                label,
                street,
                cross_street,
                zone_name,
                coords,
                rotation,
                fov,
                status,
                installed_by,
                installed_by_name,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                label = VALUES(label),
                street = VALUES(street),
                cross_street = VALUES(cross_street),
                zone_name = VALUES(zone_name),
                coords = VALUES(coords),
                rotation = VALUES(rotation),
                fov = VALUES(fov),
                status = VALUES(status),
                updated_at = VALUES(updated_at)
        ]], {
            camera.cameraId,
            camera.cameraNumber,
            camera.label,
            camera.street,
            camera.crossStreet,
            camera.zone,
            json.encode(camera.coords),
            json.encode(camera.rotation),
            camera.fov,
            camera.status,
            camera.installedBy,
            camera.installedByName,
            camera.createdAt,
            camera.updatedAt,
        })
    end)

    if not ok then
        Utils.Log('error', 'Failed saving camera %s: %s', tostring(camera and camera.cameraId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

local function deleteCameraDb(cameraId)
    local ok, err = pcall(function()
        MySQL.query.await('DELETE FROM cad_security_cameras WHERE camera_id = ?', {
            cameraId,
        })
    end)

    if not ok then
        Utils.Log('error', 'Failed deleting camera %s: %s', tostring(cameraId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

lib.callback.register('cad:cameras:getNextNumber', withCameraGuard('default', function()
    return {
        ok = true,
        nextNumber = (tonumber(cameraState.LastNumber) or 0) + 1,
    }
end))

lib.callback.register('cad:cameras:list', withCameraGuard('default', function()
    return {
        ok = true,
        cameras = getCameraList(),
    }
end))

lib.callback.register('cad:cameras:get', withCameraGuard('default', function(_, payload)
    local cameraId = Fn.SanitizeString(payload.cameraId, 64)
    if cameraId == '' then
        return {
            ok = false,
            error = 'camera_id_required',
        }
    end

    local camera = cameras[cameraId]
    if not camera then
        return {
            ok = false,
            error = 'camera_not_found',
        }
    end

    return {
        ok = true,
        camera = cameraToClient(camera),
    }
end))

lib.callback.register('cad:cameras:install', withCameraGuard('heavy', function(_, payload, officer)
    local coords = parseVector3(payload.coords, 100000.0)
    if not coords then
        return {
            ok = false,
            error = 'invalid_coords',
        }
    end

    local rotation = parseVector3(payload.rotation, 1000.0)
    if not rotation then
        return {
            ok = false,
            error = 'invalid_rotation',
        }
    end

    local config = getConfig()
    local minFov = tonumber(config.MinFov) or 20.0
    local maxFov = tonumber(config.MaxFov) or 90.0
    local defaultFov = tonumber(config.DefaultFov) or 55.0
    local fov = normalizeNumber(payload.fov, minFov, maxFov, defaultFov)

    local previousLastNumber = tonumber(cameraState.LastNumber) or 0
    local nextNumber = previousLastNumber + 1
    local label = Fn.SanitizeString(payload.label, 128)
    if label == '' then
        label = ('Camera %04d'):format(nextNumber)
    end

    local now = Utils.ToIso()
    local camera = {
        cameraId = Utils.GenerateId('CAM'),
        cameraNumber = nextNumber,
        label = label,
        street = Fn.SanitizeString(payload.street, 128),
        crossStreet = Fn.SanitizeString(payload.crossStreet, 128),
        zone = Fn.SanitizeString(payload.zone, 128),
        coords = coords,
        rotation = {
            x = normalizeNumber(rotation.x, -89.9, 89.9, 0.0),
            y = normalizeNumber(rotation.y, -89.9, 89.9, 0.0),
            z = normalizeNumber(rotation.z, -360.0, 360.0, 0.0),
        },
        fov = fov,
        status = 'ACTIVE',
        installedBy = officer.identifier,
        installedByName = officer.name,
        createdAt = now,
        updatedAt = now,
    }

    cameraState.LastNumber = nextNumber

    local saved, saveErr = saveCameraDb(camera)
    if not saved then
        cameraState.LastNumber = previousLastNumber
        return {
            ok = false,
            error = saveErr or 'db_write_failed',
        }
    end

    cameras[camera.cameraId] = camera

    Fn.BroadcastToJobs(
        getBroadcastJobs(),
        'cameraCreated',
        {
            camera = cameraToClient(camera),
        }
    )

    return {
        ok = true,
        camera = cameraToClient(camera),
    }
end))

lib.callback.register('cad:cameras:setStatus', withCameraGuard('heavy', function(_, payload)
    local cameraId = Fn.SanitizeString(payload.cameraId, 64)
    if cameraId == '' then
        return {
            ok = false,
            error = 'camera_id_required',
        }
    end

    local camera = cameras[cameraId]
    if not camera then
        return {
            ok = false,
            error = 'camera_not_found',
        }
    end

    local status = tostring(payload.status or ''):upper()
    if status ~= 'ACTIVE' and status ~= 'DISABLED' then
        return {
            ok = false,
            error = 'invalid_status',
        }
    end

    if camera.status == status then
        return {
            ok = true,
            camera = cameraToClient(camera),
        }
    end

    local previousStatus = camera.status
    local previousUpdatedAt = camera.updatedAt

    camera.status = status
    camera.updatedAt = Utils.ToIso()

    local saved, saveErr = saveCameraDb(camera)
    if not saved then
        camera.status = previousStatus
        camera.updatedAt = previousUpdatedAt
        return {
            ok = false,
            error = saveErr or 'db_write_failed',
        }
    end

    Fn.BroadcastToJobs(
        getBroadcastJobs(),
        'cameraUpdated',
        {
            camera = cameraToClient(camera),
        }
    )

    return {
        ok = true,
        camera = cameraToClient(camera),
    }
end))

lib.callback.register('cad:cameras:remove', withCameraGuard('heavy', function(_, payload)
    local cameraId = Fn.SanitizeString(payload.cameraId, 64)
    if cameraId == '' then
        return {
            ok = false,
            error = 'camera_id_required',
        }
    end

    local camera = cameras[cameraId]
    if not camera then
        return {
            ok = false,
            error = 'camera_not_found',
        }
    end

    local deleted, deleteErr = deleteCameraDb(cameraId)
    if not deleted then
        return {
            ok = false,
            error = deleteErr or 'db_write_failed',
        }
    end

    cameras[cameraId] = nil

    Fn.BroadcastToJobs(
        getBroadcastJobs(),
        'cameraRemoved',
        {
            cameraId = cameraId,
        }
    )

    return {
        ok = true,
        cameraId = cameraId,
    }
end))
