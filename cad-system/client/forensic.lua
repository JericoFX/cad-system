CAD = CAD or {}
CAD.ForensicClient = CAD.ForensicClient or {}

local function nearbyLab()
    local ped = PlayerPedId()
    if not ped or ped == 0 then return nil end

    local coords = GetEntityCoords(ped)
    for i = 1, #CAD.Config.ForensicLabs.Locations do
        local lab = CAD.Config.ForensicLabs.Locations[i]
        if #(coords - lab.coords) <= lab.radius then
            return lab
        end
    end
    return nil
end

RegisterCommand('forensiclab', function()
    if CAD.IsFeatureEnabled and not CAD.IsFeatureEnabled('Forensics') then
        lib.notify({ title = 'CAD', description = 'Forensics module is disabled', type = 'error' })
        return
    end

    local lab = nearbyLab()
    if not lab then
        lib.notify({ title = 'CAD', description = 'You are not inside a forensic lab', type = 'error' })
        return
    end

    local result = lib.callback.await('cad:forensic:checkInLab', false, {})
    if not result or not result.inLab then
        lib.notify({ title = 'CAD', description = 'Access denied for this lab', type = 'error' })
        return
    end

    lib.notify({
        title = 'CAD Forensics',
        description = ('Lab ready: %s'):format(lab.name),
        type = 'inform',
    })
end, false)
