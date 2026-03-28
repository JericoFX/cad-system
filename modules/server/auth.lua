local Config = require 'modules.shared.config'
local Utils = require 'modules.shared.utils'

local Auth = {}

---@type table<integer, table>
local officerCache = {}
---@type table<integer, table<string, table>>
local rateLimits = {}

---@type integer
local CACHE_TTL_SECONDS = 15
---@type integer
local RATE_BUCKET_TTL_SECONDS = 120

---@param bucket string
---@return integer
local function getRateLimitConfig(bucket)
    local security = Config.Security or {}
    local perMinute = security.RateLimitPerMinute or {}
    return tonumber(perMinute[bucket] or perMinute.default) or 60
end

---@param source integer
---@param bucket string
---@return table
local function getBucket(source, bucket)
    rateLimits[source] = rateLimits[source] or {}
    rateLimits[source][bucket] = rateLimits[source][bucket] or {
        count = 0,
        resetAt = os.time() + 60,
    }
    return rateLimits[source][bucket]
end

---@param source integer
---@return table|nil
function Auth.GetOfficerData(source)
    local src = tonumber(source)
    if not src or src <= 0 then return nil end

    local cached = officerCache[src]
    if cached and (os.time() - (cached.updatedAt or 0)) < 15 then
        return cached
    end

    local Fn = require 'modules.server.functions'
    local identity = Fn.GetPlayerIdentity(src)
    if not identity then
        officerCache[src] = nil
        return nil
    end

    if not Fn.IsAllowedJob(identity.job) then
        officerCache[src] = nil
        return nil
    end

    officerCache[src] = {
        source = src,
        identifier = identity.identifier,
        callsign = identity.callsign,
        badge = identity.callsign,
        name = identity.name,
        job = identity.job,
        jobLabel = identity.jobLabel,
        grade = identity.grade,
        isAdmin = identity.isAdmin,
        updatedAt = os.time(),
    }

    return officerCache[src]
end

---@param source integer
---@return table|nil
function Auth.GetOfficer(source)
    return Auth.GetOfficerData(source)
end

---@param source integer
---@return boolean, table
function Auth.RequireOfficer(source)
    local officer = Auth.GetOfficerData(source)
    if not officer then
        return false, { ok = false, error = 'not_authorized' }
    end
    return true, officer
end

---@param source integer
---@param bucket string|nil
---@return boolean, table|nil
function Auth.CheckRate(source, bucket)
    local key = bucket or 'default'
    local state = getBucket(source, key)
    local now = os.time()

    if now >= state.resetAt then
        state.count = 0
        state.resetAt = now + 60
    end

    local limit = getRateLimitConfig(key)
    if state.count >= limit then
        return false, { ok = false, error = 'rate_limited' }
    end

    state.count = state.count + 1
    return true
end

---@param bucket string
---@param handler function
---@return function
function Auth.WithGuard(bucket, handler)
    return function(source, payload)
        local allowed, officerOrError = Auth.RequireOfficer(source)
        if not allowed then return officerOrError end

        local ratelimitOk, rateError = Auth.CheckRate(source, bucket)
        if not ratelimitOk then return rateError end

        local ok, result = pcall(handler, source, payload or {}, officerOrError)
        if not ok then
            Utils.Log('error', 'Guarded callback failure: %s', tostring(result))
            return { ok = false, error = 'internal_error' }
        end

        return result
    end
end

---@param source integer
function Auth.ClearPlayer(source)
    officerCache[source] = nil
    rateLimits[source] = nil
end

AddEventHandler('playerDropped', function()
    local source = source
    Auth.ClearPlayer(source)
end)

lib.cron.new('*/1 * * * *', function()
    local now = os.time()
    local activePlayers = {}
    for _, playerId in ipairs(GetPlayers()) do
        activePlayers[tonumber(playerId)] = true
    end

    for src, cached in pairs(officerCache) do
        if not activePlayers[src] or (now - (cached.updatedAt or 0)) > CACHE_TTL_SECONDS then
            officerCache[src] = nil
        end
    end

    for src, buckets in pairs(rateLimits) do
        if not activePlayers[src] then
            rateLimits[src] = nil
        else
            local hasActive = false
            for key, state in pairs(buckets) do
                if now >= (state.resetAt or 0) + RATE_BUCKET_TTL_SECONDS then
                    buckets[key] = nil
                else
                    hasActive = true
                end
            end
            if not hasActive then rateLimits[src] = nil end
        end
    end
end)

return Auth
