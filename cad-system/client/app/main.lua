-- Some day i will finish the anotations

CAD = CAD or {}
CAD.Client = CAD.Client or {}

local uiOpen = false
local canUseCad = false
local accessZoneIds = {}
local readerZoneIds = {}
local lockerZoneIds = {}
local useTargetAccess = false
local activeTerminalContext = nil
local readerActionBusy = false
local lockerActionBusy = false
local dispatchPublicRev = -1
local casesPublicRev = -1
local topologySnapshot = {
    rev = 0,
    terminals = {},
    labs = {},
}
local zoneInitialized = false

---@class DispatchPublicStatePayload
---@field rev integer
---@field generatedAt string
---@field calls table<string, table>
---@field units table<string, table>

---@class CasesPublicStatePayload
---@field rev integer
---@field generatedAt string
---@field cases table<string, table>

local function asVector3(value)
    if type(value) == 'vector3' then
        return value
    end

    if type(value) == 'table' then
        local x = tonumber(value.x)
        local y = tonumber(value.y)
        local z = tonumber(value.z)
        if x and y and z then
            return vector3(x, y, z)
        end
    end

    return nil
end

local function isVirtualReaderEnabled()
    local readerCfg = CAD.Config.Forensics and CAD.Config.Forensics.IdReader or {}
    return readerCfg.Enabled == true and readerCfg.UseVirtualContainer == true
end

local function isVirtualEvidenceEnabled()
    local evidenceCfg = CAD.Config.Evidence or {}
    return evidenceCfg.UseVirtualContainer ~= false
end

local function normalizeTerminal(point, index)
    if type(point) ~= 'table' then
        return nil
    end

    local terminalId = point.terminalId or point.id or ('terminal_%s'):format(index)
    local reader = type(point.reader) == 'table' and point.reader or (type(point.idReader) == 'table' and point.idReader or nil)
    local lockers = type(point.lockers) == 'table' and point.lockers or {}
    local container = type(point.evidenceContainer) == 'table' and point.evidenceContainer or nil
    local hasContainer = #lockers > 0 or (container and container.enabled == true) or false

    return {
        terminalId = terminalId,
        label = point.label or ('CAD Terminal %s'):format(index),
        coords = asVector3(point.coords),
        radius = point.radius or 1.25,
        hasContainer = hasContainer,
        lockers = lockers,
        defaultLockerId = point.defaultLockerId,
        container = container,
        hasReader = point.hasReader == true or (reader and reader.enabled == true) or false,
        reader = reader,
    }
end

local function setActiveTerminal(point, index)
    activeTerminalContext = normalizeTerminal(point, index)
end

function CAD.Client.GetTopologySnapshot()
    return topologySnapshot
end

local function getTerminalPoints()
    return type(topologySnapshot.terminals) == 'table' and topologySnapshot.terminals or {}
end

local function getNearestTerminal()
    local ped = cache.ped
    if not ped or ped == 0 then
        return nil
    end

    local coords = GetEntityCoords(ped)
    local points = getTerminalPoints()
    local nearest, nearestDistance = nil, nil

    for i = 1, #points do
        local terminal = normalizeTerminal(points[i], i)
        if terminal and terminal.coords then
            local distance = #(coords - terminal.coords)
            local threshold = (terminal.radius or 1.25) + 3.0
            if distance <= threshold and (not nearestDistance or distance < nearestDistance) then
                nearest = terminal
                nearestDistance = distance
            end
        end
    end

    return nearest
end

local function getReaderCoords(point)
    if type(point) ~= 'table' then
        return nil
    end

    local reader = type(point.reader) == 'table' and point.reader or (type(point.idReader) == 'table' and point.idReader or nil)
    if not reader then
        return asVector3(point.coords)
    end

    local absolute = asVector3(reader.interactionCoords) or asVector3(reader.coords)
    if absolute then
        return absolute
    end

    local base = asVector3(point.coords)
    local offset = asVector3(reader.offset)
    if base and offset then
        return base + offset
    end

    return base
end

local function getReaderDistance(point)
    local reader = type(point.reader) == 'table' and point.reader or (type(point.idReader) == 'table' and point.idReader or {})
    local globalCfg = CAD.Config.Forensics and CAD.Config.Forensics.IdReader or {}
    return tonumber(reader.interactionDistance) or tonumber(globalCfg.InteractionDistance) or 1.6
end

local function getLockerCoords(locker, point)
    if type(locker) ~= 'table' then
        return nil
    end

    local container = locker
    if not container.coords and type(point) == 'table' then
        container = type(point.evidenceContainer) == 'table' and point.evidenceContainer or locker
    end

    local absolute = asVector3(container.interactionCoords) or asVector3(container.coords)
    if absolute then
        return absolute
    end

    local base = asVector3(point.coords)
    local offset = asVector3(container.offset)
    if base and offset then
        return base + offset
    end

    return base
end

local function getLockerDistance(locker, point)
    local container = type(locker) == 'table' and locker or (type(point) == 'table' and type(point.evidenceContainer) == 'table' and point.evidenceContainer or {})
    return tonumber(container.interactionDistance) or tonumber(container.radius) or 1.6
end

local function playCardSwipeAnimation()
    local readerCfg = CAD.Config.Forensics and CAD.Config.Forensics.IdReader or {}
    local cardModelName = tostring(readerCfg.CardModel or 'prop_cs_swipe_card')
    local ped = cache.ped or PlayerPedId()
    if not ped or ped == 0 then
        return
    end

    lib.requestAnimDict('anim@heists@keycard@')

    local cardModel = joaat(cardModelName)
    local hasModel = IsModelInCdimage(cardModel)
    if hasModel then
        lib.requestModel(cardModel, 3000)
    end

    local cardObject = nil
    if hasModel then
        local coords = GetEntityCoords(ped)
        cardObject = CreateObject(cardModel, coords.x, coords.y, coords.z + 0.2, true, true, false)
        if cardObject and cardObject ~= 0 then
            AttachEntityToEntity(
                cardObject,
                ped,
                GetPedBoneIndex(ped, 57005),
                0.14,
                0.02,
                -0.02,
                -80.0,
                15.0,
                0.0,
                true,
                true,
                false,
                true,
                1,
                true
            )
        end
    end

    TaskPlayAnim(ped, 'anim@heists@keycard@', 'exit', 8.0, -8.0, 900, 49, 0.0, false, false, false)
    Wait(900)
    ClearPedTasks(ped)

    if cardObject and DoesEntityExist(cardObject) then
        DeleteEntity(cardObject)
    end

    if hasModel then
        SetModelAsNoLongerNeeded(cardModel)
    end
end

local function performReaderRead(terminalId)
    local response = lib.callback.await('cad:idreader:read', false, {
        terminalId = terminalId,
    })

    if not response or not response.ok then
        lib.notify({
            title = 'CAD Reader',
            description = ('Read failed: %s'):format(response and response.error or 'unknown_error'),
            type = 'error',
        })
        return
    end

    if response.documentType == 'VEHICLE' and response.vehicle then
        lib.notify({
            title = 'CAD Reader',
            description = ('Vehicle read: %s (%s)'):format(tostring(response.vehicle.plate or 'UNKNOWN'), tostring(response.vehicle.model or 'Unknown')),
            type = 'success',
        })
        return
    end

    local person = response.person or {}
    lib.notify({
        title = 'CAD Reader',
        description = ('ID read: %s %s (%s)'):format(
            tostring(person.firstName or 'Unknown'),
            tostring(person.lastName or 'Unknown'),
            tostring(person.citizenid or 'UNKNOWN')
        ),
        type = 'success',
    })
end

local function performReaderInsert(terminalId, expectedSlot)
    local listResponse = lib.callback.await('cad:idreader:listDocuments', false, {
        terminalId = terminalId,
    })

    if not listResponse or not listResponse.ok then
        lib.notify({
            title = 'CAD Reader',
            description = ('Cannot list documents: %s'):format(listResponse and listResponse.error or 'unknown_error'),
            type = 'error',
        })
        return
    end

    local docs = type(listResponse.documents) == 'table' and listResponse.documents or {}
    if #docs == 0 then
        lib.notify({
            title = 'CAD Reader',
            description = 'No supported documents in inventory',
            type = 'error',
        })
        return
    end

    local options = {}
    for i = 1, #docs do
        local doc = docs[i]
        options[#options + 1] = {
            value = tostring(doc.slot or i),
            label = ('%s [%s]'):format(tostring(doc.label or doc.name or 'document'), tostring(doc.documentType or 'DOC')),
        }
    end

    local input = lib.inputDialog('Insert document in reader', {
        {
            type = 'select',
            label = 'Document',
            required = true,
            options = options,
        },
        {
            type = 'number',
            label = 'Reader slot',
            default = tonumber(expectedSlot) or 1,
            min = 1,
            max = 20,
            required = true,
        },
    })

    if not input then
        return
    end

    playCardSwipeAnimation()

    local insertResponse = lib.callback.await('cad:idreader:insert', false, {
        terminalId = terminalId,
        inventorySlot = tonumber(input[1]),
        slot = tonumber(input[2]),
    })

    if not insertResponse or not insertResponse.ok then
        lib.notify({
            title = 'CAD Reader',
            description = ('Insert failed: %s'):format(insertResponse and insertResponse.error or 'unknown_error'),
            type = 'error',
        })
        return
    end

    lib.notify({
        title = 'CAD Reader',
        description = ('Document inserted into slot %s'):format(tostring(insertResponse.slot or '?')),
        type = 'success',
    })
end

local function performReaderEject(terminalId)
    playCardSwipeAnimation()

    local response = lib.callback.await('cad:idreader:eject', false, {
        terminalId = terminalId,
    })

    if not response or not response.ok then
        lib.notify({
            title = 'CAD Reader',
            description = ('Eject failed: %s'):format(response and response.error or 'unknown_error'),
            type = 'error',
        })
        return
    end

    lib.notify({
        title = 'CAD Reader',
        description = ('Document ejected from slot %s'):format(tostring(response.slot or '?')),
        type = 'success',
    })
end

local function openReaderActionMenu(point, index)
    if readerActionBusy or not canUseCad then
        return
    end

    local reader = type(point.reader) == 'table' and point.reader or (type(point.idReader) == 'table' and point.idReader or nil)
    if not reader then
        return
    end

    readerActionBusy = true
    setActiveTerminal(point, index)

    local menu = lib.inputDialog(point.label or 'ID Reader', {
        {
            type = 'select',
            label = 'Action',
            required = true,
            options = {
                { value = 'insert', label = 'Insert document' },
                { value = 'read', label = 'Read document' },
                { value = 'eject', label = 'Eject document' },
            },
        },
    })

    if not menu then
        readerActionBusy = false
        return
    end

    local action = menu[1]
    local terminalId = point.terminalId or point.id or ('terminal_%s'):format(index)
    local expectedSlot = tonumber(reader.readSlot) or 1

    if action == 'insert' then
        performReaderInsert(terminalId, expectedSlot)
    elseif action == 'read' then
        performReaderRead(terminalId)
    elseif action == 'eject' then
        performReaderEject(terminalId)
    end

    readerActionBusy = false
end

local function performLockerRefresh(terminalId, lockerId)
    local response = lib.callback.await('cad:evidence:container:list', false, {
        terminalId = terminalId,
        lockerId = lockerId,
    })

    if not response or not response.ok then
        lib.notify({
            title = 'CAD Locker',
            description = ('Refresh failed: %s'):format(response and response.error or 'unknown_error'),
            type = 'error',
        })
        return nil
    end

    local slots = type(response.slots) == 'table' and response.slots or {}
    lib.notify({
        title = 'CAD Locker',
        description = ('Locker ready: %s slot(s) ocupados'):format(#slots),
        type = 'inform',
    })

    return response
end

local function performLockerStore(terminalId, lockerId)
    local staging = lib.callback.await('cad:getStagingEvidence', false)
    local items = type(staging) == 'table' and staging or {}

    if #items == 0 then
        lib.notify({
            title = 'CAD Locker',
            description = 'No tienes evidencia en STAGING',
            type = 'error',
        })
        return
    end

    local options = {}
    for i = 1, #items do
        local row = items[i]
        options[#options + 1] = {
            value = tostring(row.stagingId or i),
            label = ('%s [%s]'):format(tostring(row.stagingId or ('STAGE_' .. i)), tostring(row.evidenceType or 'UNKNOWN')),
        }
    end

    local input = lib.inputDialog('Store evidence in locker', {
        {
            type = 'select',
            label = 'Staging item',
            required = true,
            options = options,
        },
        {
            type = 'number',
            label = 'Locker slot (0 = auto)',
            default = 0,
            min = 0,
            max = 500,
            required = true,
        },
    })

    if not input then
        return
    end

    local response = lib.callback.await('cad:evidence:container:store', false, {
        terminalId = terminalId,
        lockerId = lockerId,
        stagingId = tostring(input[1]),
        slot = tonumber(input[2]) or 0,
    })

    if not response or not response.ok then
        lib.notify({
            title = 'CAD Locker',
            description = ('Store failed: %s'):format(response and response.error or 'unknown_error'),
            type = 'error',
        })
        return
    end

    lib.notify({
        title = 'CAD Locker',
        description = ('Evidence guardada en slot %s'):format(tostring(response.slot or '?')),
        type = 'success',
    })
end

local function performLockerPull(terminalId, lockerId)
    local listResponse = lib.callback.await('cad:evidence:container:list', false, {
        terminalId = terminalId,
        lockerId = lockerId,
    })

    if not listResponse or not listResponse.ok then
        lib.notify({
            title = 'CAD Locker',
            description = ('Cannot read locker: %s'):format(listResponse and listResponse.error or 'unknown_error'),
            type = 'error',
        })
        return
    end

    local slots = type(listResponse.slots) == 'table' and listResponse.slots or {}
    if #slots == 0 then
        lib.notify({
            title = 'CAD Locker',
            description = 'Locker vacio',
            type = 'error',
        })
        return
    end

    local options = {}
    for i = 1, #slots do
        local slot = slots[i]
        local evidenceType = slot.metadata and slot.metadata.evidenceType or 'UNKNOWN'
        options[#options + 1] = {
            value = tostring(slot.slot),
            label = ('Slot %s [%s]'):format(tostring(slot.slot), tostring(evidenceType)),
        }
    end

    local input = lib.inputDialog('Pull evidence from locker', {
        {
            type = 'select',
            label = 'Locker slot',
            required = true,
            options = options,
        },
    })

    if not input then
        return
    end

    local response = lib.callback.await('cad:evidence:container:pull', false, {
        terminalId = terminalId,
        lockerId = lockerId,
        slot = tonumber(input[1]),
    })

    if not response or not response.ok then
        lib.notify({
            title = 'CAD Locker',
            description = ('Pull failed: %s'):format(response and response.error or 'unknown_error'),
            type = 'error',
        })
        return
    end

    lib.notify({
        title = 'CAD Locker',
        description = ('Evidence enviada a STAGING (%s)'):format(tostring(response.staging and response.staging.stagingId or 'STAGE')),
        type = 'success',
    })
end

local function openLockerActionMenu(point, index, locker)
    if lockerActionBusy or not canUseCad then
        return
    end

    local containers = type(point.lockers) == 'table' and point.lockers or {}
    local container = locker
    if not container and #containers > 0 then
        container = containers[1]
    end
    if not container and type(point.evidenceContainer) == 'table' then
        container = point.evidenceContainer
    end

    if not container or not isVirtualEvidenceEnabled() then
        return
    end

    lockerActionBusy = true
    setActiveTerminal(point, index)

    local menu = lib.inputDialog(point.label or 'Evidence Locker', {
        {
            type = 'select',
            label = 'Action',
            required = true,
            options = {
                { value = 'store', label = 'Store staging evidence' },
                { value = 'pull', label = 'Pull from locker' },
                { value = 'refresh', label = 'Refresh locker' },
            },
        },
    })

    if not menu then
        lockerActionBusy = false
        return
    end

    local action = menu[1]
    local terminalId = point.terminalId or point.id or ('terminal_%s'):format(index)
    local lockerId = container.lockerId

    if action == 'store' then
        performLockerStore(terminalId, lockerId)
    elseif action == 'pull' then
        performLockerPull(terminalId, lockerId)
    else
        performLockerRefresh(terminalId, lockerId)
    end

    lockerActionBusy = false
end

local function refreshAccess()
    local data = lib.callback.await('cad:getPlayerData', false, {})
    canUseCad = data ~= nil
end

local function fetchTopologySnapshot(quiet)
    local response = lib.callback.await('cad:topology:getSnapshot', false, {})
    if response and response.ok and type(response.snapshot) == 'table' then
        local snapshot = response.snapshot
        topologySnapshot = {
            rev = tonumber(snapshot.rev) or 0,
            terminals = type(snapshot.terminals) == 'table' and snapshot.terminals or {},
            labs = type(snapshot.labs) == 'table' and snapshot.labs or {},
        }
        return true
    end

    if not quiet then
        lib.notify({
            title = 'CAD',
            description = ('Topology unavailable: %s'):format(response and response.error or 'unknown_error'),
            type = 'error',
        })
    end

    return false
end

local function clearTargetZones()
    if not useTargetAccess or GetResourceState('ox_target') ~= 'started' then
        accessZoneIds = {}
        readerZoneIds = {}
        lockerZoneIds = {}
        return
    end

    for i = 1, #accessZoneIds do
        pcall(function()
            exports.ox_target:removeZone(accessZoneIds[i])
        end)
    end

    for i = 1, #readerZoneIds do
        pcall(function()
            exports.ox_target:removeZone(readerZoneIds[i])
        end)
    end

    for i = 1, #lockerZoneIds do
        pcall(function()
            exports.ox_target:removeZone(lockerZoneIds[i])
        end)
    end

    accessZoneIds = {}
    readerZoneIds = {}
    lockerZoneIds = {}
end

local function setupAccessZones()
    local points = getTerminalPoints()

    if useTargetAccess then
        for i = 1, #points do
            local point = normalizeTerminal(points[i], i)
            if point and point.coords then
                local zoneName = ('cad_access_%s'):format(point.terminalId or i)
                local zoneId = exports.ox_target:addSphereZone({
                    name = zoneName,
                    coords = point.coords,
                    radius = point.radius or 1.25,
                    debug = CAD.Config.Debug == true,
                    options = {
                        {
                            name = ('%s_option'):format(zoneName),
                            icon = 'fa-solid fa-desktop',
                            label = ('Abrir CAD (%s)'):format(point.label or 'Terminal'),
                            canInteract = function()
                                return canUseCad
                            end,
                            onSelect = function()
                                setActiveTerminal(point, i)
                                CAD.Client.SetUIState(true)
                            end,
                        },
                    },
                })
                accessZoneIds[#accessZoneIds + 1] = zoneId
            end
        end
        return
    end

    for i = 1, #points do
        local point = normalizeTerminal(points[i], i)
        if point and point.coords then
            lib.zones.sphere({
                coords = point.coords,
                radius = point.radius or 1.25,
                onEnter = function()
                    lib.showTextUI(('[E] %s'):format(point.label or 'CAD PC'))
                end,
                inside = function()
                    if IsControlJustPressed(0, 38) then
                        if canUseCad then
                            setActiveTerminal(point, i)
                            CAD.Client.SetUIState(true)
                        else
                            lib.notify({ title = 'CAD', description = 'No tienes acceso al CAD', type = 'error' })
                        end
                    end
                end,
                onExit = function()
                    lib.hideTextUI()
                end,
            })
        end
    end
end

local function setupReaderZones()
    if not isVirtualReaderEnabled() then
        return
    end

    local points = getTerminalPoints()
    for i = 1, #points do
        local point = normalizeTerminal(points[i], i)
        local reader = point and type(point.reader) == 'table' and point.reader or nil
        if point and reader and point.hasReader then
            local index = i
            local terminalId = point.terminalId or ('terminal_%s'):format(index)
            local coords = getReaderCoords(point)
            if coords then
                local radius = math.max(0.7, getReaderDistance(point))
                local zoneName = ('cad_reader_%s'):format(point.terminalId or index)

                if useTargetAccess then
                    local zoneId = exports.ox_target:addSphereZone({
                        name = zoneName,
                        coords = coords,
                        radius = radius,
                        debug = CAD.Config.Debug == true,
                        options = {
                            {
                                name = ('%s_insert'):format(zoneName),
                                icon = 'fa-solid fa-id-card',
                                label = ('Insertar documento (%s)'):format(point.label or 'Reader'),
                                canInteract = function()
                                    return canUseCad and not readerActionBusy
                                end,
                                onSelect = function()
                                    readerActionBusy = true
                                    setActiveTerminal(point, index)
                                    performReaderInsert(terminalId, tonumber(reader.readSlot) or 1)
                                    readerActionBusy = false
                                end,
                            },
                            {
                                name = ('%s_read'):format(zoneName),
                                icon = 'fa-solid fa-address-card',
                                label = ('Leer documento (%s)'):format(point.label or 'Reader'),
                                canInteract = function()
                                    return canUseCad and not readerActionBusy
                                end,
                                onSelect = function()
                                    readerActionBusy = true
                                    setActiveTerminal(point, index)
                                    performReaderRead(terminalId)
                                    readerActionBusy = false
                                end,
                            },
                            {
                                name = ('%s_eject'):format(zoneName),
                                icon = 'fa-solid fa-eject',
                                label = ('Expulsar documento (%s)'):format(point.label or 'Reader'),
                                canInteract = function()
                                    return canUseCad and not readerActionBusy
                                end,
                                onSelect = function()
                                    readerActionBusy = true
                                    setActiveTerminal(point, index)
                                    performReaderEject(terminalId)
                                    readerActionBusy = false
                                end,
                            },
                        },
                    })
                    readerZoneIds[#readerZoneIds + 1] = zoneId
                else
                    lib.zones.sphere({
                        coords = coords,
                        radius = radius,
                        onEnter = function()
                            lib.showTextUI(('[G] %s'):format((point.label or 'ID Reader') .. ' - Reader'))
                        end,
                        inside = function()
                            if IsControlJustPressed(0, 47) then
                                openReaderActionMenu(point, index)
                            end
                        end,
                        onExit = function()
                            lib.hideTextUI()
                        end,
                    })
                end
            end
        end
    end
end

local function setupLockerZones()
    if not isVirtualEvidenceEnabled() then
        return
    end

    local points = getTerminalPoints()
    for i = 1, #points do
        local point = normalizeTerminal(points[i], i)
        local lockers = point and type(point.lockers) == 'table' and point.lockers or {}

        for l = 1, #lockers do
            local container = lockers[l]
            local index = i
            local terminalId = point.terminalId or ('terminal_%s'):format(index)
            local lockerId = container.lockerId
            local coords = getLockerCoords(container, point)
            if coords then
                local radius = math.max(0.7, getLockerDistance(container, point))
                local zoneName = ('cad_locker_%s_%s'):format(point.terminalId or index, lockerId or l)

                if useTargetAccess then
                    local zoneId = exports.ox_target:addSphereZone({
                        name = zoneName,
                        coords = coords,
                        radius = radius,
                        debug = CAD.Config.Debug == true,
                        options = {
                            {
                                name = ('%s_store'):format(zoneName),
                                icon = 'fa-solid fa-box-archive',
                                label = ('Guardar evidencia (%s)'):format(container.label or point.label or 'Locker'),
                                canInteract = function()
                                    return canUseCad and not lockerActionBusy
                                end,
                                onSelect = function()
                                    lockerActionBusy = true
                                    setActiveTerminal(point, index)
                                    performLockerStore(terminalId, lockerId)
                                    lockerActionBusy = false
                                end,
                            },
                            {
                                name = ('%s_pull'):format(zoneName),
                                icon = 'fa-solid fa-box-open',
                                label = ('Sacar evidencia (%s)'):format(container.label or point.label or 'Locker'),
                                canInteract = function()
                                    return canUseCad and not lockerActionBusy
                                end,
                                onSelect = function()
                                    lockerActionBusy = true
                                    setActiveTerminal(point, index)
                                    performLockerPull(terminalId, lockerId)
                                    lockerActionBusy = false
                                end,
                            },
                            {
                                name = ('%s_refresh'):format(zoneName),
                                icon = 'fa-solid fa-arrows-rotate',
                                label = ('Ver locker (%s)'):format(container.label or point.label or 'Locker'),
                                canInteract = function()
                                    return canUseCad and not lockerActionBusy
                                end,
                                onSelect = function()
                                    lockerActionBusy = true
                                    setActiveTerminal(point, index)
                                    performLockerRefresh(terminalId, lockerId)
                                    lockerActionBusy = false
                                end,
                            },
                        },
                    })
                    lockerZoneIds[#lockerZoneIds + 1] = zoneId
                else
                    lib.zones.sphere({
                        coords = coords,
                        radius = radius,
                        onEnter = function()
                            lib.showTextUI(('[H] %s'):format((container.label or point.label or 'Evidence Locker') .. ' - Locker'))
                        end,
                        inside = function()
                            if IsControlJustPressed(0, 74) then
                                openLockerActionMenu(point, index, container)
                            end
                        end,
                        onExit = function()
                            lib.hideTextUI()
                        end,
                    })
                end
            end
        end
    end
end

local function rebuildTopologyZones(force)
    if not useTargetAccess and zoneInitialized then
        return
    end

    if useTargetAccess then
        clearTargetZones()
    end

    setupAccessZones()
    setupReaderZones()
    setupLockerZones()
    zoneInitialized = true
end

local function setupFrameworkBridge()
    CAD.Core.Client.RegisterAccessEvents(refreshAccess)
end

---@param payload DispatchPublicStatePayload|nil
---@param force boolean|nil
local function pushDispatchPublicStateToUi(payload, force)
    if not payload or type(payload) ~= 'table' then
        return
    end

    if not force and not uiOpen then
        return
    end

    local rev = tonumber(payload.rev) or 0
    if not force and rev <= dispatchPublicRev then
        return
    end

    dispatchPublicRev = rev

    SendNUIMessage({
        action = 'dispatch:publicState',
        data = {
            rev = rev,
            generatedAt = payload.generatedAt,
            calls = payload.calls or {},
            units = payload.units or {},
        },
    })
end

---@param payload CasesPublicStatePayload|nil
---@param force boolean|nil
local function pushCasesPublicStateToUi(payload, force)
    if not payload or type(payload) ~= 'table' then
        return
    end

    if not force and not uiOpen then
        return
    end

    local rev = tonumber(payload.rev) or 0
    if not force and rev <= casesPublicRev then
        return
    end

    casesPublicRev = rev

    SendNUIMessage({
        action = 'case:publicState',
        data = {
            rev = rev,
            generatedAt = payload.generatedAt,
            cases = payload.cases or {},
        },
    })
end

function CAD.Client.SetUIState(open)
    if open == true then
        local nearest = getNearestTerminal()
        if nearest then
            activeTerminalContext = nearest
        end
    end

    uiOpen = open == true

    -- Reinicia el foco antes de abrir para evitar entradas fantasma en NUI.
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)

    if uiOpen then
        Wait(50)
        SetNuiFocus(true, true)

        SetNuiFocusKeepInput(false)
    end

    if uiOpen then
        SendNUIMessage({
            action = 'cad:opened',
            data = {
                terminalId = activeTerminalContext and activeTerminalContext.terminalId or 'unknown',
                location = activeTerminalContext and activeTerminalContext.coords or nil,
                hasContainer = activeTerminalContext and activeTerminalContext.hasContainer or false,
                hasReader = activeTerminalContext and activeTerminalContext.hasReader or false,
                lockerIds = (function()
                    local ids = {}
                    local lockers = activeTerminalContext and activeTerminalContext.lockers or {}
                    for i = 1, #lockers do
                        if lockers[i].lockerId then
                            ids[#ids + 1] = lockers[i].lockerId
                        end
                    end
                    return ids
                end)(),
                defaultLockerId = activeTerminalContext and activeTerminalContext.defaultLockerId or nil,
            }
        })

        pushDispatchPublicStateToUi(GlobalState and GlobalState.cad_dispatch_public or nil, true)
        pushCasesPublicStateToUi(GlobalState and GlobalState.cad_cases_public or nil, true)
    else
        if CAD.SecurityCamera and CAD.SecurityCamera.StopWatch then
            CAD.SecurityCamera.StopWatch()
        end

        SendNUIMessage({
            action = 'cad:closed',
            data = {
                timestamp = GetGameTimer()
            }
        })
    end
end

if type(AddStateBagChangeHandler) == 'function' then
    AddStateBagChangeHandler('cad_dispatch_public', nil, function(bagName, key, value)
        if bagName ~= 'global' or key ~= 'cad_dispatch_public' then
            return
        end

        pushDispatchPublicStateToUi(value, false)
    end)

    AddStateBagChangeHandler('cad_cases_public', nil, function(bagName, key, value)
        if bagName ~= 'global' or key ~= 'cad_cases_public' then
            return
        end

        pushCasesPublicStateToUi(value, false)
    end)
end

RegisterNetEvent('cad:client:topologyUpdated')
AddEventHandler('cad:client:topologyUpdated', function(payload)
    if type(payload) == 'table' and type(payload.snapshot) == 'table' then
        local snapshot = payload.snapshot
        topologySnapshot = {
            rev = tonumber(snapshot.rev) or 0,
            terminals = type(snapshot.terminals) == 'table' and snapshot.terminals or {},
            labs = type(snapshot.labs) == 'table' and snapshot.labs or {},
        }
        rebuildTopologyZones(true)
    else
        if fetchTopologySnapshot(true) then
            rebuildTopologyZones(true)
        end
    end
end)

function CAD.Client.GetComputerContext()
    if not activeTerminalContext then
        local nearest = getNearestTerminal()
        if nearest then
            activeTerminalContext = nearest
        end
    end

    if not activeTerminalContext then
        return {
            ok = false,
            error = 'no_terminal_context',
        }
    end

    return {
        ok = true,
        terminalId = activeTerminalContext.terminalId,
        label = activeTerminalContext.label,
        hasContainer = activeTerminalContext.hasContainer,
        lockerIds = (function()
            local ids = {}
            local lockers = type(activeTerminalContext.lockers) == 'table' and activeTerminalContext.lockers or {}
            for i = 1, #lockers do
                if lockers[i].lockerId then
                    ids[#ids + 1] = lockers[i].lockerId
                end
            end
            return ids
        end)(),
        defaultLockerId = activeTerminalContext.defaultLockerId,
        container = activeTerminalContext.container,
        hasReader = activeTerminalContext.hasReader,
        reader = activeTerminalContext.reader,
    }
end

function CAD.Client.ToggleUI()
    if CAD.Vehicle and CAD.Vehicle.IsPoliceVehicleContext and CAD.Vehicle.OpenTablet then
        local inVehicleTabletContext = CAD.Vehicle.IsPoliceVehicleContext() == true
        if inVehicleTabletContext then
            local isTabletOpen = CAD.Vehicle.IsTabletOpen and CAD.Vehicle.IsTabletOpen() == true
            if isTabletOpen then
                if CAD.Vehicle.CloseTablet then
                    CAD.Vehicle.CloseTablet(true)
                else
                    CAD.Client.SetUIState(false)
                end
            else
                CAD.Vehicle.OpenTablet(false)
            end
            return
        end
    end

    CAD.Client.SetUIState(not uiOpen)
end

RegisterCommand(CAD.Config.UI.Command, function()
    if not canUseCad then
        lib.notify({ title = 'CAD', description = 'No tienes acceso al CAD', type = 'error' })
        return
    end
    CAD.Client.ToggleUI()
end, false)

if CAD.Config.UI.Keybind then
    RegisterKeyMapping(CAD.Config.UI.Command, 'Open CAD', 'keyboard', CAD.Config.UI.Keybind)
end

RegisterNUICallback('closeUI', function(_, cb)
    CAD.Client.SetUIState(false)
    cb({ ok = true })
end)

CreateThread(function()
    Wait(1000)
    refreshAccess()
    fetchTopologySnapshot(true)

    local mode = tostring((CAD.Config.UI.AccessMode or 'auto')):lower()
    useTargetAccess = mode ~= 'zone' and GetResourceState('ox_target') == 'started'

    setupFrameworkBridge()
    rebuildTopologyZones(true)
end)

CreateThread(function()
    if CAD.IsFeatureEnabled and not CAD.IsFeatureEnabled('Dispatch') then
        return
    end

    while true do
        Wait(CAD.Config.Dispatch.PositionBroadcastMs)

        local ped = cache.ped
        if ped and ped ~= 0 then
            local coords = GetEntityCoords(ped)
            TriggerServerEvent('cad:server:updatePosition', {
                x = coords.x,
                y = coords.y,
                z = coords.z,
            })
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    if useTargetAccess and GetResourceState('ox_target') == 'started' then
        clearTargetZones()
    end

    lib.hideTextUI()
    CAD.Client.SetUIState(false)
end)

RegisterNetEvent('cad:client:evidenceStaged')
AddEventHandler('cad:client:evidenceStaged', function(data)
    SendNUIMessage({ action = 'evidence:staged', data = data })
end)

RegisterNetEvent('cad:client:evidenceAnalyzed')
AddEventHandler('cad:client:evidenceAnalyzed', function(data)
    SendNUIMessage({ action = 'evidence:analyzed', data = data })
end)

RegisterNetEvent('cad:client:evidenceCollected')
AddEventHandler('cad:client:evidenceCollected', function(data)
    SendNUIMessage({ action = 'evidence:collected', data = data })
end)

RegisterNetEvent('cad:client:emsAlertCreated')
AddEventHandler('cad:client:emsAlertCreated', function(data)
    SendNUIMessage({ action = 'ems:alertCreated', data = data })
end)

RegisterNetEvent('cad:client:emsAlertUpdated')
AddEventHandler('cad:client:emsAlertUpdated', function(data)
    SendNUIMessage({ action = 'ems:alertUpdated', data = data })
end)

RegisterNetEvent('cad:client:emsCriticalPatient')
AddEventHandler('cad:client:emsCriticalPatient', function(data)
    SendNUIMessage({ action = 'ems:criticalPatient', data = data })
end)

RegisterNetEvent('cad:client:emsLowStock')
AddEventHandler('cad:client:emsLowStock', function(data)
    SendNUIMessage({ action = 'ems:lowStock', data = data })
end)

RegisterNetEvent('cad:client:emsBloodRequest')
AddEventHandler('cad:client:emsBloodRequest', function(data)
    SendNUIMessage({ action = 'ems:bloodRequestCreated', data = data })
end)

RegisterNetEvent('cad:client:forensicsAnalysisStarted')
AddEventHandler('cad:client:forensicsAnalysisStarted', function(data)
    SendNUIMessage({ action = 'forensics:analysisStarted', data = data })
end)

RegisterNetEvent('cad:client:forensicsAnalysisCompleted')
AddEventHandler('cad:client:forensicsAnalysisCompleted', function(data)
    SendNUIMessage({ action = 'forensics:analysisCompleted', data = data })
end)

RegisterNetEvent('cad:client:forensicsEvidenceCompared')
AddEventHandler('cad:client:forensicsEvidenceCompared', function(data)
    SendNUIMessage({ action = 'forensics:evidenceCompared', data = data })
end)

RegisterNetEvent('cad:client:forensicsTraceBagged')
AddEventHandler('cad:client:forensicsTraceBagged', function(data)
    SendNUIMessage({ action = 'forensics:traceBagged', data = data })
end)

RegisterNetEvent('cad:client:photoCaptured')
AddEventHandler('cad:client:photoCaptured', function(data)
    SendNUIMessage({ action = 'photo:captured', data = data })
end)

RegisterNetEvent('cad:client:cameraCreated')
AddEventHandler('cad:client:cameraCreated', function(data)
    SendNUIMessage({ action = 'camera:created', data = data })
end)

RegisterNetEvent('cad:client:cameraUpdated')
AddEventHandler('cad:client:cameraUpdated', function(data)
    SendNUIMessage({ action = 'camera:updated', data = data })
end)

RegisterNetEvent('cad:client:cameraRemoved')
AddEventHandler('cad:client:cameraRemoved', function(data)
    SendNUIMessage({ action = 'camera:removed', data = data })
end)

RegisterNetEvent('cad:client:fineCreated')
AddEventHandler('cad:client:fineCreated', function(data)
    SendNUIMessage({ action = 'fine:created', data = data })
end)

RegisterNetEvent('cad:client:finePaid')
AddEventHandler('cad:client:finePaid', function(data)
    SendNUIMessage({ action = 'fine:paid', data = data })
end)

RegisterNetEvent('cad:client:syncOffline')
AddEventHandler('cad:client:syncOffline', function(data)
    SendNUIMessage({ action = 'cad:syncOffline', data = data })
end)
