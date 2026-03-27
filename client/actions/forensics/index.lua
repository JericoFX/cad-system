local Config = require 'modules.shared.config'

local cachedTraces = {}
local textUiVisible = false
local lastTraceRefresh = 0

local function nearbyLab()
    local ped = cache.ped or PlayerPedId()
    if not ped or ped == 0 then return nil end

    local coords = GetEntityCoords(ped)
    for i = 1, #Config.ForensicLabs.Locations do
        local lab = Config.ForensicLabs.Locations[i]
        if #(coords - lab.coords) <= lab.radius then
            return lab
        end
    end
    return nil
end

local function closeTraceTextUi()
    if textUiVisible then
        lib.hideTextUI()
        textUiVisible = false
    end
end

local function refreshNearbyTraces(force)
    local now = GetGameTimer()
    if not force and now - lastTraceRefresh < 1300 then
        return
    end

    lastTraceRefresh = now
    local response = lib.callback.await('cad:forensic:getNearbyWorldTraces', false, {})
    if response and response.ok and type(response.traces) == 'table' then
        cachedTraces = response.traces
    else
        cachedTraces = {}
    end
end

local function getNearestTrace()
    local ped = cache.ped or PlayerPedId()
    if not ped or ped == 0 then
        return nil
    end

    local coords = GetEntityCoords(ped)
    local nearest = nil
    local nearestDistance = 99999.0

    for i = 1, #cachedTraces do
        local trace = cachedTraces[i]
        if trace.coords and trace.coords.x and trace.coords.y and trace.coords.z then
            local traceCoords = vector3(trace.coords.x, trace.coords.y, trace.coords.z)
            local distance = #(coords - traceCoords)
            if distance < nearestDistance then
                nearest = trace
                nearestDistance = distance
            end
        end
    end

    if nearest then
        nearest.distance = nearestDistance
    end

    return nearest
end

local function bagNearestTrace(trace)
    local defaultType = tostring(trace.evidenceType or 'DNA'):upper()
    local input = lib.inputDialog('Bag Evidence', {
        {
            type = 'input',
            label = 'Bag Label',
            description = 'Example: Scene-A Door Handle',
            required = true,
            min = 2,
            max = 120,
        },
        {
            type = 'select',
            label = 'Evidence Type',
            default = defaultType,
            options = {
                { value = 'DNA', label = 'DNA' },
                { value = 'BLOOD', label = 'Blood' },
                { value = 'FINGERPRINT', label = 'Fingerprint' },
                { value = 'CASING', label = 'Casing' },
                { value = 'BULLET', label = 'Bullet' },
                { value = 'FIBERS', label = 'Fibers' },
                { value = 'PHOTO', label = 'Photo' },
                { value = 'PHYSICAL', label = 'Physical' },
            },
        },
        {
            type = 'input',
            label = 'Case ID (optional)',
            required = false,
            max = 64,
        },
        {
            type = 'textarea',
            label = 'Notes (optional)',
            required = false,
            max = 800,
        },
    })

    if not input then
        return
    end

    local response = lib.callback.await('cad:forensic:bagWorldTrace', false, {
        traceId = trace.traceId,
        bagLabel = input[1],
        evidenceType = input[2] or defaultType,
        caseId = input[3],
        notes = input[4],
    })

    if not response or not response.ok then
        lib.notify({ title = 'CAD Forensics', description = ('Cannot bag evidence: %s'):format(response and response.error or 'unknown_error'), type = 'error' })
        return
    end

    lib.notify({
        title = 'CAD Forensics',
        description = ('Bagged trace %s -> %s'):format(trace.traceId, response.staging and response.staging.stagingId or 'STAGE'),
        type = 'success',
    })

    refreshNearbyTraces(true)
end

RegisterCommand('forensiclab', function()
    if not Config.IsFeatureEnabled('Forensics') then
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

CreateThread(function()
    while true do
        if not Config.IsFeatureEnabled('Forensics') then
            closeTraceTextUi()
            Wait(1500)
        else
            refreshNearbyTraces(false)
            local traceCount = #cachedTraces
            local nearest = traceCount > 0 and getNearestTrace() or nil
            local interactRadius = tonumber(Config.Forensics.WorldTraceInteractRadius) or 1.8

            if nearest and nearest.distance and nearest.distance <= interactRadius then
                if not textUiVisible then
                    lib.showTextUI(('[E] Bag %s | %.1fm'):format(tostring(nearest.evidenceType or 'TRACE'), nearest.distance), {
                        position = 'left-center',
                    })
                    textUiVisible = true
                end

                if IsControlJustReleased(0, 38) then
                    closeTraceTextUi()
                    bagNearestTrace(nearest)
                end

                Wait(0)
            elseif traceCount > 0 then
                closeTraceTextUi()
                Wait(400)
            else
                closeTraceTextUi()
                Wait(1000)
            end
        end
    end
end)

RegisterCommand('forensictrace', function()
    if Config.Debug ~= true then
        lib.notify({ title = 'CAD', description = 'Debug disabled', type = 'error' })
        return
    end

    local input = lib.inputDialog('Debug Trace', {
        { type = 'input', label = 'Evidence Type', required = true, default = 'DNA' },
        { type = 'input', label = 'Description', required = false },
    })

    if not input then
        return
    end

    local response = lib.callback.await('cad:forensic:debugCreateTrace', false, {
        evidenceType = input[1],
        description = input[2],
    })

    if response and response.ok then
        lib.notify({ title = 'CAD', description = ('Trace created: %s'):format(response.trace.traceId), type = 'success' })
        refreshNearbyTraces(true)
    else
        lib.notify({ title = 'CAD', description = ('Canot create trace: %s'):format(response and response.error or 'unknown_error'), type = 'error' })
    end
end, false)
