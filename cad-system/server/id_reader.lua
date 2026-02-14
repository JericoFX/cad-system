--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}

local idReaders = CAD.State.Forensics.IdReaders

local function splitPath(path)
    local parts = {}
    for segment in tostring(path):gmatch('[^%.]+') do
        parts[#parts + 1] = segment
    end
    return parts
end

local function deepGet(tbl, path)
    if type(tbl) ~= 'table' or type(path) ~= 'string' or path == '' then
        return nil
    end

    local cursor = tbl
    local parts = splitPath(path)
    for i = 1, #parts do
        if type(cursor) ~= 'table' then
            return nil
        end
        cursor = cursor[parts[i]]
    end

    return cursor
end

local function firstString(tbl, keys)
    if type(tbl) ~= 'table' then
        return nil
    end

    for i = 1, #keys do
        local value = deepGet(tbl, keys[i])
        if type(value) == 'string' and value:gsub('%s+', '') ~= '' then
            return CAD.Server.SanitizeString(value, 255)
        end
    end

    return nil
end

local function normalizeGender(raw)
    local value = tostring(raw or ''):lower()
    if value == 'm' or value == 'male' or value == 'man' then
        return 'MALE'
    end
    if value == 'f' or value == 'female' or value == 'woman' then
        return 'FEMALE'
    end
    return 'OTHER'
end

local function splitFullName(name)
    if type(name) ~= 'string' then
        return nil, nil
    end

    local trimmed = CAD.Server.SanitizeString(name, 120)
    if trimmed == '' then
        return nil, nil
    end

    local first = trimmed:match('^(%S+)')
    local last = trimmed:match('%s+(.+)$')
    if not first then
        return nil, nil
    end

    if not last or last == '' then
        return first, 'Unknown'
    end

    return first, last
end

local function detectMetadataSource(metadata)
    if type(metadata.info) == 'table' then
        return 'qb-inventory-info'
    end
    if type(metadata.charinfo) == 'table' or type(metadata.charInfo) == 'table' then
        return 'qb-character'
    end
    if metadata.identifier or metadata.firstname or metadata.lastname then
        return 'esx/legacy-like'
    end
    return 'generic'
end

local function normalizeDocumentPerson(item)
    local metadata = type(item.metadata) == 'table' and item.metadata or {}

    local citizenId = firstString(metadata, {
        'citizenid', 'citizenId', 'cid', 'identifier', 'charid', 'charId',
        'info.citizenid', 'info.citizenId', 'info.identifier', 'data.citizenid',
    })

    local firstName = firstString(metadata, {
        'firstName', 'firstname', 'name.first',
        'charinfo.firstname', 'charInfo.firstname',
        'info.firstname', 'info.firstName',
    })

    local lastName = firstString(metadata, {
        'lastName', 'lastname', 'name.last',
        'charinfo.lastname', 'charInfo.lastname',
        'info.lastname', 'info.lastName',
    })

    local fullName = firstString(metadata, {
        'fullName', 'fullname', 'name', 'info.name', 'info.fullname',
    })

    if (not firstName or not lastName) and fullName then
        local splitFirst, splitLast = splitFullName(fullName)
        firstName = firstName or splitFirst
        lastName = lastName or splitLast
    end

    local dob = firstString(metadata, {
        'dateOfBirth', 'dob', 'birthdate', 'dateofbirth',
        'charinfo.birthdate', 'charInfo.birthdate',
        'info.birthdate', 'info.dob',
    })

    local ssn = firstString(metadata, {
        'ssn', 'nationalId', 'nationalid',
        'info.ssn', 'info.nationalid',
    })

    local phone = firstString(metadata, {
        'phone', 'phoneNumber', 'phonenumber',
        'charinfo.phone', 'charInfo.phone',
        'info.phone', 'info.phoneNumber',
    })

    local address = firstString(metadata, {
        'address', 'street', 'residence',
        'info.address', 'info.street',
    })

    local bloodType = firstString(metadata, {
        'bloodType', 'bloodtype',
        'charinfo.bloodtype', 'charInfo.bloodtype',
        'info.bloodtype', 'info.bloodType',
    })

    local allergies = firstString(metadata, {
        'allergies', 'medical.allergies', 'info.allergies',
    })

    local genderRaw = firstString(metadata, {
        'gender', 'sex',
        'charinfo.gender', 'charInfo.gender',
        'info.gender', 'info.sex',
    })

    local photo = firstString(metadata, {
        'photo', 'image', 'mugshot', 'url', 'info.photo', 'info.image',
    })

    local createdAt = CAD.Server.ToIso()
    local resolvedCitizenId = citizenId or ('DOC_%s'):format(item.slot or os.time())

    local person = {
        citizenid = resolvedCitizenId,
        firstName = firstName or 'Unknown',
        lastName = lastName or 'Unknown',
        dateOfBirth = dob or 'Unknown',
        ssn = ssn or 'N/A',
        phone = phone,
        address = address,
        bloodType = bloodType,
        allergies = allergies,
        gender = normalizeGender(genderRaw),
        photo = photo,
        createdAt = createdAt,
        lastUpdated = createdAt,
        isDead = false,
    }

    return {
        person = person,
        source = detectMetadataSource(metadata),
        metadata = metadata,
    }
end

local function getTerminalById(terminalId)
    local points = CAD.Config.UI.AccessPoints or {}
    for i = 1, #points do
        local point = points[i]
        if point.id == terminalId then
            return point
        end
    end

    return nil
end

local function normalizeReaderConfig(terminal)
    local reader = terminal.idReader
    if type(reader) ~= 'table' or reader.enabled ~= true then
        return nil
    end

    local stashId = reader.stashId
    if type(stashId) ~= 'string' or stashId == '' then
        stashId = ('cad_id_reader_%s'):format(terminal.id or 'terminal')
    end

    return {
        stashId = stashId,
        label = reader.label or ('ID Reader - %s'):format(terminal.label or terminal.id or 'Terminal'),
        slots = tonumber(reader.slots) or 5,
        weight = tonumber(reader.weight) or 2000,
        readSlot = tonumber(reader.readSlot) or 1,
        allowedItems = type(reader.allowedItems) == 'table' and reader.allowedItems or {},
    }
end

local function hasTerminalAccess(officer, terminal)
    if not terminal.jobs or #terminal.jobs == 0 then
        return true
    end

    if officer.isAdmin then
        return true
    end

    for i = 1, #terminal.jobs do
        if terminal.jobs[i] == officer.job then
            return true
        end
    end

    return false
end

local function isAllowedItemName(readerConfig, itemName)
    local strict = CAD.Config.Forensics.IdReader.StrictAllowedItems == true
    if not strict then
        return true
    end

    local allowed = readerConfig.allowedItems
    if not allowed or #allowed == 0 then
        return true
    end

    for i = 1, #allowed do
        if allowed[i] == itemName then
            return true
        end
    end

    return false
end

local function ensureReaderStash(terminal, readerConfig)
    if GetResourceState('ox_inventory') ~= 'started' then
        return false, 'ox_inventory_missing'
    end

    if idReaders[readerConfig.stashId] then
        return true
    end

    local groups = {}
    if type(terminal.jobs) == 'table' then
        for i = 1, #terminal.jobs do
            groups[terminal.jobs[i]] = 0
        end
    end

    local ok, err = pcall(function()
        exports.ox_inventory:RegisterStash(
            readerConfig.stashId,
            readerConfig.label,
            readerConfig.slots,
            readerConfig.weight,
            false,
            groups,
            terminal.coords
        )
    end)

    if not ok then
        return false, tostring(err)
    end

    idReaders[readerConfig.stashId] = true
    return true
end

local function getReaderSlotItem(readerConfig, slot)
    local targetSlot = tonumber(slot) or readerConfig.readSlot
    if targetSlot and targetSlot > 0 then
        local slotItem = exports.ox_inventory:GetSlot(readerConfig.stashId, targetSlot)
        if slotItem and slotItem.name then
            return slotItem
        end
    end

    local items = exports.ox_inventory:GetInventoryItems(readerConfig.stashId) or {}
    for i = 1, #items do
        local row = items[i]
        if row and row.name and (tonumber(row.count) or 0) > 0 then
            return row
        end
    end

    return nil
end

lib.callback.register('cad:idreader:read', CAD.Auth.WithGuard('default', function(source, payload, officer)
    local terminalId = CAD.Server.SanitizeString(payload and payload.terminalId, 64)
    if terminalId == '' then
        return {
            ok = false,
            error = 'terminal_id_required',
        }
    end

    local terminal = getTerminalById(terminalId)
    if not terminal then
        return {
            ok = false,
            error = 'terminal_not_found',
        }
    end

    local readerConfig = normalizeReaderConfig(terminal)
    if not readerConfig then
        return {
            ok = false,
            error = 'reader_not_enabled',
        }
    end

    if not hasTerminalAccess(officer, terminal) then
        return {
            ok = false,
            error = 'forbidden',
        }
    end

    local ready, ensureErr = ensureReaderStash(terminal, readerConfig)
    if not ready then
        return {
            ok = false,
            error = ensureErr or 'reader_not_ready',
        }
    end

    local item = getReaderSlotItem(readerConfig, payload and payload.slot)
    if not item then
        return {
            ok = false,
            error = 'no_document_in_reader',
            stashId = readerConfig.stashId,
            expectedSlot = readerConfig.readSlot,
        }
    end

    if not isAllowedItemName(readerConfig, item.name) then
        return {
            ok = false,
            error = 'item_not_allowed',
            itemName = item.name,
        }
    end

    local normalized = normalizeDocumentPerson(item)

    return {
        ok = true,
        terminalId = terminalId,
        stashId = readerConfig.stashId,
        item = {
            name = item.name,
            label = item.label,
            slot = item.slot,
        },
        source = normalized.source,
        person = normalized.person,
        metadata = normalized.metadata,
    }
end))
