CAD = CAD or {}

function CAD.GenerateId(prefix)
    local base = (prefix or 'ID'):upper()
    return ('%s_%s_%04d'):format(base, os.date('%Y%m%d%H%M%S'), math.random(0, 9999))
end

function CAD.DeepCopy(value)
    if type(value) ~= 'table' then
        return value
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
    for i = 1, #list do
        if list[i] == target then
            return true
        end
    end
    return false
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
