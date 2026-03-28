local Config = require 'modules.shared.config'
local Utils = require 'modules.shared.utils'
local Core = require 'modules.server.core'

local Fn = {}

---@param source integer
---@return string|nil
function Fn.GetIdentifier(source)
    local player = tonumber(source)
    if not player or player <= 0 then return nil end

    local identifiers = GetPlayerIdentifiers(player)
    local preferredPrefixes = { 'license2:', 'license:', 'fivem:', 'steam:' }

    for i = 1, #preferredPrefixes do
        local prefix = preferredPrefixes[i]
        for j = 1, #identifiers do
            local identifier = identifiers[j]
            if identifier:sub(1, #prefix) == prefix then
                return identifier
            end
        end
    end

    if identifiers[1] then return identifiers[1] end
    return tostring(player)
end

---@param source integer
---@return table|nil
function Fn.GetPlayerIdentity(source)
    local player = tonumber(source)
    if not player or player <= 0 then return nil end
    local identifier = Fn.GetIdentifier(player)
    local Officers = require 'modules.server.officers'
    return Core.GetPlayerIdentity(player, identifier, Officers.GetCallsign)
end

---@param job string|nil
---@return boolean
function Fn.IsAllowedJob(job)
    if not job then return false end
    return Config.Security.AllowedJobs[job] == true or Config.Security.AdminJobs[job] == true
end

---@param source integer
---@param roles string|string[]
---@return boolean
function Fn.HasRole(source, roles)
    local identity = Fn.GetPlayerIdentity(source)
    if not identity then return false end
    if identity.isAdmin then return true end

    if type(roles) == 'string' then return identity.job == roles end
    if type(roles) == 'table' then
        for i = 1, #roles do
            if identity.job == roles[i] then return true end
        end
    end
    return false
end

---@param value any
---@param maxLen integer|nil
---@return string
function Fn.SanitizeString(value, maxLen)
    local text = tostring(value or '')
    text = text:gsub('<.->', '')
    text = text:gsub('[\r\n\t]+', ' ')
    text = text:gsub('%s+', ' ')
    text = Utils.Trim(text)
    if maxLen and #text > maxLen then
        text = text:sub(1, maxLen)
    end
    return text
end

---@param source integer
---@param message string
---@param notificationType string|nil
function Fn.Notify(source, message, notificationType)
    TriggerClientEvent('ox_lib:notify', source, {
        title = 'CAD',
        description = message,
        type = notificationType or 'inform',
    })
end

---@param jobs string|string[]
---@param message string
---@param notificationType string|nil
function Fn.NotifyJobs(jobs, message, notificationType)
    local players = GetPlayers()
    for i = 1, #players do
        local src = tonumber(players[i])
        if Fn.HasRole(src, jobs) then
            Fn.Notify(src, message, notificationType)
        end
    end
end

---@param jobs string|string[]
---@param eventName string
---@param data any
function Fn.BroadcastToJobs(jobs, eventName, data)
    local players = GetPlayers()
    for i = 1, #players do
        local src = tonumber(players[i])
        if Fn.HasRole(src, jobs) then
            TriggerClientEvent('cad:client:' .. eventName, src, data)
        end
    end
end

---@param eventName string
---@param data any
function Fn.BroadcastToAll(eventName, data)
    TriggerClientEvent('cad:client:' .. eventName, -1, data)
end

---@param source integer
---@param eventName string
---@param data any
function Fn.BroadcastToPlayer(source, eventName, data)
    TriggerClientEvent('cad:client:' .. eventName, source, data)
end

---@type table<integer, table[]>
local offlineQueue = {}
---@type integer
local OFFLINE_QUEUE_MAX_PER_PLAYER = 50
---@type integer
local OFFLINE_QUEUE_TTL_SECONDS = 1800

---@param playerId integer
---@param eventName string
---@param data any
function Fn.QueueOfflineEvent(playerId, eventName, data)
    if not offlineQueue[playerId] then
        offlineQueue[playerId] = {}
    end
    local queue = offlineQueue[playerId]
    if #queue >= OFFLINE_QUEUE_MAX_PER_PLAYER then
        table.remove(queue, 1)
    end
    queue[#queue + 1] = {
        eventName = eventName,
        data = data,
        timestamp = os.time()
    }
end

---@param playerId integer
---@param source integer
function Fn.SendOfflineQueue(playerId, source)
    if offlineQueue[playerId] then
        local events = offlineQueue[playerId]
        offlineQueue[playerId] = nil
        TriggerClientEvent('cad:client:syncOffline', source, { events = events })
    end
end

lib.cron.new('*/5 * * * *', function()
    local now = os.time()
    for playerId, queue in pairs(offlineQueue) do
        for i = #queue, 1, -1 do
            if (now - (queue[i].timestamp or 0)) > OFFLINE_QUEUE_TTL_SECONDS then
                table.remove(queue, i)
            end
        end
        if #queue == 0 then
            offlineQueue[playerId] = nil
        end
    end
end)

return Fn
