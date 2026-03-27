local Core = {}

local bridgeCache = nil
local frameworkName = nil

local function detectBridge()
    if bridgeCache then return bridgeCache, frameworkName end

    if GetResourceState('qb-core') == 'started' then
        local qb = require 'modules.client.bridges.qbcore'
        if qb.IsAvailable() then
            bridgeCache = qb
            frameworkName = 'qbcore'
            return bridgeCache, frameworkName
        end
    end

    if GetResourceState('es_extended') == 'started' then
        local esx = require 'modules.client.bridges.esx'
        if esx.IsAvailable() then
            bridgeCache = esx
            frameworkName = 'esx'
            return bridgeCache, frameworkName
        end
    end

    return nil, nil
end

function Core.GetFramework()
    local _, name = detectBridge()
    return name
end

function Core.RegisterAccessEvents(refreshAccess)
    local bridge = detectBridge()
    if bridge then
        bridge.RegisterAccessEvents(refreshAccess)
    end
end

return Core
