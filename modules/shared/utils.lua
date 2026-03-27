-- modules/shared/utils.lua

local Utils = {}

function Utils.Trim(value)
    local text = tostring(value or '')
    return text:match('^%s*(.-)%s*$') or ''
end

function Utils.Compact(value)
    return Utils.Trim(value):gsub('%s+', '')
end

function Utils.UpperTrim(value)
    return string.upper(Utils.Trim(value))
end

function Utils.IsBlank(value)
    return Utils.Trim(value) == ''
end

function Utils.GenerateId(prefix)
    local base = (prefix or 'ID'):upper()
    return ('%s_%s_%04d'):format(base, os.date('%Y%m%d%H%M%S'), math.random(0, 9999))
end

function Utils.ToIso(ts)
    return os.date('!%Y-%m-%dT%H:%M:%SZ', ts or os.time())
end

function Utils.Log(level, message, ...)
    local formatted = string.format(message or '', ...)
    local Config = require 'modules.shared.config'
    if level == 'debug' and not Config.Debug then return end

    local color = '^7'
    if level == 'error' then color = '^1' end
    if level == 'warn' then color = '^3' end
    if level == 'success' then color = '^2' end
    if level == 'debug' then color = '^5' end

    print(('%s[CAD:%s]^7 %s'):format(color, string.upper(level or 'info'), formatted))
end

function Utils.GetVersion()
    local raw = LoadResourceFile(GetCurrentResourceName(), 'version.txt')
    if not raw then return 'unknown' end
    return Utils.Trim(raw)
end

---@param value string|nil
---@return integer|nil
function Utils.IsoToEpoch(value)
    if type(value) ~= 'string' then
        return nil
    end

    local year, month, day, hour, minute, second = string.match(value, '^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)Z$')
    if not year then
        return nil
    end

    local localEpoch = os.time({
        year = tonumber(year),
        month = tonumber(month),
        day = tonumber(day),
        hour = tonumber(hour),
        min = tonumber(minute),
        sec = tonumber(second),
    })

    if not localEpoch then
        return nil
    end

    local utcOffset = os.difftime(os.time(), os.time(os.date('!*t')))
    return localEpoch + utcOffset
end

return Utils
