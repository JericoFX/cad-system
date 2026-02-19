-- PARA EL JERICO DEL FUTURO, ESTO ES SOLO PARA QUE OX_INVENTORY SEPA USAR LAS COSAS

exports('useIdCard', function(data)
    -- Posiblemente necesite usar los datos de QB osea el GetPlayerData()
    local citizenId = data.metadata.citizenid
    local firstname = data.metadata.firstname
    local lastname = data.metadata.lastname

    if not citizenId or citizenId == '' then
        lib.notify({
            title = 'CAD',
            description = 'Invalid ID card data',
            type = 'error'
        })
        return
    end

    SendNUIMessage({
        action = 'searchPerson',
        data = {
            citizenId = citizenId,
            name = (firstname and lastname) and (firstname .. ' ' .. lastname) or 'Unknown'
        }
    })

    lib.notify({
        title = 'CAD',
        description = ('Searching person: %s'):format(citizenId),
        type = 'inform'
    })
end)

exports('useDriverLicense', function(data)
    local citizenId = data.metadata.citizenid

    if not citizenId or citizenId == '' then
        lib.notify({
            title = 'CAD',
            description = 'Invalid driver license data',
            type = 'error'
        })
        return
    end

    SendNUIMessage({
        action = 'searchPerson',
        data = {
            citizenId = citizenId,
            name = (data.metadata.firstname .. ' ' .. data.metadata.lastname),
            licenseType = 'DRIVER'
        }
    })
    lib.notify({
        title = 'CAD',
        description = ('Searching driver: %s'):format(citizenId),
        type = 'inform'
    })
end)

RegisterNUICallback('personSearchResult', function(data, cb)
    if data.success then
        lib.notify({
            title = 'CAD',
            description = ('Person found: %s'):format(data.citizenId),
            type = 'success'
        })
    else
        lib.notify({
            title = 'CAD',
            description = 'Person not found',
            type = 'error'
        })
    end
    cb({ ok = true })
end)