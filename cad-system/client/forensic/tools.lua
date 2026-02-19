CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Tools = CAD.Forensic.Tools or {}

local function hasItem(itemName)
    if GetResourceState('ox_inventory') ~= 'started' then
        return false
    end

    return exports.ox_inventory:Search('count', itemName) > 0
end

local function getPed()
    return cache.ped or PlayerPedId()
end

local function showProgress(duration, label, anim)
    return CAD.Progress.Run({
        duration = duration,
        label = label,
        useWhileDead = false,
        canCancel = true,
        disable = {
            car = true,
            move = true,
            combat = true,
        },
        anim = anim or {
            dict = 'amb@prop_human_parking_meter@interact',
            clip = 'idle_a',
        },
    })
end

local function useForensicKit()
    lib.notify({
        title = 'Forensics',
        description = 'Use UV, powder, tape, or peroxide for specific actions',
        type = 'inform',
    })
end

local function useUVFlashlight()
    if not hasItem('uv_flashlight') then
        lib.notify({ title = 'Forensics', description = 'You need a UV flashlight', type = 'error' })
        return
    end

    local ped = getPed()
    local coords = GetEntityCoords(ped)
    local success = showProgress(5000, 'Scanning with UV light...', {
        dict = 'anim@amb@clubhouse@tutorial@bkr_tut_ig3',
        clip = 'machinic_loop_mechandplayer',
    })

    if not success then
        return
    end

    TriggerServerEvent('cad:forensic:reveal', 'blood', coords, 2.0)
    lib.notify({ title = 'Forensics', description = 'Blood evidence revealed', type = 'success' })
end

local function useFingerprintPowder()
    if not hasItem('fingerprint_powder') then
        lib.notify({ title = 'Forensics', description = 'You need fingerprint powder', type = 'error' })
        return
    end

    local success = showProgress(5000, 'Dusting surface...', {
        dict = 'anim@amb@business@weed@weed_inspecting_lo_med_hi',
        clip = 'weed_squat_over_inspect_loop_aggressive',
    })

    if not success then
        return
    end

    TriggerServerEvent('cad:forensic:reveal', 'fingerprint', GetEntityCoords(getPed()), 1.5)
    lib.notify({ title = 'Forensics', description = 'Fingerprints revealed', type = 'success' })
end

local function useFingerprintTape()
    if not hasItem('fingerprint_tape') then
        lib.notify({ title = 'Forensics', description = 'You need fingerprint tape', type = 'error' })
        return
    end

    local success = showProgress(8000, 'Lifting fingerprint...', {
        dict = 'anim@amb@business@weed@weed_inspecting_lo_med_hi',
        clip = 'weed_squat_over_inspect_loop_aggressive',
    })

    if not success then
        return
    end

    TriggerServerEvent('cad:forensic:collect', 'fingerprint', GetEntityCoords(getPed()), 1.5)
    lib.notify({ title = 'Forensics', description = 'Fingerprint collected', type = 'success' })
end

local function useHydrogenPeroxide()
    if not hasItem('hydrogen_peroxide') then
        lib.notify({ title = 'Forensics', description = 'You need hydrogen peroxide', type = 'error' })
        return
    end

    local success = showProgress(3000, 'Cleaning blood...', {
        dict = 'missheistdockssetup1clipboard@idle_a',
        clip = 'idle_a',
    })

    if not success then
        return
    end

    TriggerServerEvent('cad:forensic:destroy', 'blood', GetEntityCoords(getPed()), 1.0)
    lib.notify({ title = 'Forensics', description = 'Blood evidence destroyed', type = 'success' })
end

exports('useForensicKit', useForensicKit)
exports('useUVFlashlight', useUVFlashlight)
exports('useFingerprintPowder', useFingerprintPowder)
exports('useFingerprintTape', useFingerprintTape)
exports('useHydrogenPeroxide', useHydrogenPeroxide)
