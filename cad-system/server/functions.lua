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
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
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
