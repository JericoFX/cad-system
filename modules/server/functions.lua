-- modules/server/functions.lua

local Config = require 'modules.shared.config'
local Utils = require 'modules.shared.utils'
local Core = require 'modules.server.core'

local Fn = {}

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

function Fn.GetPlayerIdentity(source)
    local player = tonumber(source)
    if not player or player <= 0 then return nil end
    local identifier = Fn.GetIdentifier(player)
    local Officers = require 'modules.server.officers'
    return Core.GetPlayerIdentity(player, identifier, Officers.GetCallsign)
end

function Fn.IsAllowedJob(job)
    if not job then return false end
    return Config.Security.AllowedJobs[job] == true or Config.Security.AdminJobs[job] == true
end

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

function Fn.Notify(source, message, notificationType)
    TriggerClientEvent('ox_lib:notify', source, {
        title = 'CAD',
        description = message,
        type = notificationType or 'inform',
    })
end

function Fn.NotifyJobs(jobs, message, notificationType)
    local players = GetPlayers()
    for i = 1, #players do
        local src = tonumber(players[i])
        if Fn.HasRole(src, jobs) then
            Fn.Notify(src, message, notificationType)
        end
    end
end

function Fn.BroadcastToJobs(jobs, eventName, data)
    local players = GetPlayers()
    for i = 1, #players do
        local src = tonumber(players[i])
        if Fn.HasRole(src, jobs) then
            TriggerClientEvent('cad:client:' .. eventName, src, data)
        end
    end
end

function Fn.BroadcastToAll(eventName, data)
    TriggerClientEvent('cad:client:' .. eventName, -1, data)
end

function Fn.BroadcastToPlayer(source, eventName, data)
    TriggerClientEvent('cad:client:' .. eventName, source, data)
end

-- Offline queue

local offlineQueue = {}
local OFFLINE_QUEUE_MAX_PER_PLAYER = 50
local OFFLINE_QUEUE_TTL_SECONDS = 1800

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

function Fn.SendOfflineQueue(playerId, source)
    if offlineQueue[playerId] then
        local events = offlineQueue[playerId]
        offlineQueue[playerId] = nil
        TriggerClientEvent('cad:client:syncOffline', source, { events = events })
    end
end

CreateThread(function()
    while true do
        Wait(300000)
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
    end
end)

return Fn
