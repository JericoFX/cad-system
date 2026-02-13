CAD = CAD or {}
CAD.Auth = CAD.Auth or {}

local officerCache = {}
local rateLimits = {}

local function getBucket(source, bucket)
    rateLimits[source] = rateLimits[source] or {}
    rateLimits[source][bucket] = rateLimits[source][bucket] or {
        count = 0,
        resetAt = os.time() + 60,
    }
    return rateLimits[source][bucket]
end

function CAD.Auth.GetOfficerData(source)
    local src = tonumber(source)
    if not src or src <= 0 then
        return nil
    end

    local identity = CAD.Server.GetPlayerIdentity(src)
    if not identity then
        return nil
    end

    if not CAD.Server.IsAllowedJob(identity.job) then
        return nil
    end

    officerCache[src] = {
        source = src,
        identifier = identity.identifier,
        callsign = identity.callsign,
        name = identity.name,
        job = identity.job,
        jobLabel = identity.jobLabel,
        grade = identity.grade,
        isAdmin = identity.isAdmin,
        updatedAt = os.time(),
    }

    return officerCache[src]
end

function CAD.Auth.RequireOfficer(source)
    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then
        return false, {
            ok = false,
            error = 'not_authorized',
        }
    end
    return true, officer
end

function CAD.Auth.CheckRate(source, bucket)
    local key = bucket or 'default'
    local state = getBucket(source, key)
    local now = os.time()

    if now >= state.resetAt then
        state.count = 0
        state.resetAt = now + 60
    end

    local limit = CAD.Config.Security.RateLimitPerMinute[key] or CAD.Config.Security.RateLimitPerMinute.default
    if state.count >= limit then
        return false, {
            ok = false,
            error = 'rate_limited',
        }
    end

    state.count = state.count + 1
    return true
end

function CAD.Auth.WithGuard(bucket, handler)
    return function(source, payload)
        local allowed, officerOrError = CAD.Auth.RequireOfficer(source)
        if not allowed then
            return officerOrError
        end

        local ratelimitOk, rateError = CAD.Auth.CheckRate(source, bucket)
        if not ratelimitOk then
            return rateError
        end

        local ok, result = pcall(handler, source, payload or {}, officerOrError)
        if not ok then
            CAD.Log('error', 'Guarded callback failure: %s', tostring(result))
            return {
                ok = false,
                error = 'internal_error',
            }
        end

        return result
    end
end

AddEventHandler('playerDropped', function()
    local source = source
    officerCache[source] = nil
    rateLimits[source] = nil
end)
