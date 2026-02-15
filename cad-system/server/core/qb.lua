--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

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
    local firstName = pd.charinfo and pd.charinfo.firstname or 'Officer'
    local lastName = pd.charinfo and pd.charinfo.lastname or tostring(source)
    local fullName = ('%s %s'):format(firstName, lastName)
    
    -- Check DB first for callsign, then metadata, then fallback
    local callsign = CAD.Officers.GetCallsign(pd.citizenid or fallbackIdentifier)
    if not callsign then
        callsign = (pd.metadata and pd.metadata.callsign)
            or (pd.job and pd.job.grade and ('B-%s'):format(pd.job.grade.level or 0))
    end

    return {
        source = source,
        identifier = pd.citizenid or fallbackIdentifier,
        callsign = callsign or ('B-%s'):format(source),
        name = fullName,
        job = pd.job and pd.job.name or 'police',
        jobLabel = pd.job and pd.job.label or 'Police',
        grade = pd.job and pd.job.grade and pd.job.grade.level or 0,
        isAdmin = CAD.Config.Security.AdminJobs[pd.job and pd.job.name or ''] or false,
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
