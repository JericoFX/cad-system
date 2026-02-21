CAD = CAD or {}
CAD.AdminCAD = CAD.AdminCAD or {}

local isBusy = false

local function notify(message, nType)
    lib.notify({
        title = 'Admin CAD',
        description = message,
        type = nType or 'inform',
    })
end

local function splitJobs(raw)
    if type(raw) ~= 'string' then
        return {}
    end

    local out = {}
    local seen = {}
    for token in raw:gmatch('[^,]+') do
        local job = CAD.StringTrim(token):lower()
        if job ~= '' and not seen[job] then
            seen[job] = true
            out[#out + 1] = job
        end
    end

    table.sort(out)
    return out
end

local function normalizeRaycastHit(hit)
    if type(hit) == 'boolean' then
        return hit
    end
    if type(hit) == 'number' then
        return hit == 1
    end
    return false
end

local function playPlacementAnimationNetwork()
    local ped = cache.ped or PlayerPedId()
    if not ped or ped == 0 then
        return false
    end

    local dict = 'anim@heists@keycard@'
    local clip = 'exit'
    lib.requestAnimDict(dict)

    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)
    local scene = NetworkCreateSynchronisedScene(coords.x, coords.y, coords.z, 0.0, 0.0, heading, 2, false, false, 1.0, 0.0, 1.0)
    if scene and scene ~= -1 then
        NetworkAddPedToSynchronisedScene(ped, scene, dict, clip, 8.0, -8.0, 16, 0, 0.0, 0)
        NetworkStartSynchronisedScene(scene)
        Wait(950)
        local localScene = NetworkGetLocalSceneFromNetworkId(scene)
        if localScene and localScene ~= -1 then
            NetworkStopSynchronisedScene(localScene)
        end
    else
        TaskPlayAnim(ped, dict, clip, 8.0, -8.0, 900, 49, 0.0, false, false, false)
        Wait(900)
    end

    ClearPedTasks(ped)
    return true
end

local function getPreviewModelHash(kind)
    if kind == 'reader' then
        local readerCfg = CAD.Config.Forensics and CAD.Config.Forensics.IdReader or {}
        local primary = joaat(tostring(readerCfg.ReaderModel or 'hei_prop_hei_securitypanel'))
        if IsModelInCdimage(primary) then
            return primary
        end
        local fallback = joaat(tostring(readerCfg.ReaderModelFallback or 'prop_ld_keypad_01'))
        if IsModelInCdimage(fallback) then
            return fallback
        end
    elseif kind == 'locker' then
        local model = joaat('prop_box_wood05a')
        if IsModelInCdimage(model) then
            return model
        end
    elseif kind == 'terminal' then
        local model = joaat('prop_monitor_03b')
        if IsModelInCdimage(model) then
            return model
        end
    elseif kind == 'lab' then
        local model = joaat('xm_prop_lab_chemtest')
        if IsModelInCdimage(model) then
            return model
        end
    end

    return nil
end

local function openPlacementActionMenu()
    local selected = nil
    lib.registerContext({
        id = 'cad_admin_place_menu',
        title = 'Placement Actions',
        options = {
            {
                title = '[PROBAR ANIMACION]',
                icon = 'play',
                onSelect = function()
                    selected = 'test'
                end,
            },
            {
                title = '[CONFIRMAR COLOCACION]',
                icon = 'check',
                onSelect = function()
                    selected = 'confirm'
                end,
            },
            {
                title = '[CANCELAR]',
                icon = 'xmark',
                onSelect = function()
                    selected = 'cancel'
                end,
            },
        },
    })

    lib.showContext('cad_admin_place_menu')
    while selected == nil do
        Wait(0)
    end

    return selected
end

local function choosePlacement(kind)
    local maxDistance = 12.0
    local modelHash = getPreviewModelHash(kind)
    local preview = nil
    local yaw = (GetGameplayCamRot(2).z or 0.0)
    local pitch = 0.0

    if modelHash then
        lib.requestModel(modelHash, 3000)
    end

    lib.showTextUI('[A/D] yaw  [W/S] pitch  [E] menu  [BACKSPACE] cancel', {
        position = 'left-center',
    })

    while true do
        Wait(0)
        local hit, _, endCoords = lib.raycast.fromCamera(511, 4, maxDistance)
        local hasHit = normalizeRaycastHit(hit)

        if hasHit and endCoords and endCoords.x and endCoords.y and endCoords.z then
            if modelHash then
                if not preview or preview == 0 or not DoesEntityExist(preview) then
                    preview = CreateObjectNoOffset(modelHash, endCoords.x, endCoords.y, endCoords.z, false, false, false)
                    if preview and preview ~= 0 then
                        SetEntityCollision(preview, false, false)
                        SetEntityAlpha(preview, 175, false)
                        FreezeEntityPosition(preview, true)
                    end
                end
            end

            local frameRotation = 70.0 * GetFrameTime()
            if IsControlPressed(0, 34) then yaw = yaw + frameRotation end
            if IsControlPressed(0, 35) then yaw = yaw - frameRotation end
            if IsControlPressed(0, 32) then pitch = math.max(-75.0, pitch - frameRotation) end
            if IsControlPressed(0, 33) then pitch = math.min(30.0, pitch + frameRotation) end

            if preview and preview ~= 0 and DoesEntityExist(preview) then
                SetEntityCoordsNoOffset(preview, endCoords.x, endCoords.y, endCoords.z, false, false, false)
                SetEntityRotation(preview, pitch, 0.0, yaw, 2, true)
            else
                DrawMarker(28, endCoords.x, endCoords.y, endCoords.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.03, 0.03, 0.03, 255, 255, 0, 190, false, false, 2, false, nil, nil, false)
            end

            if IsControlJustReleased(0, 38) then
                local choice = openPlacementActionMenu()
                if choice == 'test' then
                    playPlacementAnimationNetwork()
                elseif choice == 'cancel' then
                    lib.hideTextUI()
                    if preview and preview ~= 0 and DoesEntityExist(preview) then
                        DeleteEntity(preview)
                    end
                    if modelHash then
                        SetModelAsNoLongerNeeded(modelHash)
                    end
                    return nil
                elseif choice == 'confirm' then
                    lib.hideTextUI()
                    if preview and preview ~= 0 and DoesEntityExist(preview) then
                        DeleteEntity(preview)
                    end
                    if modelHash then
                        SetModelAsNoLongerNeeded(modelHash)
                    end
                    return {
                        coords = { x = endCoords.x, y = endCoords.y, z = endCoords.z },
                        rotation = { x = pitch, y = 0.0, z = yaw },
                    }
                end
            end
        end

        if IsControlJustReleased(0, 177) or IsControlJustReleased(0, 194) then
            lib.hideTextUI()
            if preview and preview ~= 0 and DoesEntityExist(preview) then
                DeleteEntity(preview)
            end
            if modelHash then
                SetModelAsNoLongerNeeded(modelHash)
            end
            return nil
        end
    end
end

local function getTopologySnapshot()
    local response = lib.callback.await('cad:topology:getSnapshot', false, {})
    if not response or response.ok ~= true or type(response.snapshot) ~= 'table' then
        return nil
    end
    return response.snapshot
end

local function chooseTerminal(snapshot)
    local terminals = snapshot and snapshot.terminals or {}
    if #terminals == 0 then
        notify('No hay terminals CAD. Crea una PC primero.', 'error')
        return nil
    end

    local options = {}
    for i = 1, #terminals do
        options[#options + 1] = {
            value = terminals[i].terminalId,
            label = ('%s [%s]'):format(terminals[i].label or terminals[i].terminalId, terminals[i].terminalId),
        }
    end

    local input = lib.inputDialog('Selecciona terminal CAD', {
        {
            type = 'select',
            label = 'Terminal',
            required = true,
            options = options,
        },
    })

    if not input then
        return nil
    end

    return tostring(input[1])
end

local function createTerminal()
    local placement = choosePlacement('terminal')
    if not placement then
        notify('Creacion cancelada', 'inform')
        return
    end

    local form = lib.inputDialog('Crear PC CAD', {
        { type = 'input', label = 'Label', required = true, default = 'CAD Terminal' },
        { type = 'number', label = 'Radio de acceso', required = true, default = 1.25, min = 0.5, max = 12.0 },
        { type = 'input', label = 'Jobs (comma)', required = false, default = 'police,sheriff,csi,dispatch,admin' },
    })

    if not form then
        return
    end

    local response = lib.callback.await('cad:topology:createTerminal', false, {
        label = form[1],
        radius = tonumber(form[2]) or 1.25,
        jobs = splitJobs(form[3]),
        coords = placement.coords,
        rotation = placement.rotation,
    })

    if response and response.ok then
        notify(('PC creada: %s'):format(response.terminalId or 'TERM'), 'success')
    else
        notify(('Error al crear PC: %s'):format(response and response.error or 'unknown_error'), 'error')
    end
end

local function createReader()
    local snapshot = getTopologySnapshot()
    if not snapshot then
        notify('No se pudo cargar topology', 'error')
        return
    end

    local terminalId = chooseTerminal(snapshot)
    if not terminalId then
        return
    end

    local placement = choosePlacement('reader')
    if not placement then
        notify('Creacion cancelada', 'inform')
        return
    end

    local form = lib.inputDialog('Crear ID Reader', {
        { type = 'input', label = 'Label', required = true, default = 'ID Reader' },
        { type = 'number', label = 'Interaction distance', required = true, default = 1.6, min = 0.5, max = 6.0 },
        { type = 'number', label = 'Slots', required = true, default = 5, min = 1, max = 20 },
        { type = 'number', label = 'Read slot', required = true, default = 1, min = 1, max = 20 },
        { type = 'input', label = 'Jobs (comma, empty inherits terminal)', required = false, default = '' },
    })

    if not form then
        return
    end

    local response = lib.callback.await('cad:topology:createReader', false, {
        terminalId = terminalId,
        label = form[1],
        interactionDistance = tonumber(form[2]) or 1.6,
        slots = tonumber(form[3]) or 5,
        readSlot = tonumber(form[4]) or 1,
        jobs = splitJobs(form[5]),
        coords = placement.coords,
        rotation = placement.rotation,
    })

    if response and response.ok then
        notify(('Reader creado: %s'):format(response.readerId or 'RDR'), 'success')
    else
        notify(('Error al crear reader: %s'):format(response and response.error or 'unknown_error'), 'error')
    end
end

local function createLocker()
    local snapshot = getTopologySnapshot()
    if not snapshot then
        notify('No se pudo cargar topology', 'error')
        return
    end

    local terminalId = chooseTerminal(snapshot)
    if not terminalId then
        return
    end

    local placement = choosePlacement('locker')
    if not placement then
        notify('Creacion cancelada', 'inform')
        return
    end

    local form = lib.inputDialog('Crear Evidence Locker', {
        { type = 'input', label = 'Label', required = true, default = 'Evidence Locker' },
        { type = 'number', label = 'Interaction distance', required = true, default = 1.6, min = 0.5, max = 8.0 },
        { type = 'number', label = 'Slots', required = true, default = 200, min = 1, max = 1000 },
        { type = 'input', label = 'Jobs (comma, empty inherits terminal)', required = false, default = '' },
    })

    if not form then
        return
    end

    local response = lib.callback.await('cad:topology:createLocker', false, {
        terminalId = terminalId,
        label = form[1],
        interactionDistance = tonumber(form[2]) or 1.6,
        slots = tonumber(form[3]) or 200,
        jobs = splitJobs(form[4]),
        coords = placement.coords,
        rotation = placement.rotation,
    })

    if response and response.ok then
        notify(('Locker creado: %s'):format(response.lockerId or 'LCK'), 'success')
    else
        notify(('Error al crear locker: %s'):format(response and response.error or 'unknown_error'), 'error')
    end
end

local function createLab()
    local placement = choosePlacement('lab')
    if not placement then
        notify('Creacion cancelada', 'inform')
        return
    end

    local form = lib.inputDialog('Crear Forensic Lab', {
        { type = 'input', label = 'Name', required = true, default = 'Forensic Lab' },
        { type = 'number', label = 'Radius', required = true, default = 10.0, min = 1.0, max = 80.0 },
        { type = 'input', label = 'Jobs (comma)', required = false, default = 'police,sheriff,csi,ems,ambulance,admin' },
    })

    if not form then
        return
    end

    local response = lib.callback.await('cad:topology:createLab', false, {
        name = form[1],
        radius = tonumber(form[2]) or 10.0,
        jobs = splitJobs(form[3]),
        coords = placement.coords,
        rotation = placement.rotation,
    })

    if response and response.ok then
        notify(('Lab creado: %s'):format(response.labId or 'LAB'), 'success')
    else
        notify(('Error al crear lab: %s'):format(response and response.error or 'unknown_error'), 'error')
    end
end

local function openAdminMenu()
    if isBusy then
        return
    end

    local permission = lib.callback.await('cad:topology:isAdmin', false, {})
    if not permission or permission.ok ~= true or permission.isAdmin ~= true then
        notify('No tienes permisos para /admincad', 'error')
        return
    end

    lib.registerContext({
        id = 'cad_admin_main_menu',
        title = 'CAD Admin Builder',
        options = {
            {
                title = '[CREAR PC CAD]',
                icon = 'desktop',
                onSelect = function()
                    isBusy = true
                    createTerminal()
                    isBusy = false
                end,
            },
            {
                title = '[CREAR ID READER (1x CAD)]',
                icon = 'id-card',
                onSelect = function()
                    isBusy = true
                    createReader()
                    isBusy = false
                end,
            },
            {
                title = '[CREAR EVIDENCE LOCKER]',
                icon = 'box-archive',
                onSelect = function()
                    isBusy = true
                    createLocker()
                    isBusy = false
                end,
            },
            {
                title = '[CREAR FORENSIC LAB]',
                icon = 'flask',
                onSelect = function()
                    isBusy = true
                    createLab()
                    isBusy = false
                end,
            },
            {
                title = '[PROBAR ANIMACION]',
                icon = 'play',
                onSelect = function()
                    playPlacementAnimationNetwork()
                end,
            },
        },
    })

    lib.showContext('cad_admin_main_menu')
end

RegisterCommand('admincad', function()
    openAdminMenu()
end, false)
