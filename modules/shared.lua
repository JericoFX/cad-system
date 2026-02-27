

CAD = CAD or {}
CAD.Progress = CAD.Progress or {}

-- igual

function CAD.GenerateId(prefix)
    local base = (prefix or 'ID'):upper()
    return ('%s_%s_%04d'):format(base, os.date('%Y%m%d%H%M%S'), math.random(0, 9999))
end

function CAD.DeepCopy(value)
    if type(value) ~= 'table' then
        return value
    end

    if lib and lib.table and lib.table.deepclone then
        return lib.table.deepclone(value)
    end

    local out = {}
    for k, v in pairs(value) do
        out[k] = CAD.DeepCopy(v)
    end
    return out
end

function CAD.TableContains(list, target)
    if type(list) ~= 'table' then
        return false
    end

    if lib and lib.table and lib.table.contains then
        return lib.table.contains(list, target)
    end

    for i = 1, #list do
        if list[i] == target then
            return true
        end
    end
    return false
end

function CAD.StringTrim(value)
    local text = tostring(value or '')
    text = text:gsub('^%s+', '')
    text = text:gsub('%s+$', '')
    return text
end

function CAD.StringCompact(value)
    local text = CAD.StringTrim(value)
    return text:gsub('%s+', '')
end

function CAD.StringUpperTrim(value)
    return string.upper(CAD.StringTrim(value))
end

function CAD.StringIsBlank(value)
    return CAD.StringTrim(value) == ''
end

function CAD.TableShallowCopy(input)
    local source = type(input) == 'table' and input or {}
    local snapshot = {}

    for key, value in pairs(source) do
        snapshot[key] = value
    end

    return snapshot
end

local function getFeatureTable(featureName)
    local features = CAD.Config and CAD.Config.Features
    if type(features) ~= 'table' then
        return {}
    end

    local name = tostring(featureName or '')
    if name == '' then
        return {}
    end

    return features[name] or {}
end

function CAD.IsFeatureEnabled(featureName)
    local feature = getFeatureTable(featureName)
    if feature.Enabled == nil then
        return true
    end
    return feature.Enabled == true
end

function CAD.IsFeatureVisibleInUI(featureName)
    local feature = getFeatureTable(featureName)
    if feature.ShowInUI == nil then
        return CAD.IsFeatureEnabled(featureName)
    end
    return feature.ShowInUI == true
end

local function normalizeProgressPayload(options)
    local duration = tonumber(options.duration) or 1000
    local disable = type(options.disable) == 'table' and options.disable or {}
    local anim = type(options.anim) == 'table' and options.anim or nil

    return {
        duration = duration,
        label = tostring(options.label or 'Processing...'),
        useWhileDead = options.useWhileDead == true,
        canCancel = options.canCancel ~= false,
        disable = {
            move = disable.move == true,
            car = disable.car == true,
            combat = disable.combat == true,
            mouse = disable.mouse == true,
            sprint = disable.sprint == true,
        },
        anim = anim and {
            dict = anim.dict,
            clip = anim.clip,
            flag = anim.flag,
            scenario = anim.scenario,
        } or nil,
    }
end

function CAD.Progress.Run(options)
    options = type(options) == 'table' and options or {}

    local payload = normalizeProgressPayload(options)

    if lib and lib.progressBar then
        return lib.progressBar(payload)
    end

    Wait(payload.duration)
    return true
end
