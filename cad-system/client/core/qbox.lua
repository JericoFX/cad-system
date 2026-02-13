CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Client = CAD.Core.Client or {}

CAD.Core.Client.QBox = {}

function CAD.Core.Client.QBox.IsAvailable()
    return GetResourceState('qbx_core') == 'started'
end

function CAD.Core.Client.QBox.RegisterAccessEvents(refreshAccess)
    AddEventHandler('QBCore:Client:OnPlayerLoaded', function()
        refreshAccess()
    end)

    RegisterNetEvent('QBCore:Client:OnJobUpdate', function()
        refreshAccess()
    end)
end
