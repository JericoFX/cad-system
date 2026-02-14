--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Server = CAD.Core.Server or {}

local frameworkCache = {
    name = nil,
    object = nil,
}

local function resolveProvider(name)
    if name == 'qbox' then
        return CAD.Core.Server.QBox
    end

    if name == 'qb-core' then
        return CAD.Core.Server.QB
    end

    if name == 'esx' then
        return CAD.Core.Server.ESX
    end

    return CAD.Core.Server.Standalone
end

local function detectFramework()
    if frameworkCache.name then
        return frameworkCache.name, frameworkCache.object
    end

    local preferred = CAD.Config.Framework.Preferred or 'auto'
    local candidates = {}

    if preferred == 'qbox' then
        candidates = { 'qbox', 'qb-core', 'esx', 'standalone' }
    elseif preferred == 'qb-core' then
        candidates = { 'qb-core', 'qbox', 'esx', 'standalone' }
    elseif preferred == 'esx' then
        candidates = { 'esx', 'qbox', 'qb-core', 'standalone' }
    elseif preferred == 'standalone' then
        candidates = { 'standalone' }
    else
        candidates = { 'qbox', 'qb-core', 'esx', 'standalone' }
    end

    for i = 1, #candidates do
        local name = candidates[i]
        local provider = resolveProvider(name)
        if provider and provider.IsAvailable() then
            frameworkCache.name = name
            frameworkCache.object = provider.GetObject()
            return frameworkCache.name, frameworkCache.object
        end
    end

    frameworkCache.name = 'standalone'
    frameworkCache.object = nil
    return frameworkCache.name, frameworkCache.object
end

function CAD.Core.Server.GetFramework()
    return detectFramework()
end

function CAD.Core.Server.GetPlayerIdentity(source, fallbackIdentifier)
    local frameworkName = detectFramework()
    local provider = resolveProvider(frameworkName)
    local identity = provider.ResolveIdentity(source, fallbackIdentifier)
    if identity then
        return identity
    end

    return CAD.Core.Server.Standalone.ResolveIdentity(source, fallbackIdentifier)
end
