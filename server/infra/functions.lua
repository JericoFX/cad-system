

CAD = CAD or {}
CAD.Server = CAD.Server or {}

function CAD.Server.GetFramework()
    return CAD.Core.Server.GetFramework()
end

function CAD.Server.ToIso(ts)
    return os.date('!%Y-%m-%dT%H:%M:%SZ', ts or os.time())
end

function CAD.Server.GenerateId(prefix)
    local clean = (prefix or 'ID'):upper()
    return ('%s_%s_%04d'):format(clean, os.date('%Y%m%d%H%M%S'), math.random(0, 9999))
end

function CAD.Server.SanitizeString(value, maxLen)
    local text = tostring(value or '')
    text = text:gsub('<.->', '')
    text = text:gsub('[\r\n\t]+', ' ')
    text = text:gsub('%s+', ' ')
    text = CAD.StringTrim(text)
    if maxLen and #text > maxLen then
        text = text:sub(1, maxLen)
    end
    return text
end

function CAD.Server.GetIdentifier(source)
    local player = tonumber(source)
    if not player or player <= 0 then
        return nil
    end

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

    if identifiers[1] then
        return identifiers[1]
    end

    return tostring(player)
end

function CAD.Server.GetPlayerIdentity(source)
    local player = tonumber(source)
    if not player or player <= 0 then
        return nil
    end
    local identifier = CAD.Server.GetIdentifier(player)
    return CAD.Core.Server.GetPlayerIdentity(player, identifier)
end

function CAD.Server.IsAllowedJob(job)
    if not job then
        return false
    end
    return CAD.Config.Security.AllowedJobs[job] == true or CAD.Config.Security.AdminJobs[job] == true
end

function CAD.Server.HasRole(source, roles)
    local identity = CAD.Server.GetPlayerIdentity(source)
    if not identity then
        return false
    end

    if identity.isAdmin then
        return true
    end

    if type(roles) == 'string' then
        return identity.job == roles
    end

    if type(roles) == 'table' then
        for i = 1, #roles do
            if identity.job == roles[i] then
                return true
            end
        end
    end

    return false
end

function CAD.Server.Notify(source, message, notificationType)
    TriggerClientEvent('ox_lib:notify', source, {
        title = 'CAD',
        description = message,
        type = notificationType or 'inform',
    })
end

function CAD.Server.NotifyJobs(jobs, message, notificationType)
    local players = GetPlayers()
    for i = 1, #players do
        local source = tonumber(players[i])
        if CAD.Server.HasRole(source, jobs) then
            CAD.Server.Notify(source, message, notificationType)
        end
    end
end

function CAD.Server.BroadcastToJobs(jobs, eventName, data)
    local players = GetPlayers()
    for i = 1, #players do
        local source = tonumber(players[i])
        if CAD.Server.HasRole(source, jobs) then
            TriggerClientEvent('cad:client:' .. eventName, source, data)
        end
    end
end

function CAD.Server.BroadcastToAll(eventName, data)
    TriggerClientEvent('cad:client:' .. eventName, -1, data)
end

function CAD.Server.BroadcastToPlayer(source, eventName, data)
    TriggerClientEvent('cad:client:' .. eventName, source, data)
end

CAD.Server.OfflineQueue = {}

local OFFLINE_QUEUE_MAX_PER_PLAYER = 50
local OFFLINE_QUEUE_TTL_SECONDS = 1800

function CAD.Server.QueueOfflineEvent(playerId, eventName, data)
    if not CAD.Server.OfflineQueue[playerId] then
        CAD.Server.OfflineQueue[playerId] = {}
    end

    local queue = CAD.Server.OfflineQueue[playerId]
    if #queue >= OFFLINE_QUEUE_MAX_PER_PLAYER then
        table.remove(queue, 1)
    end

    queue[#queue + 1] = {
        eventName = eventName,
        data = data,
        timestamp = os.time()
    }
end

function CAD.Server.SendOfflineQueue(playerId, source)
    if CAD.Server.OfflineQueue[playerId] then
        local events = CAD.Server.OfflineQueue[playerId]
        CAD.Server.OfflineQueue[playerId] = nil

        TriggerClientEvent('cad:client:syncOffline', source, {
            events = events
        })
    end
end

CreateThread(function()
    while true do
        Wait(300000)
        local now = os.time()
        for playerId, queue in pairs(CAD.Server.OfflineQueue) do
            for i = #queue, 1, -1 do
                if (now - (queue[i].timestamp or 0)) > OFFLINE_QUEUE_TTL_SECONDS then
                    table.remove(queue, i)
                end
            end
            if #queue == 0 then
                CAD.Server.OfflineQueue[playerId] = nil
            end
        end
    end
end)
