local Config = require 'modules.shared.config'
local Utils = require 'modules.shared.utils'
local Registry = require 'modules.shared.registry'

---@param name string
---@param handler fun(data: table): table|nil
---@return nil
local function wrapNui(name, handler)
    RegisterNUICallback(name, function(data, cb)
        local ok, result = pcall(handler, data or {})
        if not ok then
            Utils.Log('error', 'NUI callback %s failed: %s', name, tostring(result))
            cb({ ok = false, error = 'internal_error' })
            return
        end

        if result == nil then
            cb({ ok = false, error = 'no_response' })
            return
        end

        cb(result)
    end)
end

---@param serverEvent string
---@return fun(payload: table): table|nil
local function bridge(serverEvent)
    return function(payload)
        return lib.callback.await(serverEvent, false, payload)
    end
end

wrapNui('getPlayerData', bridge('cad:getPlayerData'))

wrapNui('cad:getUiFeatures', function()
    local function featureEnabled(name)
        return Config.IsFeatureEnabled(name)
    end

    local function featureVisible(name, fallback)
        return Config.IsFeatureVisibleInUI(name)
    end

    local dispatchEnabled = (Config.Dispatch.Enabled ~= false) and featureEnabled('Dispatch')
    local dispatchVisible = dispatchEnabled and featureVisible('Dispatch', true)

    local forensicsEnabled = (Config.ForensicLabs.Enabled ~= false) and featureEnabled('Forensics')
    local forensicsVisible = forensicsEnabled and featureVisible('Forensics', true)

    local newsEnabled = featureEnabled('News')
    local newsVisible = newsEnabled and featureVisible('News', true)

    local emsEnabled = featureEnabled('EMS')
    local emsVisible = emsEnabled and featureVisible('EMS', true)

    local mapEnabled = featureEnabled('Map')
    local mapVisible = mapEnabled and featureVisible('Map', true)

    local radioEnabled = featureEnabled('Radio')
    local radioVisible = radioEnabled and featureVisible('Radio', true)

    local phoneIntelEnabled = GetResourceState('gcphone-next') == 'started'
    local phoneIntelVisible = phoneIntelEnabled and featureVisible('PhoneIntel', true)

    return {
        dispatch = {
            enabled = dispatchEnabled,
            visible = dispatchVisible,
        },
        forensics = {
            enabled = forensicsEnabled,
            visible = forensicsVisible,
        },
        news = {
            enabled = newsEnabled,
            visible = newsVisible,
            publishWithoutConfirm = Config.News and Config.News.PublishWithoutConfirm == true,
        },
        ems = {
            enabled = emsEnabled,
            visible = emsVisible,
        },
        map = {
            enabled = mapEnabled,
            visible = mapVisible,
        },
        radio = {
            enabled = radioEnabled,
            visible = radioVisible,
        },
        phoneIntel = {
            enabled = phoneIntelEnabled,
            visible = phoneIntelVisible,
        },
    }
end)

wrapNui('cad:getCodeCatalog', function()
    return require('shared.catalogs.codes').Get()
end)

wrapNui('cad:getDispatchSettings', function()
    local dispatch = Config.Dispatch or {}
    local callTypeOptions = dispatch.CallTypeOptions
    if type(callTypeOptions) ~= 'table' or #callTypeOptions == 0 then
        callTypeOptions = { 'GENERAL' }
    end

    return {
        callTypeOptions = callTypeOptions,
    }
end)

wrapNui('cad:getComputerContext', function()
    local ClientAction = Registry.Get('Client')
    if ClientAction and ClientAction.GetComputerContext then
        return ClientAction.GetComputerContext()
    end

    return {
        ok = false,
        error = 'computer_context_unavailable',
    }
end)

wrapNui('cad:vehicle:getContext', function()
    local VehicleAction = Registry.Get('Vehicle')
    if VehicleAction and VehicleAction.GetContext then
        return VehicleAction.GetContext()
    end

    return {
        ok = false,
        error = 'vehicle_context_unavailable',
    }
end)

wrapNui('cad:vehicle:getReaderContext', function()
    local VehicleAction = Registry.Get('Vehicle')
    if VehicleAction and VehicleAction.GetReaderContext then
        return VehicleAction.GetReaderContext()
    end

    return {
        ok = false,
        error = 'vehicle_reader_context_unavailable',
    }
end)

wrapNui('cad:vehicle:setOpen', function(payload)
    local VehicleAction = Registry.Get('Vehicle')
    if VehicleAction and VehicleAction.SetTabletOpen then
        return VehicleAction.SetTabletOpen(payload and payload.open == true)
    end

    return {
        ok = false,
        error = 'vehicle_context_unavailable',
    }
end)

wrapNui('cad:vehicle:scanFront', function(payload)
    local VehicleAction = Registry.Get('Vehicle')
    if VehicleAction and VehicleAction.ScanFront then
        return VehicleAction.ScanFront(payload or {})
    end

    return {
        ok = false,
        error = 'scanner_unavailable',
    }
end)

wrapNui('cad:vehicle:playAlert', function(payload)
    local VehicleAction = Registry.Get('Vehicle')
    if VehicleAction and VehicleAction.PlayAlert then
        return VehicleAction.PlayAlert(payload or {})
    end

    return {
        ok = false,
        error = 'alert_unavailable',
    }
end)

local bridgedCallbacks = {
    'cad:lookup:searchPersons',
    'cad:lookup:searchVehicles',
    'cad:phone:lookupByNumber',
    'cad:phone:lookupByImei',
    'cad:phone:setStolenPlaceholder',
    'cad:entityNotes:list',
    'cad:entityNotes:add',
    'cad:vehicle:quickSummary',
    'cad:vehicle:logStop',
    'cad:vehicle:getRecentStops',
    'cad:createCase',
    'cad:getCase',
    'cad:searchCases',
    'cad:updateCase',
    'cad:closeCase',
    'cad:case:printReport',
    'cad:addEvidenceToStaging',
    'cad:getStagingEvidence',
    'cad:removeFromStaging',
    'cad:attachEvidence',
    'cad:getCaseEvidence',
    'cad:evidence:container:list',
    'cad:evidence:container:store',
    'cad:evidence:container:pull',
    'cad:photos:getCaptureConfig',
    'cad:photos:capturePolicePhoto',
    'cad:photos:captureNewsPhoto',
    'cad:photos:getInventoryPhotos',
    'cad:photos:getStagingPhotos',
    'cad:photos:getReleasedPhotos',
    'cad:photos:releaseToPress',
    'cad:photos:submitToPolice',
    'cad:photos:getReviewQueue',
    'cad:photos:reviewSubmission',
    'cad:photos:attachToCase',
    'cad:photos:getPhoto',
    'cad:photos:updateDescription',
    'cad:photos:deletePhoto',
    'cad:news:getArticles',
    'cad:news:published',
    'cad:news:updated',
    'cad:news:expired',
    'cad:news:deleted',
    'cad:registerDispatchUnit',
    'cad:getDispatchUnits',
    'cad:updateUnitStatus',
    'cad:createDispatchCall',
    'cad:getDispatchCalls',
    'cad:assignUnitToCall',
    'cad:unassignUnitFromCall',
    'cad:closeDispatchCall',
    'cad:closeCall',
    'cad:getNearestUnit',
    'cad:setOfficerStatus',
    'cad:getOfficerStatus',
    'cad:cameras:getNextNumber',
    'cad:cameras:list',
    'cad:cameras:get',
    'cad:cameras:setStatus',
    'cad:cameras:remove',
    'cad:police:getJailTransfers',
    'cad:police:logJailTransfer',
    'cad:getFineCatalog',
    'cad:createFine',
    'cad:getFines',
    'cad:payFine',
    'cad:ems:getUnits',
    'cad:ems:getAlerts',
    'cad:ems:createAlert',
    'cad:ems:updateUnit',
    'cad:ems:critical_patient',
    'cad:ems:low_stock',
    'cad:ems:handoff_complete',
    'cad:ems:createBloodRequest',
    'cad:ems:getBloodRequests',
    'cad:ems:updateBloodRequest',
    'cad:forensic:checkInLab',
    'cad:forensic:getPendingEvidence',
    'cad:forensic:analyzeEvidence',
    'cad:forensic:completeAnalysis',
    'cad:forensic:getAnalysisResults',
    'cad:forensic:compareEvidence',
    'cad:forensic:collectEvidence',
    'cad:idreader:read',
    'cad:idreader:listDocuments',
    'cad:idreader:insert',
    'cad:idreader:eject',
    'cad:idreader:getContainer',
    'cad:getCallsign',
    'cad:setCallsign',
}

for _, name in ipairs(bridgedCallbacks) do
    wrapNui(name, bridge(name))
end

wrapNui('cad:dispatch:createCall', bridge('cad:createDispatchCall'))

wrapNui('cad:cameras:watch', function(payload)
    local SecurityCameraAction = Registry.Get('SecurityCamera')
    if SecurityCameraAction and SecurityCameraAction.StartWatch then
        return SecurityCameraAction.StartWatch(payload or {})
    end

    return {
        ok = false,
        error = 'camera_watch_unavailable',
    }
end)
wrapNui('cad:cameras:stopWatch', function()
    local SecurityCameraAction = Registry.Get('SecurityCamera')
    if SecurityCameraAction and SecurityCameraAction.StopWatch then
        return SecurityCameraAction.StopWatch()
    end

    return {
        ok = true,
    }
end)

wrapNui('showNotification', function(data)
    lib.notify({
        title = data.title or 'CAD',
        description = data.message or data.description or '',
        type = data.type or 'inform',
    })
    return { ok = true }
end)

wrapNui('setWaypoint', function(data)
    local x = tonumber(data.x)
    local y = tonumber(data.y)
    if not x or not y then
        return { ok = false, error = 'invalid_coordinates' }
    end

    SetNewWaypoint(x, y)
    return { ok = true }
end)

wrapNui('getCurrentPosition', function()
    local ped = PlayerPedId()
    if not ped or ped == 0 then
        return { ok = false, error = 'player_not_found' }
    end

    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)
    local streetHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)

    return {
        x = coords.x,
        y = coords.y,
        z = coords.z,
        heading = heading,
        street = GetStreetNameFromHashKey(streetHash),
    }
end)
