local Utils = require 'modules.shared.utils'

local Core = {}

local bridgeCache = nil
local frameworkName = nil

local function detectBridge()
    if bridgeCache then return bridgeCache, frameworkName end

    if GetResourceState('qb-core') == 'started' then
        local qb = require 'modules.server.bridges.qbcore'
        if qb.IsAvailable() then
            bridgeCache = qb
            frameworkName = 'qbcore'
            Utils.Log('info', 'Framework detected: QBCore')
            return bridgeCache, frameworkName
        end
    end

    if GetResourceState('es_extended') == 'started' then
        local esx = require 'modules.server.bridges.esx'
        if esx.IsAvailable() then
            bridgeCache = esx
            frameworkName = 'esx'
            Utils.Log('info', 'Framework detected: ESX')
            return bridgeCache, frameworkName
        end
    end

    Utils.Log('error', 'No supported framework detected (qb-core or es_extended)')
    return nil, nil
end

function Core.GetFramework()
    local _, name = detectBridge()
    return name
end

function Core.GetPlayerIdentity(source, fallbackIdentifier, getCallsignFn)
    local bridge = detectBridge()
    if not bridge then return nil end
    return bridge.ResolveIdentity(source, fallbackIdentifier, getCallsignFn)
end

function Core.SaveCallsign(source, callsign)
    local bridge = detectBridge()
    if not bridge then return false end
    return bridge.SaveCallsign(source, callsign)
end

function Core.GetPlayerMoney(source)
    local bridge = detectBridge()
    if not bridge then return 0 end
    return bridge.GetPlayerMoney(source)
end

function Core.RemoveMoney(source, amount)
    local bridge = detectBridge()
    if not bridge then return false end
    return bridge.RemoveMoney(source, amount)
end

return Core
