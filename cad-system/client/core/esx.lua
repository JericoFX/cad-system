CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Client = CAD.Core.Client or {}

CAD.Core.Client.ESX = {}

function CAD.Core.Client.ESX.IsAvailable()
    return GetResourceState('es_extended') == 'started'
end

function CAD.Core.Client.ESX.RegisterAccessEvents(refreshAccess)
    RegisterNetEvent('esx:playerLoaded', function()
        refreshAccess()
    end)

    RegisterNetEvent('esx:setJob', function()
        refreshAccess()
    end)
end
