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
    RegisterCommand('collectevidence', function()
        local input = lib.inputDialog('Collect Evidence (Debug)', {
            { type = 'input', label = 'Evidence Type', placeholder = 'PHOTO / DOCUMENT / DNA', required = true },
            { type = 'textarea', label = 'Description', required = false },
        })

        if not input then
            return
        end

        CAD.Client.CollectEvidence(input[1], input[2])
    end, false)
end
