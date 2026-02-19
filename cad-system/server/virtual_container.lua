-- This is a way to not use stash from ox and use my own implementations, basically a table that handle the items... thats it

CAD = CAD or {}
CAD.VirtualContainer = CAD.VirtualContainer or {}

CAD.State = CAD.State or {}
CAD.State.Forensics = CAD.State.Forensics or {}
CAD.State.Forensics.VirtualContainers = CAD.State.Forensics.VirtualContainers or {}
CAD.State.Forensics.VirtualContainerLocks = CAD.State.Forensics.VirtualContainerLocks or {}

local containers = CAD.State.Forensics.VirtualContainers
local containerLocks = CAD.State.Forensics.VirtualContainerLocks

local function safeIso(ts)
    if CAD.Server and CAD.Server.ToIso then
        return CAD.Server.ToIso(ts)
    end
    return os.date('!%Y-%m-%dT%H:%M:%SZ', ts or os.time())
end

local function sanitizeKey(raw)
    local value = tostring(raw or '')
    value = value:gsub('[\r\n\t]+', '')
    value = CAD.StringCompact(value)
    if #value > 128 then
        value = value:sub(1, 128)
    end
    return value
end

local function clone(value)
    return CAD.DeepCopy(value)
end

local function decodeJson(raw)
    if type(raw) ~= 'string' or raw == '' then
        return nil
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok then
        return nil
    end

    return decoded
end

local function isPersistenceEnabled()
    local cfg = CAD.Config and CAD.Config.Forensics and CAD.Config.Forensics.VirtualContainer or nil
    if cfg and cfg.Persistence == false then
        return false
    end
    return true
end

local function ensureContainerRecord(containerKey, options)
    local key = sanitizeKey(containerKey)
    if key == '' then
        return nil
    end

    local existing = containers[key]
    if existing then
        if type(options) == 'table' then
            if options.containerType then
                existing.containerType = tostring(options.containerType)
            end
            if options.endpointId then
                existing.endpointId = tostring(options.endpointId)
            end
            if tonumber(options.slotCount) then
                existing.slotCount = math.max(1, math.floor(tonumber(options.slotCount)))
            end
            if tonumber(options.readSlot) then
                existing.readSlot = math.max(1, math.floor(tonumber(options.readSlot)))
            end
            if type(options.allowedItems) == 'table' then
                existing.allowedItems = clone(options.allowedItems)
            end
            if options.strictAllowedItems ~= nil then
                existing.strictAllowedItems = options.strictAllowedItems == true
            end
        end

        return existing
    end

    local nowIso = safeIso()
    local slotCount = 5
    local readSlot = 1
    if type(options) == 'table' then
        slotCount = math.max(1, math.floor(tonumber(options.slotCount) or slotCount))
        readSlot = math.max(1, math.floor(tonumber(options.readSlot) or readSlot))
    end

    local container = {
        containerKey = key,
        containerType = tostring((type(options) == 'table' and options.containerType) or 'generic'),
        endpointId = tostring((type(options) == 'table' and options.endpointId) or key),
        slotCount = slotCount,
        readSlot = readSlot,
        strictAllowedItems = type(options) == 'table' and options.strictAllowedItems == true or false,
        allowedItems = type(options) == 'table' and type(options.allowedItems) == 'table' and clone(options.allowedItems) or {},
        slots = {},
        createdAt = nowIso,
        updatedAt = nowIso,
        version = 1,
    }

    containers[key] = container
    return container
end

local function upsertSlotInDatabase(containerKey, container, slotIndex, slotData)
    if not isPersistenceEnabled() then
        return true
    end

    local ok, err = pcall(function()
        MySQL.query.await([[
            INSERT INTO cad_virtual_container_slots (
                container_key,
                container_type,
                endpoint_id,
                slot_index,
                item_name,
                item_label,
                item_count,
                metadata,
                inserted_by,
                inserted_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                container_type = VALUES(container_type),
                endpoint_id = VALUES(endpoint_id),
                item_name = VALUES(item_name),
                item_label = VALUES(item_label),
                item_count = VALUES(item_count),
                metadata = VALUES(metadata),
                inserted_by = VALUES(inserted_by),
                inserted_at = VALUES(inserted_at),
                updated_at = VALUES(updated_at)
        ]], {
            containerKey,
            container.containerType,
            container.endpointId,
            slotIndex,
            tostring(slotData.itemName or ''),
            tostring(slotData.label or slotData.itemLabel or ''),
            math.max(1, math.floor(tonumber(slotData.count) or 1)),
            json.encode(slotData.metadata or {}),
            slotData.insertedBy and tostring(slotData.insertedBy) or nil,
            slotData.insertedAt and tostring(slotData.insertedAt) or nil,
            container.updatedAt,
        })
    end)

    if not ok then
        CAD.Log('error', 'Failed to persist virtual slot %s[%s]: %s', tostring(containerKey), tostring(slotIndex), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

local function clearSlotInDatabase(containerKey, slotIndex)
    if not isPersistenceEnabled() then
        return true
    end

    local ok, err = pcall(function()
        MySQL.query.await('DELETE FROM cad_virtual_container_slots WHERE container_key = ? AND slot_index = ?', {
            containerKey,
            slotIndex,
        })
    end)

    if not ok then
        CAD.Log('error', 'Failed to clear virtual slot %s[%s]: %s', tostring(containerKey), tostring(slotIndex), tostring(err))
        return false, 'db_delete_failed'
    end

    return true
end

function CAD.VirtualContainer.WithLock(containerKey, handler)
    local key = sanitizeKey(containerKey)
    if key == '' then
        return false, 'invalid_container_key'
    end

    if containerLocks[key] then
        return false, 'container_busy'
    end

    containerLocks[key] = true

    local ok, a, b, c = pcall(handler)

    containerLocks[key] = nil

    if not ok then
        CAD.Log('error', 'Virtual container lock handler failed (%s): %s', tostring(key), tostring(a))
        return false, 'internal_error'
    end

    return a, b, c
end

function CAD.VirtualContainer.Ensure(containerKey, options)
    local container = ensureContainerRecord(containerKey, options)
    if not container then
        return nil, 'invalid_container_key'
    end
    return container
end

function CAD.VirtualContainer.Get(containerKey)
    local key = sanitizeKey(containerKey)
    if key == '' then
        return nil
    end
    return containers[key]
end

function CAD.VirtualContainer.GetSlot(containerKey, slot)
    local container = CAD.VirtualContainer.Get(containerKey)
    if not container then
        return nil
    end

    local slotIndex = math.floor(tonumber(slot) or 0)
    if slotIndex <= 0 then
        return nil
    end

    return container.slots[slotIndex]
end

function CAD.VirtualContainer.GetFirstOccupied(containerKey)
    local container = CAD.VirtualContainer.Get(containerKey)
    if not container then
        return nil, nil
    end

    for i = 1, container.slotCount do
        local entry = container.slots[i]
        if entry and entry.itemName then
            return i, entry
        end
    end

    return nil, nil
end

function CAD.VirtualContainer.List(containerKey)
    local container = CAD.VirtualContainer.Get(containerKey)
    if not container then
        return {}
    end

    local output = {}
    for i = 1, container.slotCount do
        local slotData = container.slots[i]
        if slotData then
            local row = clone(slotData)
            row.slot = i
            output[#output + 1] = row
        end
    end

    return output
end

function CAD.VirtualContainer.SetSlot(containerKey, slot, slotData)
    local container = CAD.VirtualContainer.Get(containerKey)
    if not container then
        return false, 'container_not_found'
    end

    local slotIndex = math.floor(tonumber(slot) or 0)
    if slotIndex <= 0 or slotIndex > container.slotCount then
        return false, 'slot_out_of_bounds'
    end

    if type(slotData) ~= 'table' or type(slotData.itemName) ~= 'string' or slotData.itemName == '' then
        return false, 'invalid_slot_data'
    end

    local previous = container.slots[slotIndex]
    local nowIso = safeIso()

    container.updatedAt = nowIso
    container.version = (tonumber(container.version) or 0) + 1
    container.slots[slotIndex] = {
        itemName = tostring(slotData.itemName),
        label = tostring(slotData.label or slotData.itemLabel or slotData.itemName),
        count = math.max(1, math.floor(tonumber(slotData.count) or 1)),
        metadata = type(slotData.metadata) == 'table' and clone(slotData.metadata) or {},
        documentType = slotData.documentType and tostring(slotData.documentType) or nil,
        insertedBy = slotData.insertedBy and tostring(slotData.insertedBy) or nil,
        insertedAt = slotData.insertedAt and tostring(slotData.insertedAt) or nowIso,
        sourceSlot = tonumber(slotData.sourceSlot) or nil,
    }

    local persisted, persistErr = upsertSlotInDatabase(containerKey, container, slotIndex, container.slots[slotIndex])
    if not persisted then
        container.slots[slotIndex] = previous
        return false, persistErr
    end

    return true
end

function CAD.VirtualContainer.ClearSlot(containerKey, slot)
    local container = CAD.VirtualContainer.Get(containerKey)
    if not container then
        return false, 'container_not_found'
    end

    local slotIndex = math.floor(tonumber(slot) or 0)
    if slotIndex <= 0 or slotIndex > container.slotCount then
        return false, 'slot_out_of_bounds'
    end

    local previous = container.slots[slotIndex]
    if not previous then
        return true
    end

    local nowIso = safeIso()
    container.updatedAt = nowIso
    container.version = (tonumber(container.version) or 0) + 1
    container.slots[slotIndex] = nil

    local cleared, clearErr = clearSlotInDatabase(containerKey, slotIndex)
    if not cleared then
        container.slots[slotIndex] = previous
        return false, clearErr
    end

    return true
end

function CAD.VirtualContainer.LoadFromDatabase()
    if not isPersistenceEnabled() then
        return 0
    end

    local ok, rows = pcall(function()
        return MySQL.query.await('SELECT * FROM cad_virtual_container_slots ORDER BY container_key ASC, slot_index ASC')
    end)

    if not ok then
        CAD.Log('error', 'Failed loading virtual containers from DB: %s', tostring(rows))
        return 0
    end

    local total = 0

    for i = 1, #rows do
        local row = rows[i]
        local key = sanitizeKey(row.container_key)
        local slotIndex = math.floor(tonumber(row.slot_index) or 0)
        if key ~= '' and slotIndex > 0 then
            local container = ensureContainerRecord(key, {
                containerType = row.container_type,
                endpointId = row.endpoint_id,
                slotCount = slotIndex,
            })

            if container then
                if slotIndex > container.slotCount then
                    container.slotCount = slotIndex
                end

                container.slots[slotIndex] = {
                    itemName = tostring(row.item_name or ''),
                    label = tostring(row.item_label or row.item_name or 'document'),
                    count = math.max(1, math.floor(tonumber(row.item_count) or 1)),
                    metadata = decodeJson(row.metadata) or {},
                    insertedBy = row.inserted_by,
                    insertedAt = row.inserted_at,
                }

                container.updatedAt = row.updated_at or container.updatedAt
                total = total + 1
            end
        end
    end

    return total
end
