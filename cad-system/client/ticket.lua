CAD = CAD or {}

exports('useCadTicket', function(data, slot)
    if GetResourceState('ox_inventory') ~= 'started' then
        lib.notify({ title = 'CAD', description = 'ox_inventory not available', type = 'error' })
        return
    end

    exports.ox_inventory:useItem(data, function(itemData)
        if not itemData then
            return
        end

        local metadata = itemData.metadata or data.metadata or {}
        local fineId = metadata.fineId
        if not fineId then
            lib.notify({ title = 'CAD', description = 'Invalid ticket metadata', type = 'error' })
            return
        end

        local result = lib.callback.await('cad:payFineByTicket', false, {
            fineId = fineId,
            slot = slot,
        })

        if result and result.ok ~= false then
            lib.notify({
                title = 'CAD',
                description = ('Fine paid: %s ($%s)'):format(result.fineId or fineId, tostring(result.amount or '?')),
                type = 'success',
            })
        else
            lib.notify({
                title = 'CAD',
                description = (result and result.error) or 'Could not pay this fine',
                type = 'error',
            })
        end
    end)
end)
