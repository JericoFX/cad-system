local Config = require 'modules.shared.config'
local Utils = require 'modules.shared.utils'

local QB = {}

---@type table|nil
local cachedQBObject = nil

---@return table|nil
function QB.GetObject()
    if cachedQBObject then return cachedQBObject end
    local ok, obj = pcall(function()
        return exports['qb-core']:GetCoreObject()
    end)
    if ok and obj then
        cachedQBObject = obj
        return obj
    end
    return nil
end

---@return boolean
function QB.IsAvailable()
    if GetResourceState('qb-core') ~= 'started' then return false end
    return QB.GetObject() ~= nil
end

---@param source integer
---@param fallbackIdentifier string
---@param getCallsignFn function|nil
---@return table|nil
function QB.ResolveIdentity(source, fallbackIdentifier, getCallsignFn)
    local qb = QB.GetObject()
    if not qb then return nil end

    local qbPlayer = qb.Functions.GetPlayer(source)
    if not qbPlayer or not qbPlayer.PlayerData then return nil end

    local pd = qbPlayer.PlayerData
    local metadata = type(pd.metadata) == 'table' and pd.metadata or {}
    local jobData = type(pd.job) == 'table' and pd.job or {}
    local gradeData = type(jobData.grade) == 'table' and jobData.grade or {}
    local firstName = pd.charinfo and pd.charinfo.firstname or 'Officer'
    local lastName = pd.charinfo and pd.charinfo.lastname or tostring(source)
    local fullName = ('%s %s'):format(firstName, lastName)

    local callsign = getCallsignFn and getCallsignFn(pd.citizenid or fallbackIdentifier)
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
        isAdmin = (Config.Security.AdminJobs or {})[jobName] or false,
    }
end

---@param source integer
---@param callsign string
---@return boolean
function QB.SaveCallsign(source, callsign)
    local qb = QB.GetObject()
    if not qb then return false end
    local qbPlayer = qb.Functions.GetPlayer(source)
    if not qbPlayer then return false end
    qbPlayer.Functions.SetMetaData('callsign', callsign)
    return true
end

---@param source integer
---@return number
function QB.GetPlayerMoney(source)
    local qb = QB.GetObject()
    if not qb then return 0 end
    local qbPlayer = qb.Functions.GetPlayer(source)
    if not qbPlayer then return 0 end
    return qbPlayer.PlayerData.money and qbPlayer.PlayerData.money.cash or 0
end

---@param source integer
---@param amount number
---@return boolean
function QB.RemoveMoney(source, amount)
    local qb = QB.GetObject()
    if not qb then return false end
    local qbPlayer = qb.Functions.GetPlayer(source)
    if not qbPlayer then return false end
    return qbPlayer.Functions.RemoveMoney('cash', amount, 'cad-fine')
end

return QB
