--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Server = CAD.Core.Server or {}

CAD.Core.Server.QBox = {}

function CAD.Core.Server.QBox.GetObject()
    if GetResourceState('qbx_core') ~= 'started' then
        return nil
    end

    return true
end

function CAD.Core.Server.QBox.IsAvailable()
    return GetResourceState('qbx_core') == 'started'
end

local function getGradeLevel(job)
    if not job or not job.grade then
        return 0
    end

    if type(job.grade) == 'table' then
        return tonumber(job.grade.level) or tonumber(job.grade.grade) or 0
    end

    return tonumber(job.grade) or 0
end

function CAD.Core.Server.QBox.ResolveIdentity(source, fallbackIdentifier)
    local ok, qbxPlayer = pcall(function()
        return exports['qbx_core']:GetPlayer(source)
    end)

    if not ok or not qbxPlayer or not qbxPlayer.PlayerData then
        return nil
    end

    local pd = qbxPlayer.PlayerData
    local firstName = pd.charinfo and pd.charinfo.firstname or 'Officer'
    local lastName = pd.charinfo and pd.charinfo.lastname or tostring(source)
    local fullName = ('%s %s'):format(firstName, lastName)
    local job = pd.job and pd.job.name or 'police'
    local callsign = pd.metadata and pd.metadata.callsign or ('B-%s'):format(source)

    return {
        source = source,
        identifier = pd.citizenid or fallbackIdentifier,
        callsign = callsign,
        name = fullName,
        job = job,
        jobLabel = pd.job and pd.job.label or job,
        grade = getGradeLevel(pd.job),
        isAdmin = CAD.Config.Security.AdminJobs[job] or false,
    }
end
