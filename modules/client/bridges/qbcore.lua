local QBClient = {}

---@return boolean
function QBClient.IsAvailable()
    return GetResourceState('qb-core') == 'started'
end

---@param refreshAccess function
function QBClient.RegisterAccessEvents(refreshAccess)
    RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
        refreshAccess()
    end)
    RegisterNetEvent('QBCore:Client:OnJobUpdate', function()
        refreshAccess()
    end)
end

return QBClient
