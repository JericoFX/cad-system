CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Server = CAD.Core.Server or {}

CAD.Core.Server.ESX = {}

function CAD.Core.Server.ESX.GetObject()
    local ok, obj = pcall(function()
        return exports['es_extended']:getSharedObject()
    end)

    if ok and obj then
        return obj
    end

    return nil
end

function CAD.Core.Server.ESX.IsAvailable()
    if GetResourceState('es_extended') ~= 'started' then
        return false
    end

    return CAD.Core.Server.ESX.GetObject() ~= nil
end

function CAD.Core.Server.ESX.ResolveIdentity(source, fallbackIdentifier)
    local esx = CAD.Core.Server.ESX.GetObject()
    if not esx then
        return nil
    end

    local xPlayer = esx.GetPlayerFromId(source)
    if not xPlayer then
        return nil
    end

    local name = xPlayer.getName and xPlayer.getName() or GetPlayerName(source)
    local job = xPlayer.job and xPlayer.job.name or 'police'
    local grade = xPlayer.job and xPlayer.job.grade or 0
    local identifier = fallbackIdentifier

    if xPlayer.getIdentifier then
        identifier = xPlayer.getIdentifier()
    end

    if not identifier then
        identifier = xPlayer.identifier or xPlayer.license or fallbackIdentifier
    end

    return {
        source = source,
        identifier = identifier,
        callsign = ('B-%s'):format(source),
        name = name,
        job = job,
        jobLabel = xPlayer.job and xPlayer.job.label or job,
        grade = grade,
        isAdmin = CAD.Config.Security.AdminJobs[job] or false,
    }
end
