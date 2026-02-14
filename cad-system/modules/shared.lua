--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}

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
