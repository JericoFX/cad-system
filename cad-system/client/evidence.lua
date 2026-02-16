--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Client = CAD.Client or {}

function CAD.Client.CollectEvidence(evidenceType, description)
    local payload = {
        evidenceType = evidenceType,
        data = {
            description = description,
        },
    }

    local result = lib.callback.await('cad:addEvidenceToStaging', false, payload)
    if not result then
        lib.notify({ title = 'CAD', description = 'Failed to stage evidence', type = 'error' })
        return nil
    end

    lib.notify({
        title = 'CAD',
        description = ('Evidence staged: %s'):format(result.stagingId),
        type = 'success',
    })

    return result
end

if CAD.Config.Debug == true then
    -- Debug command using ox_lib
    lib.addCommand('collectevidence', {
        help = 'Debug: Collect evidence',
        restricted = false,
    }, function()
        local input = lib.inputDialog('Collect Evidence (Debug)', {
            { type = 'input', label = 'Evidence Type', placeholder = 'PHOTO / DOCUMENT / DNA', required = true },
            { type = 'textarea', label = 'Description', required = false },
        })

        if not input then
            return
        end

        CAD.Client.CollectEvidence(input[1], input[2])
    end)

    -- Debug command to create evidence item from image URL using ox_lib
    lib.addCommand('cadevidencedebug', {
        help = 'Debug: Create evidence item with image URL',
        restricted = 'group.admin', -- Only admins can use this
    }, function()
        local input = lib.inputDialog('CAD Evidence Debug - Create Evidence Item', {
            { type = 'input', label = 'Image URL', placeholder = 'https://i.imgur.com/example.jpg', required = true },
            { type = 'input', label = 'Description', placeholder = 'Evidence description', required = false },
            { type = 'select', label = 'Evidence Type', options = {
                { value = 'PHOTO', label = '📷 Photo' },
                { value = 'DOCUMENT', label = '📄 Document' },
                { value = 'VIDEO', label = '🎥 Video' },
            }, required = true },
        })

        if not input or not input[1] or input[1] == '' then
            lib.notify({ title = 'CAD Debug', description = 'Cancelled or no URL provided', type = 'error' })
            return
        end

        local imageUrl = input[1]
        local description = input[2] or 'Debug evidence'
        local evType = input[3] or 'PHOTO'

        -- Call server to create evidence item
        local result = lib.callback.await('cad:debug:createEvidenceItem', false, {
            imageUrl = imageUrl,
            description = description,
            evidenceType = evType,
        })

        if result and result.ok then
            lib.notify({
                title = 'CAD Debug',
                description = ('Created evidence item: %s'):format(result.itemId or 'ok'),
                type = 'success',
            })
        else
            lib.notify({
                title = 'CAD Debug',
                description = ('Failed: %s'):format(result and result.error or 'unknown'),
                type = 'error',
            })
        end
    end)
end
