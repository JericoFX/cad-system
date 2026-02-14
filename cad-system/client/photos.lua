--[[
C.A.D. System - Photo Client
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3

Client-side photo capture with:
- Animation handling
- Raycast for FOV
- Screenshot integration
- Item usage exports
]]

CAD = CAD or {}
CAD.Photos = CAD.Photos or {}

-- Configuration
local Config = {
    Animations = {
        PoliceCamera = 'WORLD_HUMAN_PAPARAZZI',
        NewsCamera = 'WORLD_HUMAN_PAPARAZZI',
        Duration = 2000 -- 2 seconds for focus
    },
    FOV = {
        MaxDistance = 50.0,
        ShowMarker = true,
        MarkerSize = 0.1
    }
}

-- Cache
local cache = {
    ped = nil,
    isCapturing = false
}

-- Raycast from camera (using existing CAD function if available)
local function RayCastFromCamera(distance)
    if CAD.Client and CAD.Client.RayCastGamePlayCamera then
        return CAD.Client.RayCastGamePlayCamera(distance)
    end
    
    -- Fallback implementation
    local cameraRotation = GetGameplayCamRot()
    local cameraCoord = GetGameplayCamCoord()
    
    -- Convert rotation to direction
    local function RotationToDirection(rotation)
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
    
    local direction = RotationToDirection(cameraRotation)
    local destination = {
        x = cameraCoord.x + direction.x * distance,
        y = cameraCoord.y + direction.y * distance,
        z = cameraCoord.z + direction.z * distance
    }
    
    local rayHandle = StartShapeTestRay(
        cameraCoord.x, cameraCoord.y, cameraCoord.z,
        destination.x, destination.y, destination.z,
        -1, cache.ped, 0
    )
    
    local _, hit, hitCoords, _, entityHit = GetShapeTestResult(rayHandle)
    return hit, hitCoords, entityHit
end

-- Get entity type string
local function GetEntityTypeString(entity)
    if not entity or entity == 0 then
        return nil
    end
    
    local entityType = GetEntityType(entity)
    
    if entityType == 1 then
        return 'ped'
    elseif entityType == 2 then
        return 'vehicle'
    elseif entityType == 3 then
        return 'object'
    end
    
    return 'unknown'
end

-- Draw hit marker
local function DrawHitMarker(coords)
    if not Config.FOV.ShowMarker then return end
    
    DrawMarker(
        0, -- marker type
        coords.x, coords.y, coords.z,
        0.0, 0.0, 0.0,
        0.0, 0.0, 0.0,
        Config.FOV.MarkerSize, Config.FOV.MarkerSize, Config.FOV.MarkerSize,
        255, 0, 0, 200, -- red
        false, false, 2,
        false, nil, nil, false
    )
end

-- Show capture preview
local function ShowCapturePreview(imageData)
    -- Send to NUI
    SendNUIMessage({
        action = 'showPhotoPreview',
        data = {
            imageUrl = imageData.url,
            isBase64 = imageData.isBase64 or false,
            location = imageData.location,
            fov = imageData.fov,
            job = imageData.job
        }
    })
    
    -- Set NUI focus
    SetNuiFocus(true, true)
end

-- Police Camera Capture
function CAD.Photos.CapturePolicePhoto()
    if cache.isCapturing then
        return
    end
    
    cache.isCapturing = true
    cache.ped = PlayerPedId()
    
    -- Check if on duty
    if CAD.Client and CAD.Client.IsOnDuty then
        if not CAD.Client.IsOnDuty() then
            ShowNotification('You must be on duty to use the evidence camera', 'error')
            cache.isCapturing = false
            return
        end
    end
    
    -- Animation
    TaskStartScenarioInPlace(cache.ped, Config.Animations.PoliceCamera, 0, true)
    
    -- Progress bar for focus
    if exports and exports['progressbar'] then
        exports['progressbar']:Progress({
            name = 'police_camera_focus',
            duration = Config.Animations.Duration,
            label = 'Focusing camera...',
            useWhileDead = false,
            canCancel = true,
            controlDisables = {
                disableMovement = true,
                disableCarMovement = true,
                disableMouse = false,
                disableCombat = true
            }
        }, function(cancelled)
            if cancelled then
                ClearPedTasks(cache.ped)
                cache.isCapturing = false
                return
            end
            
            -- Perform raycast
            local hit, hitCoords, entity = RayCastFromCamera(Config.FOV.MaxDistance)
            local pedCoords = GetEntityCoords(cache.ped)
            local distance = #(pedCoords - hitCoords)
            
            -- Show marker briefly
            if hit and Config.FOV.ShowMarker then
                local markerEnd = GetGameTimer() + 1000
                Citizen.CreateThread(function()
                    while GetGameTimer() < markerEnd do
                        DrawHitMarker(hitCoords)
                        Wait(0)
                    end
                end)
            end
            
            -- Take screenshot
            TakeScreenshot('police', {
                hit = hit,
                hitCoords = hitCoords,
                distance = distance,
                entityType = GetEntityTypeString(entity),
                location = { x = pedCoords.x, y = pedCoords.y, z = pedCoords.z }
            })
        end)
    else
        -- Fallback without progress bar
        Citizen.Wait(Config.Animations.Duration)
        
        local hit, hitCoords, entity = RayCastFromCamera(Config.FOV.MaxDistance)
        local pedCoords = GetEntityCoords(cache.ped)
        local distance = #(pedCoords - hitCoords)
        
        TakeScreenshot('police', {
            hit = hit,
            hitCoords = hitCoords,
            distance = distance,
            entityType = GetEntityTypeString(entity),
            location = { x = pedCoords.x, y = pedCoords.y, z = pedCoords.z }
        })
    end
end

-- News Camera Capture
function CAD.Photos.CaptureNewsPhoto()
    if cache.isCapturing then
        return
    end
    
    cache.isCapturing = true
    cache.ped = PlayerPedId()
    
    -- Check if on duty as reporter
    if CAD.Client and CAD.Client.IsOnDuty then
        if not CAD.Client.IsOnDuty() then
            ShowNotification('You must be on duty to use the press camera', 'error')
            cache.isCapturing = false
            return
        end
    end
    
    -- Animation
    TaskStartScenarioInPlace(cache.ped, Config.Animations.NewsCamera, 0, true)
    
    -- Progress bar
    if exports and exports['progressbar'] then
        exports['progressbar']:Progress({
            name = 'news_camera_focus',
            duration = Config.Animations.Duration,
            label = 'Taking press photo...',
            useWhileDead = false,
            canCancel = true,
            controlDisables = {
                disableMovement = true,
                disableCarMovement = true,
                disableMouse = false,
                disableCombat = true
            }
        }, function(cancelled)
            if cancelled then
                ClearPedTasks(cache.ped)
                cache.isCapturing = false
                return
            end
            
            local pedCoords = GetEntityCoords(cache.ped)
            
            -- Take screenshot (no FOV for news)
            TakeScreenshot('reporter', {
                hit = false,
                hitCoords = nil,
                distance = 0,
                entityType = nil,
                location = { x = pedCoords.x, y = pedCoords.y, z = pedCoords.z }
            })
        end)
    else
        Citizen.Wait(Config.Animations.Duration)
        
        local pedCoords = GetEntityCoords(cache.ped)
        
        TakeScreenshot('reporter', {
            hit = false,
            hitCoords = nil,
            distance = 0,
            entityType = nil,
            location = { x = pedCoords.x, y = pedCoords.y, z = pedCoords.z }
        })
    end
end

-- Take screenshot and process
function TakeScreenshot(job, fovData)
    cache.ped = PlayerPedId()
    
    -- Try screenshot-basic first
    if exports and exports['screenshot-basic'] then
        exports['screenshot-basic']:requestScreenshotUpload(
            GetWebhookUrl(),
            'files[]',
            function(data)
                -- Clear animation
                ClearPedTasks(cache.ped)
                cache.isCapturing = false
                
                local resp = json.decode(data)
                if resp and resp.attachments and resp.attachments[1] then
                    local imageUrl = resp.attachments[1].proxy_url or resp.attachments[1].url
                    
                    -- Send to server
                    TriggerServerEvent('cad:photos:processCapture', {
                        url = imageUrl,
                        job = job,
                        fov = fovData,
                        location = fovData.location,
                        provider = 'screenshot-basic'
                    })
                    
                    ShowNotification('Photo captured successfully', 'success')
                else
                    ShowNotification('Failed to upload photo', 'error')
                end
            end
        )
    else
        -- Fallback: use game's screenshot
        TriggerEvent('screenshot:basic:requestScreenshot', function(url)
            ClearPedTasks(cache.ped)
            cache.isCapturing = false
            
            if url then
                TriggerServerEvent('cad:photos:processCapture', {
                    url = url,
                    job = job,
                    fov = fovData,
                    location = fovData.location,
                    provider = 'screenshot-basic'
                })
                
                ShowNotification('Photo captured successfully', 'success')
            else
                ShowNotification('Failed to capture photo', 'error')
            end
        end)
    end
end

-- Get webhook URL from config
function GetWebhookUrl()
    -- Try to get from screenshot-basic config
    if Config.PhotoSystem and Config.PhotoSystem.DiscordWebhook then
        return Config.PhotoSystem.DiscordWebhook
    end
    
    -- Fallback
    return ''
end

-- Show notification helper
function ShowNotification(message, type)
    if type == nil then type = 'info' end
    
    if CAD.Client and CAD.Client.ShowNotification then
        CAD.Client.ShowNotification(message, type)
    elseif exports and exports['ox_lib'] then
        exports['ox_lib']:Notify({
            title = 'CAD Photos',
            description = message,
            type = type,
            duration = 5000
        })
    else
        -- Fallback: default GTA notification
        BeginTextCommandThefeedPost('STRING')
        AddTextComponentSubstringPlayerName(message)
        EndTextCommandThefeedPostTicker(false, true)
    end
end

-- Server event: Process capture response
RegisterNetEvent('cad:photos:captureResponse')
AddEventHandler('cad:photos:captureResponse', function(data)
    if data.ok then
        ShowNotification(string.format('Photo saved: %s', data.photoId), 'success')
        
        -- Show preview
        ShowCapturePreview({
            url = data.photoUrl,
            isBase64 = false,
            location = data.metadata.location,
            fov = data.metadata.fov,
            job = data.metadata.job
        })
    else
        ShowNotification(string.format('Failed: %s', data.error or 'unknown error'), 'error')
    end
end)

-- NUI Callbacks
RegisterNUICallback('photoPreview:confirm', function(data, cb)
    -- Add description if provided
    if data.description and data.description ~= '' then
        TriggerServerEvent('cad:photos:addDescription', {
            photoId = data.photoId,
            description = data.description
        })
    end
    
    SetNuiFocus(false, false)
    cb({ ok = true })
end)

RegisterNUICallback('photoPreview:cancel', function(data, cb)
    -- Delete the photo if cancelled
    if data.photoId then
        TriggerServerEvent('cad:photos:deletePhoto', { photoId = data.photoId })
    end
    
    SetNuiFocus(false, false)
    cb({ ok = true })
end)

-- Item usage exports
exports('usePoliceCamera', function(data, slot)
    CAD.Photos.CapturePolicePhoto()
    return nil
end)

exports('useNewsCamera', function(data, slot)
    CAD.Photos.CaptureNewsPhoto()
    return nil
end)

-- View photo item
exports('viewPhotoItem', function(data, slot)
    if data and data.metadata and data.metadata.photoUrl then
        -- Show photo viewer
        SendNUIMessage({
            action = 'viewPhoto',
            data = {
                url = data.metadata.photoUrl,
                metadata = data.metadata
            }
        })
        SetNuiFocus(true, true)
    else
        ShowNotification('Invalid photo data', 'error')
    end
    return nil
end)

-- Print to terminal on load
print('[CAD:Photos] Client photo system initialized')
print('[CAD:Photos] Available exports: usePoliceCamera, useNewsCamera, viewPhotoItem')
