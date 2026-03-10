

CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Server = CAD.Core.Server or {}

CAD.Core.Server.QB = {}

function CAD.Core.Server.QB.GetObject()
    local ok, obj = pcall(function()
        return exports['qb-core']:GetCoreObject()
    end)

    if ok and obj then
        return obj
    end

    return nil
end

function CAD.Core.Server.QB.IsAvailable()
    if GetResourceState('qb-core') ~= 'started' then
        return false
    end

    return CAD.Core.Server.QB.GetObject() ~= nil
end

function CAD.Core.Server.QB.ResolveIdentity(source, fallbackIdentifier)
    local qb = CAD.Core.Server.QB.GetObject()
    if not qb then
        return nil
    end

    local qbPlayer = qb.Functions.GetPlayer(source)
    if not qbPlayer or not qbPlayer.PlayerData then
        return nil
    end

    local pd = qbPlayer.PlayerData
    local metadata = type(pd.metadata) == 'table' and pd.metadata or {}
    local jobData = type(pd.job) == 'table' and pd.job or {}
    local gradeData = type(jobData.grade) == 'table' and jobData.grade or {}
    local firstName = pd.charinfo and pd.charinfo.firstname or 'Officer'
    local lastName = pd.charinfo and pd.charinfo.lastname or tostring(source)
    local fullName = ('%s %s'):format(firstName, lastName)

    local callsign = CAD.Officers and CAD.Officers.GetCallsign and CAD.Officers.GetCallsign(pd.citizenid or fallbackIdentifier)
    if not callsign then
        callsign = metadata.callsign or ('B-%s'):format(gradeData.level or 0)
    end

    local jobName = jobData.name or ''

    return {
        source = source,
        identifier = pd.citizenid or fallbackIdentifier,
        callsign = callsign or ('B-%s'):format(source),
        name = fullName,
        job = jobName,
        jobLabel = jobData.label or 'Unknown',
        grade = gradeData.level or 0,
        isAdmin = ((CAD.Config and CAD.Config.Security and CAD.Config.Security.AdminJobs) or {})[jobName] or false,
    }
end

function CAD.Core.Server.QB.SaveCallsign(source, callsign)
    local qb = CAD.Core.Server.QB.GetObject()
    if not qb then
        return false
    end

    local qbPlayer = qb.Functions.GetPlayer(source)
    if not qbPlayer then
        return false
    end

    qbPlayer.Functions.SetMetaData('callsign', callsign)
    return true
end
