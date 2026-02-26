

CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Client = CAD.Core.Client or {}

CAD.Core.Client.QB = {}

function CAD.Core.Client.QB.IsAvailable()
    return GetResourceState('qb-core') == 'started'
end

function CAD.Core.Client.QB.RegisterAccessEvents(refreshAccess)
    RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
        refreshAccess()
    end)

    RegisterNetEvent('QBCore:Client:OnJobUpdate', function()
        refreshAccess()
    end)
end
