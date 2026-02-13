CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Client = CAD.Core.Client or {}

CAD.Core.Client.Standalone = {}

function CAD.Core.Client.Standalone.IsAvailable()
    return true
end

function CAD.Core.Client.Standalone.RegisterAccessEvents(refreshAccess)
    AddEventHandler('playerSpawned', function()
        refreshAccess()
    end)
end
