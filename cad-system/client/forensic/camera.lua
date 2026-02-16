--[[
CAD Forensic - Camera System
Handles evidence photography with FOV, DOF, and flash effects
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Camera = {
    active = false,
    fov = 50.0,
    focusDistance = 5.0,
    flashActive = false,
    camera = nil
}

local function getCameraConfig()
    return CAD.EvidenceTypes.Tools.camera.features
end

local function isNightTime()
    local hour = GetClockHours()
    return hour < 6 or hour > 20
end

local function createFlashLight()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    local lightPos = coords + (forward * 1.0)


    local config = getCameraConfig()
    local flash = config.flash

    if not flash.enabled or (flash.nightOnly and not isNightTime()) then
        return nil
    end

    return CreateLight(
        lightPos.x, lightPos.y, lightPos.z,
        255, 255, 255,
        flash.range,
        flash.intensity,
        0, 1, 0
    )
end

local function takePhoto()
    local config = getCameraConfig()
    local photoData = {
        fov = CAD.Forensic.Camera.fov,
        focus = CAD.Forensic.Camera.focusDistance,
        timestamp = os.date('!%Y-%m-%dT%H:%M:%SZ'),
        coords = GetEntityCoords(PlayerPedId()),
        officer = CAD.Auth.GetOfficerData(PlayerId()),
        metadata = {}
    }

    -- Add GPS metadata
    if config.metadata.gps then
        photoData.metadata.gps = {
            x = photoData.coords.x,
            y = photoData.coords.y,
            z = photoData.coords.z
        }
    end

    -- Add timestamp metadata
    if config.metadata.timestamp then
        photoData.metadata.timestamp = photoData.timestamp
    end

    -- Add officer metadata
    if config.metadata.officer then
        photoData.metadata.officer = photoData.officer
    end

    -- Create flash effect
    local flash = createFlashLight()
    if flash then
        CAD.Forensic.Camera.flashActive = true
        Wait(500)
        RemoveLight(flash)
        CAD.Forensic.Camera.flashActive = false
    end

    -- Take screenshot
    lib.progressBar({
        duration = config.duration or 2000,
        label = 'Taking photo...',
        useWhileDead = false,
        canCancel = true,
        disable = {
            car = true,
            move = true,
            combat = true
        },
        anim = {
            dict = 'amb@world_human_tourist_map@male@base',
            clip = 'base'
        }
    })

    exports['screenshot-basic']:RequestScreenshotUpload(
        'https://your-webhook-url',
        'discord',
        function(data)
            local res = json.decode(data)
            if res and res.attachments and res.attachments[1] and res.attachments[1].url then
                -- Add to evidence
                viewerActions.openImage(res.attachments[1].url, 'Evidence Photo')
                TriggerServerEvent('cad:forensic:addEvidence', {
                    type = 'photo',
                    url = res.attachments[1].url,
                    data = photoData
                })
            end
        end
    )
end

local function updateCamera()
    if not CAD.Forensic.Camera.active then return end

    -- Update FOV
    SetGameplayCamFov(CAD.Forensic.Camera.fov)


    -- Update DOF
    if getCameraConfig().dof.enabled then
        SetPedDeepFoveation(CAD.Forensic.Camera.focusDistance)
    end
end

-- Main camera loop
CreateThread(function()
    while true do
        Wait(0)

        if CAD.Forensic.Camera.active then
            updateCamera()

            -- FOV adjustment
            if IsControlJustPressed(0, 241) then -- Scroll Up
                CAD.Forensic.Camera.fov = math.min(CAD.Forensic.Camera.fov + 5.0, getCameraConfig().fov.max)
            elseif IsControlJustPressed(0, 242) then -- Scroll Down
                CAD.Forensic.Camera.fov = math.max(CAD.Forensic.Camera.fov - 5.0, getCameraConfig().fov.min)
            end

            -- Focus adjustment
            if IsControlPressed(0, 22) then -- Ctrl
                if IsControlJustPressed(0, 241) then -- Scroll Up
                    CAD.Forensic.Camera.focusDistance = math.min(CAD.Forensic.Camera.focusDistance + 0.5, getCameraConfig().dof.maxFocus)
                elseif IsControlJustPressed(0, 242) then -- Scroll Down
                    CAD.Forensic.Camera.focusDistance = math.max(CAD.Forensic.Camera.focusDistance - 0.5, getCameraConfig().dof.minFocus)
                end
            end

            -- Take photo
            if IsControlJustPressed(0, 51) then -- E
                takePhoto()
            end

            -- Exit camera
            if IsControlJustPressed(0, 177) then -- Backspace
                CAD.Forensic.Camera.active = false
                RenderScriptCams(false, false, 0, false, false)
                SetPedDeepFoveation(0.0)
                SetGameplayCamFov(getCameraConfig().fov.default)
            end

            -- Draw HUD
            DrawRect(0.5, 0.95, 0.2, 0.05, 0, 0, 0, 150)
            DrawText(('FOV: %.0f | FOCUS: %.1f'):format(
                CAD.Forensic.Camera.fov,
                CAD.Forensic.Camera.focusDistance
            ), 0.5, 0.95, 0.35, 0.35)
        end
    end
end)

-- Camera activation
exports('usePoliceCamera', function()
    if not CAD.Forensic.Camera.active then
        CAD.Forensic.Camera.active = true
        CAD.Forensic.Camera.fov = getCameraConfig().fov.default
        CAD.Forensic.Camera.focusDistance = getCameraConfig().dof.default
        RenderScriptCams(true, false, 0, false, false)
        lib.notify({
            title = 'Camera',
            description = 'Camera activated - E to take photo, Scroll to adjust FOV, Ctrl+Scroll for focus',
            type = 'inform'
        })
    end
end)

-- Register export
CreateThread(function()
    exports('cad-system.usePoliceCamera', function() exports('usePoliceCamera') end)
end)