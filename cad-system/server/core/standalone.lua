CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Server = CAD.Core.Server or {}

CAD.Core.Server.Standalone = {}

function CAD.Core.Server.Standalone.GetObject()
    return nil
end

function CAD.Core.Server.Standalone.IsAvailable()
    return true
end

function CAD.Core.Server.Standalone.ResolveIdentity(source, fallbackIdentifier)
    return {
        source = source,
        identifier = fallbackIdentifier,
        callsign = ('B-%s'):format(source),
        name = GetPlayerName(source) or ('Officer %s'):format(source),
        job = 'police',
        jobLabel = 'Police',
        grade = 0,
        isAdmin = false,
    }
end
