local Utils = require 'modules.shared.utils'

local Core = {}

---@type table|nil
local bridgeCache = nil
---@type string|nil
local frameworkName = nil

---@return table|nil, string|nil
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

---@return string|nil
function Core.GetFramework()
    local _, name = detectBridge()
    return name
end

---@param source integer
---@param fallbackIdentifier string
---@param getCallsignFn function|nil
---@return table|nil
function Core.GetPlayerIdentity(source, fallbackIdentifier, getCallsignFn)
    local bridge = detectBridge()
    if not bridge then return nil end
    return bridge.ResolveIdentity(source, fallbackIdentifier, getCallsignFn)
end

---@param source integer
---@param callsign string
---@return boolean
function Core.SaveCallsign(source, callsign)
    local bridge = detectBridge()
    if not bridge then return false end
    return bridge.SaveCallsign(source, callsign)
end

---@param source integer
---@return number
function Core.GetPlayerMoney(source)
    local bridge = detectBridge()
    if not bridge then return 0 end
    return bridge.GetPlayerMoney(source)
end

---@param source integer
---@param amount number
---@return boolean
function Core.RemoveMoney(source, amount)
    local bridge = detectBridge()
    if not bridge then return false end
    return bridge.RemoveMoney(source, amount)
end

return Core
