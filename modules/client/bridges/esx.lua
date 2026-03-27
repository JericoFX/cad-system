local ESXClient = {}

function ESXClient.IsAvailable()
    return GetResourceState('es_extended') == 'started'
end

function ESXClient.RegisterAccessEvents(refreshAccess)
    RegisterNetEvent('esx:playerLoaded', function()
        refreshAccess()
    end)
    RegisterNetEvent('esx:setJob', function()
        refreshAccess()
    end)
end

return ESXClient
