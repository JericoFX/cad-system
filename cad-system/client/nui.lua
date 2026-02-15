--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

local function wrapNui(name, handler)
    RegisterNUICallback(name, function(data, cb)
        local ok, result = pcall(handler, data or {})
        if not ok then
            CAD.Log('error', 'NUI callback %s failed: %s', name, tostring(result))
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

local function bridge(serverEvent)
    return function(payload)
        return lib.callback.await(serverEvent, false, payload)
    end
end

wrapNui('getPlayerData', bridge('cad:getPlayerData'))

wrapNui('cad:getUiFeatures', function()
    local function featureEnabled(name)
        if CAD.IsFeatureEnabled then
            return CAD.IsFeatureEnabled(name)
        end
        return true
    end

    local function featureVisible(name, fallback)
        if CAD.IsFeatureVisibleInUI then
            return CAD.IsFeatureVisibleInUI(name)
        end
        return fallback
    end

    local dispatchEnabled = (CAD.Config.Dispatch.Enabled ~= false) and featureEnabled('Dispatch')
    local dispatchVisible = dispatchEnabled and featureVisible('Dispatch', true)

    local forensicsEnabled = (CAD.Config.ForensicLabs.Enabled ~= false) and featureEnabled('Forensics')
    local forensicsVisible = forensicsEnabled and featureVisible('Forensics', true)

    local newsEnabled = featureEnabled('News')
    local newsVisible = newsEnabled and featureVisible('News', true)

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
        },
    }
end)

wrapNui('cad:getCodeCatalog', function()
    if CAD.GetCodeCatalog then
        return CAD.GetCodeCatalog()
    end

    return {
        tenCodes = {},
        priorityCodes = {},
        caseTypes = {},
        statusCodes = {},
    }
end)

wrapNui('cad:getDispatchSettings', function()
    local dispatch = CAD.Config.Dispatch or {}
    local sla = dispatch.SLA or {}
    local pending = sla.Pending or {}
    local active = sla.Active or {}
    local autoAssign = dispatch.AutoAssignment or {}
    local servicePenalties = autoAssign.ServicePenalties or {}

    local function clampNumber(value, fallback, minimum, maximum)
        local num = tonumber(value) or fallback
        if num < minimum then
            return minimum
        end
        if num > maximum then
            return maximum
        end
        return math.floor(num)
    end

    local function buildThresholds(baseWarning, baseBreach)
        local warning = clampNumber(baseWarning, 4, 1, 999)
        local breach = clampNumber(baseBreach, warning + 1, warning + 1, 999)
        return {
            warningMinutes = {
                p1 = math.max(1, warning - 1),
                p2 = warning,
                p3 = warning + 1,
                default = warning,
            },
            breachMinutes = {
                p1 = math.max(2, breach - 1),
                p2 = breach,
                p3 = breach + 1,
                default = breach,
            },
        }
    end

    local easy = dispatch.Easy or {}
    local easyPresets = easy.Presets or {}
    local defaultPresetName = tostring(easy.Preset or 'standard'):lower()
    local resolvedPresetName = defaultPresetName
    local preset = easyPresets[resolvedPresetName] or easyPresets.standard or {}

    local easyRefreshIntervalMs = clampNumber(preset.refreshIntervalMs, 8000, 1000, 60000)
    local easyClockTickMs = clampNumber(preset.clockTickMs, 15000, 1000, 60000)

    local pendingThresholds = buildThresholds(
        preset.pendingWarningMinutes,
        preset.pendingBreachMinutes
    )
    local activeThresholds = buildThresholds(
        preset.activeWarningMinutes,
        preset.activeBreachMinutes
    )

    local advancedPendingWarning = pending.WarningMinutes
    local advancedPendingBreach = pending.BreachMinutes
    local advancedActiveWarning = active.WarningMinutes
    local advancedActiveBreach = active.BreachMinutes

    local function resolvedThresholdMap(advanced, fallback)
        if type(advanced) ~= 'table' then
            return fallback
        end

        return {
            p1 = clampNumber(advanced.p1, fallback.p1, 1, 999),
            p2 = clampNumber(advanced.p2, fallback.p2, 1, 999),
            p3 = clampNumber(advanced.p3, fallback.p3, 1, 999),
            default = clampNumber(advanced.default, fallback.default, 1, 999),
        }
    end

    local resolvedPendingWarning = resolvedThresholdMap(advancedPendingWarning, pendingThresholds.warningMinutes)
    local resolvedPendingBreach = resolvedThresholdMap(advancedPendingBreach, pendingThresholds.breachMinutes)
    local resolvedActiveWarning = resolvedThresholdMap(advancedActiveWarning, activeThresholds.warningMinutes)
    local resolvedActiveBreach = resolvedThresholdMap(advancedActiveBreach, activeThresholds.breachMinutes)

    local resolvedRefreshIntervalMs = clampNumber(dispatch.RefreshIntervalMs, easyRefreshIntervalMs, 1000, 60000)
    local resolvedClockTickMs = clampNumber(dispatch.ClockTickMs, easyClockTickMs, 1000, 60000)

    local resolvedAutoAssignEnabled = autoAssign.Enabled
    if resolvedAutoAssignEnabled == nil then
        resolvedAutoAssignEnabled = preset.autoAssignEnabled
    end
    if resolvedAutoAssignEnabled == nil then
        resolvedAutoAssignEnabled = true
    end

    local resolvedCallTypeOptions = dispatch.CallTypeOptions
    if type(resolvedCallTypeOptions) ~= 'table' or #resolvedCallTypeOptions == 0 then
        resolvedCallTypeOptions = { 'GENERAL', '10-31', '10-50', '10-71', 'MEDICAL' }
    end

    return {
        profileName = resolvedPresetName,
        refreshIntervalMs = resolvedRefreshIntervalMs,
        clockTickMs = resolvedClockTickMs,
        callTypeOptions = resolvedCallTypeOptions,
        sla = {
            enabled = sla.Enabled ~= false,
            pending = {
                warningMinutes = resolvedPendingWarning,
                breachMinutes = resolvedPendingBreach,
            },
            active = {
                warningMinutes = resolvedActiveWarning,
                breachMinutes = resolvedActiveBreach,
            },
        },
        autoAssignment = {
            enabled = resolvedAutoAssignEnabled == true,
            distanceMetersPerPenaltyPoint = clampNumber(autoAssign.DistanceMetersPerPenaltyPoint, 70, 1, 10000),
            unknownDistancePenalty = clampNumber(autoAssign.UnknownDistancePenalty, 15, 0, 1000),
            servicePenalties = {
                needsEmsButNotEms = clampNumber(servicePenalties.NeedsEmsButNotEms, 40, 0, 1000),
                nonMedicalEms = clampNumber(servicePenalties.NonMedicalEms, 25, 0, 1000),
            },
        },
    }
end)

wrapNui('cad:getComputerContext', function()
    if CAD.Client.GetComputerContext then
        return CAD.Client.GetComputerContext()
    end

    return {
        ok = false,
        error = 'computer_context_unavailable',
    }
end)

-- Cases
wrapNui('cad:createCase', bridge('cad:createCase'))
wrapNui('cad:getCase', bridge('cad:getCase'))
wrapNui('cad:searchCases', bridge('cad:searchCases'))
wrapNui('cad:updateCase', bridge('cad:updateCase'))
wrapNui('cad:closeCase', bridge('cad:closeCase'))

-- Evidence
wrapNui('cad:addEvidenceToStaging', bridge('cad:addEvidenceToStaging'))
wrapNui('cad:getStagingEvidence', bridge('cad:getStagingEvidence'))
wrapNui('cad:removeFromStaging', bridge('cad:removeFromStaging'))
wrapNui('cad:attachEvidence', bridge('cad:attachEvidence'))
wrapNui('cad:getCaseEvidence', bridge('cad:getCaseEvidence'))

-- Dispatch
wrapNui('cad:registerDispatchUnit', bridge('cad:registerDispatchUnit'))
wrapNui('cad:getDispatchUnits', bridge('cad:getDispatchUnits'))
wrapNui('cad:updateUnitStatus', bridge('cad:updateUnitStatus'))
wrapNui('cad:createDispatchCall', bridge('cad:createDispatchCall'))
wrapNui('cad:getDispatchCalls', bridge('cad:getDispatchCalls'))
wrapNui('cad:assignUnitToCall', bridge('cad:assignUnitToCall'))
wrapNui('cad:unassignUnitFromCall', bridge('cad:unassignUnitFromCall'))
wrapNui('cad:closeDispatchCall', bridge('cad:closeDispatchCall'))
wrapNui('cad:closeCall', bridge('cad:closeCall'))
wrapNui('cad:getNearestUnit', bridge('cad:getNearestUnit'))
wrapNui('cad:setOfficerStatus', bridge('cad:setOfficerStatus'))
wrapNui('cad:getOfficerStatus', bridge('cad:getOfficerStatus'))

-- Police
wrapNui('cad:police:getJailTransfers', bridge('cad:police:getJailTransfers'))
wrapNui('cad:police:logJailTransfer', bridge('cad:police:logJailTransfer'))

-- Fines
wrapNui('cad:getFineCatalog', bridge('cad:getFineCatalog'))
wrapNui('cad:createFine', bridge('cad:createFine'))
wrapNui('cad:getFines', bridge('cad:getFines'))
wrapNui('cad:payFine', bridge('cad:payFine'))

-- EMS
wrapNui('cad:ems:getUnits', bridge('cad:ems:getUnits'))
wrapNui('cad:ems:getAlerts', bridge('cad:ems:getAlerts'))
wrapNui('cad:ems:createAlert', bridge('cad:ems:createAlert'))
wrapNui('cad:ems:updateUnit', bridge('cad:ems:updateUnit'))
wrapNui('cad:ems:critical_patient', bridge('cad:ems:critical_patient'))
wrapNui('cad:ems:low_stock', bridge('cad:ems:low_stock'))
wrapNui('cad:ems:handoff_complete', bridge('cad:ems:handoff_complete'))
wrapNui('cad:ems:createBloodRequest', bridge('cad:ems:createBloodRequest'))
wrapNui('cad:ems:getBloodRequests', bridge('cad:ems:getBloodRequests'))
wrapNui('cad:ems:updateBloodRequest', bridge('cad:ems:updateBloodRequest'))

-- Forensics
wrapNui('cad:forensic:checkInLab', bridge('cad:forensic:checkInLab'))
wrapNui('cad:forensic:getPendingEvidence', bridge('cad:forensic:getPendingEvidence'))
wrapNui('cad:forensic:analyzeEvidence', bridge('cad:forensic:analyzeEvidence'))
wrapNui('cad:forensic:completeAnalysis', bridge('cad:forensic:completeAnalysis'))
wrapNui('cad:forensic:getAnalysisResults', bridge('cad:forensic:getAnalysisResults'))
wrapNui('cad:forensic:compareEvidence', bridge('cad:forensic:compareEvidence'))
wrapNui('cad:forensic:collectEvidence', bridge('cad:forensic:collectEvidence'))

-- ID Reader
wrapNui('cad:idreader:read', bridge('cad:idreader:read'))

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

-- Callsign
wrapNui('cad:getCallsign', bridge('cad:getCallsign'))
wrapNui('cad:setCallsign', bridge('cad:setCallsign'))
