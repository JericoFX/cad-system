--[[
CAD Forensic - Tools System
Handles UV flashlight, fingerprint powder, and other forensic tool interactions
]]

CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Tools = {}

-- Helper to check inventory
local function hasItem(itemName)
    return exports.ox_inventory:Search('count', itemName) > 0
end

-- Helper to play progress bar
local function showProgress(duration, label, anim)
    return lib.progressBar({
        duration = duration,
        label = label,
        useWhileDead = false,
        canCancel = true,
        disable = {
            car = true,
            move = true,
            combat = true
        },
        anim = anim or {
            dict = 'amb@prop_human_parking_meter@interact',
            clip = 'idle_a'
        }
    })
end

-- UV Flashlight functionality
exports('useUVFlashlight', function()
    if not hasItem('uv_flashlight') then
        lib.notify({ title = 'Forensics', description = 'You need a UV flashlight', type = 'error' })
        return
    end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    local lightPos = coords + (forward * 1.5)

    local toolConfig = CAD.EvidenceTypes.GetTool('uv_flashlight')

    local duration = 5000

    -- Create UV light
    local light = CreateLight(
        lightPos.x, lightPos.y, lightPos.z,
        0, 255, 255, -- Cyan color
        toolConfig.range,
        toolConfig.intensity,
        0, 1, 0
    )

    SetLightFadeDistance(light, toolConfig.range)

    -- Show progress
    local success = showProgress(duration, 'Scanning with UV light...', {
        dict = 'anim@amb@clubhouse@tutorial@bkr_tut_ig3',
        clip = 'machinic_loop_mechandplayer'
    })

    -- Cleanup
    RemoveLight(light)
    
    if success then
        -- Trigger blood reveal in range
        TriggerServerEvent('cad:forensic:reveal', 'blood', coords, toolConfig.range)
        lib.notify({ title = 'Forensics', description = 'Blood evidence revealed', type = 'success' })
    end
end)

-- Fingerprint Powder functionality
exports('useFingerprintPowder', function()
    if not hasItem('fingerprint_powder') then
        lib.notify({ title = 'Forensics', description = 'You need fingerprint powder', type = 'error' })
        return
    end

    local toolConfig = CAD.EvidenceTypes.GetTool('fingerprint_powder')
    local duration = 5000

    -- Show progress
    local success = showProgress(duration, 'Dusting surface...', {
        dict = 'anim@amb@business@weed@weed_inspecting_lo_med_hi',
        clip = 'weed_squat_over_inspect_loop_aggressive'
    })

    
    if success then
        -- Consume powder
        exports.ox_inventory:RemoveItem('fingerprint_powder', 1)
        lib.notify({ title = 'Forensics', description = 'Fingerprints revealed', type = 'success' })
        
        -- Trigger fingerprint reveal
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        TriggerServerEvent('cad:forensic:reveal', 'fingerprint', coords, 1.5)
    end
end)

-- Fingerprint Tape functionality
exports('useFingerprintTape', function()
    if not hasItem('fingerprint_tape') then
        lib.notify({ title = 'Forensics', description = 'You need fingerprint tape', type = 'error' })
        return
    end

    local toolConfig = CAD.EvidenceTypes.GetTool('fingerprint_tape')
    local duration = 8000

    -- Show progress
    local success = showProgress(duration, 'Lifting fingerprint...', {
        dict = 'anim@amb@business@weed@weed_inspecting_lo_med_hi',
        clip = 'weed_squat_over_inspect_loop_aggressive'
    })
    
    if success then
        -- Consume tape
        exports.ox_inventory:RemoveItem('fingerprint_tape', 1)
        lib.notify({ title = 'Forensics', description = 'Fingerprint collected', type = 'success' })
        
        -- Trigger fingerprint collection
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        TriggerServerEvent('cad:forensic:collect', 'fingerprint', coords, 1.5)
    end
end)

-- Hydrogen Peroxide functionality
exports('useHydrogenPeroxide', function()
    if not hasItem('hydrogen_peroxide') then
        lib.notify({ title = 'Forensics', description = 'You need hydrogen peroxide', type = 'error' })
        return
    end

    local toolConfig = CAD.EvidenceTypes.GetTool('hydrogen_peroxide')
    local duration = 3000

    -- Show progress
    local success = showProgress(duration, 'Cleaning blood...', {
        dict = 'missheistdockssetup1clipboard@idle_a',
        clip = 'idle_a'
    })
    
    if success then
        -- Consume item
        exports.ox_inventory:RemoveItem('hydrogen_peroxide', 1)
        lib.notify({ title = 'Forensics', description = 'Blood evidence destroyed', type = 'success' })
        
        -- Trigger blood destruction
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        TriggerServerEvent('cad:forensic:destroy', 'blood', coords, 1.0)
    end
end)

-- Register item exports
CreateThread(function()
    exports('cad-system.useUVFlashlight', function() exports('useUVFlashlight') end)
    exports('cad-system.useFingerprintPowder', function() exports('useFingerprintPowder') end)
    exports('cad-system.useFingerprintTape', function() exports('useFingerprintTape') end)
    exports('cad-system.useHydrogenPeroxide', function() exports('useHydrogenPeroxide') end)
end)