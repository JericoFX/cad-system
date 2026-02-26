

CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Server = CAD.Core.Server or {}

local frameworkCache = {
    name = 'qb-core',
    object = nil,
}

local function detectFramework()
    if frameworkCache.object then
        return 'qb-core', frameworkCache.object
    end

    if CAD.Core.Server.QB and CAD.Core.Server.QB.IsAvailable and CAD.Core.Server.QB.IsAvailable() then
        frameworkCache.object = CAD.Core.Server.QB.GetObject()
    end

    return 'qb-core', frameworkCache.object
end

function CAD.Core.Server.GetFramework()
    return detectFramework()
end

function CAD.Core.Server.GetPlayerIdentity(source, fallbackIdentifier)
    local identity = nil

    if CAD.Core.Server.QB and CAD.Core.Server.QB.ResolveIdentity then
        identity = CAD.Core.Server.QB.ResolveIdentity(source, fallbackIdentifier)
    end

    if identity then
        return identity
    end

    return nil
end
