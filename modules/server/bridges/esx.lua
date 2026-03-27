local Config = require 'modules.shared.config'
local Utils = require 'modules.shared.utils'

local ESX = {}

local esxObj = nil

function ESX.GetObject()
    if esxObj then return esxObj end
    local ok, obj = pcall(function()
        return exports['es_extended']:getSharedObject()
    end)
    if ok and obj then
        esxObj = obj
        return obj
    end
    return nil
end

function ESX.IsAvailable()
    if GetResourceState('es_extended') ~= 'started' then return false end
    return ESX.GetObject() ~= nil
end

function ESX.ResolveIdentity(source, fallbackIdentifier, getCallsignFn)
    local esx = ESX.GetObject()
    if not esx then return nil end

    local xPlayer = esx.GetPlayerFromId(source)
    if not xPlayer then return nil end

    local jobData = xPlayer.getJob() or {}
    local gradeData = type(jobData.grade) == 'table' and jobData.grade or {}
    local fullName = xPlayer.getName() or ('Player %s'):format(source)
    local identifier = xPlayer.getIdentifier() or fallbackIdentifier

    local callsign = getCallsignFn and getCallsignFn(identifier)
    if not callsign then
        callsign = ('B-%s'):format(gradeData.level or gradeData.grade or 0)
    end

    local jobName = jobData.name or ''

    return {
        source = source,
        identifier = identifier,
        callsign = callsign or ('B-%s'):format(source),
        name = fullName,
        job = jobName,
        jobLabel = jobData.label or 'Unknown',
        grade = gradeData.level or gradeData.grade or 0,
        isAdmin = (Config.Security.AdminJobs or {})[jobName] or false,
    }
end

function ESX.SaveCallsign(source, callsign)
    -- ESX has no built-in callsign metadata; persisted via cad_officers table by Officers module
    return true
end

function ESX.GetPlayerMoney(source)
    local esx = ESX.GetObject()
    if not esx then return 0 end
    local xPlayer = esx.GetPlayerFromId(source)
    if not xPlayer then return 0 end
    return xPlayer.getMoney() or 0
end

function ESX.RemoveMoney(source, amount)
    local esx = ESX.GetObject()
    if not esx then return false end
    local xPlayer = esx.GetPlayerFromId(source)
    if not xPlayer then return false end
    xPlayer.removeMoney(amount)
    return true
end

return ESX
