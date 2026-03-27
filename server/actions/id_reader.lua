local Config = require 'modules.shared.config'
local State = require 'modules.shared.state'
local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'
local Registry = require 'modules.shared.registry'

local idReaders = State.Forensics.IdReaders

local LEGACY_DOC_HINTS = {
    id_card = true,
    driver_license = true,
    passport = true,
    weaponlicense = true,
    vehicle_registration = true,
    vehicle_registration_card = true,
    registration = true,
}

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
        if type(value) == 'string' and not Utils.IsBlank(value) then
            return Fn.SanitizeString(value, 255)
        end
    end

    return nil
end

local function firstNumber(tbl, keys)
    if type(tbl) ~= 'table' then
        return nil
    end

    for i = 1, #keys do
        local value = deepGet(tbl, keys[i])
        local num = tonumber(value)
        if num then
            return num
        end
    end

    return nil
end

local function firstBool(tbl, keys)
    if type(tbl) ~= 'table' then
        return nil
    end

    for i = 1, #keys do
        local value = deepGet(tbl, keys[i])
        if type(value) == 'boolean' then
            return value
        end
        if type(value) == 'number' then
            return value ~= 0
        end
        if type(value) == 'string' then
            local normalized = value:lower()
            if normalized == 'true' or normalized == '1' or normalized == 'yes' then
                return true
            end
            if normalized == 'false' or normalized == '0' or normalized == 'no' then
                return false
            end
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

    local trimmed = Fn.SanitizeString(name, 120)
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
    return 'generic'
end

local function detectDocumentType(metadata, itemName)
    local plate = firstString(metadata, {
        'plate', 'licensePlate', 'vehPlate', 'vehicle.plate', 'info.plate', 'info.licensePlate',
    })
    local vin = firstString(metadata, {
        'vin', 'vehicleVin', 'vehicle.vin', 'info.vin',
    })
    if plate or vin then
        return 'VEHICLE'
    end

    local citizenId = firstString(metadata, {
        'citizenid', 'citizenId', 'cid', 'identifier', 'charid', 'charId',
        'info.citizenid', 'info.citizenId', 'info.identifier',
    })
    local firstName = firstString(metadata, {
        'firstName', 'firstname', 'charinfo.firstname', 'charInfo.firstname',
        'info.firstname', 'info.firstName',
    })
    local lastName = firstString(metadata, {
        'lastName', 'lastname', 'charinfo.lastname', 'charInfo.lastname',
        'info.lastname', 'info.lastName',
    })
    if citizenId or firstName or lastName then
        return 'PERSON'
    end

    local lowered = tostring(itemName or ''):lower()
    if lowered:find('vehicle', 1, true) or lowered:find('registration', 1, true) then
        return 'VEHICLE'
    end
    if LEGACY_DOC_HINTS[lowered] then
        return 'PERSON'
    end

    return 'UNKNOWN'
end

local function normalizeDocumentPerson(itemName, metadata, sourceSlot)
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

    local createdAt = Utils.ToIso()
    local resolvedCitizenId = citizenId or ('DOC_%s_%s'):format(tostring(itemName or 'id'), tostring(sourceSlot or os.time()))

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

    return person
end

local function normalizeVehicleDocument(metadata)
    local plate = firstString(metadata, {
        'plate', 'licensePlate', 'vehPlate', 'vehicle.plate', 'info.plate', 'info.licensePlate',
    })
    local vin = firstString(metadata, {
        'vin', 'vehicleVin', 'vehicle.vin', 'info.vin',
    })

    if not plate and not vin then
        return nil
    end

    local ownerId = firstString(metadata, {
        'ownerId', 'owner_id', 'ownerCitizenId', 'citizenid',
        'vehicle.ownerId', 'info.ownerId', 'info.citizenid',
    })

    local ownerName = firstString(metadata, {
        'ownerName', 'owner_name', 'registeredOwner',
        'vehicle.ownerName', 'info.ownerName',
    })

    if not ownerName then
        local firstName = firstString(metadata, {
            'firstname', 'firstName', 'charinfo.firstname', 'info.firstname',
        })
        local lastName = firstString(metadata, {
            'lastname', 'lastName', 'charinfo.lastname', 'info.lastname',
        })
        if firstName or lastName then
            ownerName = Utils.Trim(('%s %s'):format(firstName or '', lastName or ''))
        end
    end

    local model = firstString(metadata, {
        'model', 'vehicle.model', 'info.model',
    }) or 'Unknown'

    local make = firstString(metadata, {
        'make', 'brand', 'vehicle.make', 'info.make',
    }) or 'Unknown'

    local year = math.floor(firstNumber(metadata, {
        'year', 'vehicle.year', 'info.year',
    }) or 0)

    local color = firstString(metadata, {
        'color', 'colour', 'vehicle.color', 'info.color',
    }) or 'Unknown'

    local registrationStatus = firstString(metadata, {
        'registrationStatus', 'registration', 'regStatus',
        'vehicle.registrationStatus', 'info.registrationStatus',
    })
    registrationStatus = (registrationStatus and registrationStatus:upper()) or 'VALID'
    if registrationStatus ~= 'VALID' and registrationStatus ~= 'EXPIRED' and registrationStatus ~= 'SUSPENDED' then
        registrationStatus = 'VALID'
    end

    local insuranceStatus = firstString(metadata, {
        'insuranceStatus', 'insurance', 'vehicle.insuranceStatus', 'info.insuranceStatus',
    })
    insuranceStatus = (insuranceStatus and insuranceStatus:upper()) or 'VALID'
    if insuranceStatus ~= 'VALID' and insuranceStatus ~= 'EXPIRED' and insuranceStatus ~= 'NONE' then
        insuranceStatus = 'VALID'
    end

    local stolen = firstBool(metadata, {
        'stolen', 'isStolen', 'vehicle.stolen', 'info.stolen',
    }) == true

    local flags = {}
    local rawFlags = deepGet(metadata, 'flags') or deepGet(metadata, 'info.flags') or deepGet(metadata, 'vehicle.flags')
    if type(rawFlags) == 'table' then
        for i = 1, #rawFlags do
            if type(rawFlags[i]) == 'string' then
                flags[#flags + 1] = Fn.SanitizeString(rawFlags[i], 64)
            end
        end
    elseif type(rawFlags) == 'string' and rawFlags ~= '' then
        flags[1] = Fn.SanitizeString(rawFlags, 64)
    end

    return {
        plate = plate or 'UNKNOWN',
        model = model,
        make = make,
        year = year,
        color = color,
        ownerId = ownerId or 'UNKNOWN',
        ownerName = ownerName or 'Unknown',
        vin = vin or 'UNKNOWN',
        registrationStatus = registrationStatus,
        insuranceStatus = insuranceStatus,
        stolen = stolen,
        flags = flags,
        createdAt = Utils.ToIso(),
    }
end

local function normalizeDocumentPayload(itemName, metadata, sourceSlot)
    local documentType = detectDocumentType(metadata, itemName)
    local source = detectMetadataSource(metadata)

    if documentType == 'VEHICLE' then
        local vehicle = normalizeVehicleDocument(metadata)
        if not vehicle then
            return nil, 'invalid_vehicle_document'
        end

        return {
            documentType = 'VEHICLE',
            source = source,
            metadata = metadata,
            vehicle = vehicle,
        }
    end

    local person = normalizeDocumentPerson(itemName, metadata, sourceSlot)
    return {
        documentType = 'PERSON',
        source = source,
        metadata = metadata,
        person = person,
    }
end

local function getTerminalById(terminalId)
    local points = Config.UI.AccessPoints or {}
    for i = 1, #points do
        local point = points[i]
        if point.id == terminalId then
            return point
        end
    end

    return nil
end

local function isVehicleEndpointId(value)
    return type(value) == 'string' and value:sub(1, 8) == 'vehicle:'
end

local function extractVehicleNetId(payload, terminalId)
    if isVehicleEndpointId(terminalId) then
        local parsed = tonumber(terminalId:sub(9))
        if parsed and parsed > 0 then
            return math.floor(parsed)
        end
    end

    local fromPayload = tonumber(payload and payload.vehicleNetId)
    if fromPayload and fromPayload > 0 then
        return math.floor(fromPayload)
    end

    return nil
end

local function hasVehicleTabletAccess(officer, allowedJobs)
    if officer.isAdmin then
        return true
    end

    if type(allowedJobs) ~= 'table' or #allowedJobs == 0 then
        return true
    end

    local officerJob = tostring(officer.job or '')
    for i = 1, #allowedJobs do
        if tostring(allowedJobs[i]) == officerJob then
            return true
        end
    end

    return false
end

local function resolveVehicleReaderContext(source, payload, officer, rawTerminalId)
    local global = Config.Forensics and Config.Forensics.IdReader or {}
    local vehicleCfg = type(global.VehicleTablet) == 'table' and global.VehicleTablet or {}
    if vehicleCfg.Enabled ~= true then
        return nil, nil, nil, {
            ok = false,
            error = 'vehicle_reader_disabled',
        }
    end

    local allowedJobs = type(vehicleCfg.AllowedJobs) == 'table' and vehicleCfg.AllowedJobs or {}
    if not hasVehicleTabletAccess(officer, allowedJobs) then
        return nil, nil, nil, {
            ok = false,
            error = 'forbidden',
        }
    end

    local vehicleNetId = extractVehicleNetId(payload, rawTerminalId)
    if not vehicleNetId then
        return nil, nil, nil, {
            ok = false,
            error = 'vehicle_netid_required',
        }
    end

    local vehicleEntity = NetworkGetEntityFromNetworkId(vehicleNetId)
    if not vehicleEntity or vehicleEntity == 0 or not DoesEntityExist(vehicleEntity) then
        return nil, nil, nil, {
            ok = false,
            error = 'vehicle_not_found',
        }
    end

    local playerPed = GetPlayerPed(source)
    if not playerPed or playerPed == 0 then
        return nil, nil, nil, {
            ok = false,
            error = 'player_ped_not_found',
        }
    end

    local playerVehicle = GetVehiclePedIsIn(playerPed, false)
    if playerVehicle ~= vehicleEntity then
        return nil, nil, nil, {
            ok = false,
            error = 'not_in_target_vehicle',
        }
    end

    if vehicleCfg.RequireFrontSeat ~= false then
        local driverPed = GetPedInVehicleSeat(playerVehicle, -1)
        local passengerPed = GetPedInVehicleSeat(playerVehicle, 0)
        if driverPed ~= playerPed and passengerPed ~= playerPed then
            return nil, nil, nil, {
                ok = false,
                error = 'front_seat_required',
            }
        end
    end

    local terminalId = ('vehicle:%s'):format(vehicleNetId)
    local slotCount = tonumber(vehicleCfg.Slots) or tonumber(global.SlotCount) or 2
    local readSlot = tonumber(vehicleCfg.ReadSlot) or tonumber(global.ReadSlot) or 1

    local readerConfig = {
        stashId = ('cad_id_reader_vehicle_%s'):format(vehicleNetId),
        label = ('Vehicle ID Reader (%s)'):format(vehicleNetId),
        slots = math.max(1, math.floor(slotCount)),
        weight = 2000,
        readSlot = math.max(1, math.floor(readSlot)),
        allowedItems = type(vehicleCfg.AllowedItems) == 'table' and vehicleCfg.AllowedItems or {},
        strictAllowedItems = vehicleCfg.StrictAllowedItems == true,
        endpointType = 'vehicle',
        vehicleNetId = vehicleNetId,
    }

    local context = {
        id = terminalId,
        label = readerConfig.label,
        jobs = allowedJobs,
        isVehicleEndpoint = true,
        vehicleNetId = vehicleNetId,
    }

    return terminalId, context, readerConfig, nil
end

local function normalizeReaderConfig(terminal)
    local global = Config.Forensics and Config.Forensics.IdReader or {}
    local reader = terminal.idReader
    if type(reader) ~= 'table' or reader.enabled ~= true then
        return nil
    end

    local stashId = reader.stashId
    if type(stashId) ~= 'string' or stashId == '' then
        stashId = ('cad_id_reader_%s'):format(terminal.id or 'terminal')
    end

    local slotCount = tonumber(reader.slots) or tonumber(global.SlotCount) or 5
    local readSlot = tonumber(reader.readSlot) or tonumber(global.ReadSlot) or 1

    return {
        stashId = stashId,
        label = reader.label or ('ID Reader - %s'):format(terminal.label or terminal.id or 'Terminal'),
        slots = math.max(1, math.floor(slotCount)),
        weight = tonumber(reader.weight) or 2000,
        readSlot = math.max(1, math.floor(readSlot)),
        allowedItems = type(reader.allowedItems) == 'table' and reader.allowedItems or {},
        strictAllowedItems = global.StrictAllowedItems == true,
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
    local strict = readerConfig.strictAllowedItems == true
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

local function isDocumentCandidate(readerConfig, item)
    if not item or not item.name then
        return false, 'UNKNOWN'
    end

    if not isAllowedItemName(readerConfig, item.name) then
        return false, 'UNKNOWN'
    end

    local metadata = type(item.metadata) == 'table' and item.metadata or {}
    local documentType = detectDocumentType(metadata, item.name)

    if readerConfig.strictAllowedItems == true then
        return true, documentType
    end

    if documentType ~= 'UNKNOWN' then
        return true, documentType
    end

    return LEGACY_DOC_HINTS[tostring(item.name):lower()] == true, 'PERSON'
end

local function readerFeatureEnabled()
    local cfg = Config.Forensics and Config.Forensics.IdReader or {}
    return cfg.Enabled == true and cfg.UseVirtualContainer == true and Registry.Get("VirtualContainer") ~= nil
end

local function resolveReaderContext(source, payload, officer)
    local terminalId = Fn.SanitizeString(payload and payload.terminalId, 64)
    if terminalId == '' then
        return nil, nil, nil, {
            ok = false,
            error = 'terminal_id_required',
        }
    end

    if isVehicleEndpointId(terminalId) then
        return resolveVehicleReaderContext(source, payload, officer, terminalId)
    end

    local terminal = getTerminalById(terminalId)
    if not terminal then
        return nil, nil, nil, {
            ok = false,
            error = 'terminal_not_found',
        }
    end

    local readerConfig = normalizeReaderConfig(terminal)
    if not readerConfig then
        return nil, nil, nil, {
            ok = false,
            error = 'reader_not_enabled',
        }
    end

    if not hasTerminalAccess(officer, terminal) then
        return nil, nil, nil, {
            ok = false,
            error = 'forbidden',
        }
    end

    return terminalId, terminal, readerConfig, nil
end

local function getVirtualContainerKey(terminalId)
    if isVehicleEndpointId(terminalId) then
        return terminalId
    end

    return ('terminal:%s'):format(terminalId)
end

local function ensureVirtualReaderContainer(terminalId, readerConfig)
    local containerKey = getVirtualContainerKey(terminalId)
    local container, ensureErr = Registry.Get("VirtualContainer").Ensure(containerKey, {
        containerType = 'id_reader',
        endpointId = terminalId,
        slotCount = readerConfig.slots,
        readSlot = readerConfig.readSlot,
        strictAllowedItems = readerConfig.strictAllowedItems,
        allowedItems = readerConfig.allowedItems,
    })

    if not container then
        return nil, ensureErr or 'container_not_ready'
    end

    return container, nil
end

local function getInventoryItems(source)
    local items = exports.ox_inventory:GetInventoryItems(source) or {}
    local output = {}
    for i = 1, #items do
        local row = items[i]
        if row and row.name and (tonumber(row.count) or 0) > 0 then
            output[#output + 1] = row
        end
    end
    return output
end

local function getVirtualReaderSlot(containerKey, readerConfig, requestedSlot)
    local targetSlot = tonumber(requestedSlot)
    if targetSlot and targetSlot > 0 then
        local slotData = Registry.Get("VirtualContainer").GetSlot(containerKey, targetSlot)
        if slotData and slotData.itemName then
            return targetSlot, slotData
        end
    end

    local preferredSlot = tonumber(readerConfig.readSlot)
    if preferredSlot and preferredSlot > 0 then
        local slotData = Registry.Get("VirtualContainer").GetSlot(containerKey, preferredSlot)
        if slotData and slotData.itemName then
            return preferredSlot, slotData
        end
    end

    local firstSlot, firstData = Registry.Get("VirtualContainer").GetFirstOccupied(containerKey)
    if firstData and firstData.itemName then
        return firstSlot, firstData
    end

    return nil, nil
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

local function getReaderStashSlotItem(readerConfig, slot)
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

lib.callback.register('cad:idreader:listDocuments', Auth.WithGuard('default', function(source, payload, officer)
    if not readerFeatureEnabled() then
        return {
            ok = false,
            error = 'virtual_reader_disabled',
        }
    end

    local terminalId, _, readerConfig, errorResponse = resolveReaderContext(source, payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualReaderContainer(terminalId, readerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    local items = getInventoryItems(source)
    local docs = {}
    for i = 1, #items do
        local item = items[i]
        local allowed, documentType = isDocumentCandidate(readerConfig, item)
        if allowed then
            docs[#docs + 1] = {
                slot = tonumber(item.slot) or 0,
                name = item.name,
                label = item.label or item.name,
                count = tonumber(item.count) or 1,
                documentType = documentType,
            }
        end
    end

    return {
        ok = true,
        terminalId = terminalId,
        containerKey = container.containerKey,
        expectedSlot = container.readSlot,
        documents = docs,
    }
end))

lib.callback.register('cad:idreader:insert', Auth.WithGuard('default', function(source, payload, officer)
    if not readerFeatureEnabled() then
        return {
            ok = false,
            error = 'virtual_reader_disabled',
        }
    end

    if GetResourceState('ox_inventory') ~= 'started' then
        return {
            ok = false,
            error = 'ox_inventory_missing',
        }
    end

    local terminalId, _, readerConfig, errorResponse = resolveReaderContext(source, payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualReaderContainer(terminalId, readerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    local targetSlot = math.floor(tonumber(payload and payload.slot) or container.readSlot or readerConfig.readSlot)
    if targetSlot <= 0 or targetSlot > container.slotCount then
        return {
            ok = false,
            error = 'slot_out_of_bounds',
        }
    end

    if Registry.Get("VirtualContainer").GetSlot(container.containerKey, targetSlot) then
        return {
            ok = false,
            error = 'slot_occupied',
            slot = targetSlot,
        }
    end

    local inventorySlot = math.floor(tonumber(payload and payload.inventorySlot) or 0)
    local selected = nil

    if inventorySlot > 0 then
        local bySlot = exports.ox_inventory:GetSlot(source, inventorySlot)
        local allowed = isDocumentCandidate(readerConfig, bySlot)
        if allowed then
            selected = bySlot
        end
    end

    if not selected then
        local items = getInventoryItems(source)
        for i = 1, #items do
            local allowed = isDocumentCandidate(readerConfig, items[i])
            if allowed then
                selected = items[i]
                break
            end
        end
    end

    if not selected then
        return {
            ok = false,
            error = 'no_supported_documents',
        }
    end

    local metadata = type(selected.metadata) == 'table' and selected.metadata or {}
    local normalized, normalizeErr = normalizeDocumentPayload(selected.name, metadata, selected.slot)
    if not normalized then
        return {
            ok = false,
            error = normalizeErr or 'invalid_document',
        }
    end

    local removed = exports.ox_inventory:RemoveItem(
        source,
        selected.name,
        1,
        metadata,
        tonumber(selected.slot) or nil,
        true,
        false
    )

    if not removed then
        removed = exports.ox_inventory:RemoveItem(source, selected.name, 1, nil, tonumber(selected.slot) or nil, true, false)
    end

    if not removed then
        return {
            ok = false,
            error = 'cannot_remove_item',
        }
    end

    local setOk, setErr = Registry.Get("VirtualContainer").SetSlot(container.containerKey, targetSlot, {
        itemName = selected.name,
        label = selected.label or selected.name,
        count = 1,
        metadata = metadata,
        sourceSlot = selected.slot,
        documentType = normalized.documentType,
        insertedBy = officer.identifier,
        insertedAt = Utils.ToIso(),
    })

    if not setOk then
        exports.ox_inventory:AddItem(source, selected.name, 1, metadata)
        return {
            ok = false,
            error = setErr or 'container_write_failed',
        }
    end

    return {
        ok = true,
        terminalId = terminalId,
        containerKey = container.containerKey,
        slot = targetSlot,
        documentType = normalized.documentType,
        item = {
            name = selected.name,
            label = selected.label or selected.name,
            sourceSlot = selected.slot,
        },
    }
end))

lib.callback.register('cad:idreader:eject', Auth.WithGuard('default', function(source, payload, officer)
    if not readerFeatureEnabled() then
        return {
            ok = false,
            error = 'virtual_reader_disabled',
        }
    end

    if GetResourceState('ox_inventory') ~= 'started' then
        return {
            ok = false,
            error = 'ox_inventory_missing',
        }
    end

    local terminalId, _, readerConfig, errorResponse = resolveReaderContext(source, payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualReaderContainer(terminalId, readerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    local targetSlot, slotData = getVirtualReaderSlot(container.containerKey, readerConfig, payload and payload.slot)
    if not slotData then
        return {
            ok = false,
            error = 'no_document_in_reader',
            expectedSlot = readerConfig.readSlot,
        }
    end

    local itemName = tostring(slotData.itemName or '')
    if itemName == '' then
        return {
            ok = false,
            error = 'invalid_slot_data',
        }
    end

    local metadata = type(slotData.metadata) == 'table' and slotData.metadata or {}
    local added = exports.ox_inventory:AddItem(source, itemName, math.max(1, tonumber(slotData.count) or 1), metadata)
    if not added then
        return {
            ok = false,
            error = 'cannot_return_item',
        }
    end

    local clearOk, clearErr = Registry.Get("VirtualContainer").ClearSlot(container.containerKey, targetSlot)
    if not clearOk then
        exports.ox_inventory:RemoveItem(source, itemName, math.max(1, tonumber(slotData.count) or 1), metadata, nil, true, false)
        return {
            ok = false,
            error = clearErr or 'container_clear_failed',
        }
    end

    return {
        ok = true,
        terminalId = terminalId,
        containerKey = container.containerKey,
        slot = targetSlot,
        item = {
            name = itemName,
            label = slotData.label or itemName,
        },
    }
end))

lib.callback.register('cad:idreader:getContainer', Auth.WithGuard('default', function(source, payload, officer)
    if not readerFeatureEnabled() then
        return {
            ok = false,
            error = 'virtual_reader_disabled',
        }
    end

    local terminalId, _, readerConfig, errorResponse = resolveReaderContext(source, payload, officer)
    if errorResponse then
        return errorResponse
    end

    local container, containerErr = ensureVirtualReaderContainer(terminalId, readerConfig)
    if not container then
        return {
            ok = false,
            error = containerErr or 'container_not_ready',
        }
    end

    return {
        ok = true,
        terminalId = terminalId,
        containerKey = container.containerKey,
        slotCount = container.slotCount,
        readSlot = container.readSlot,
        slots = Registry.Get("VirtualContainer").List(container.containerKey),
    }
end))

lib.callback.register('cad:idreader:read', Auth.WithGuard('default', function(source, payload, officer)
    local terminalId, terminal, readerConfig, errorResponse = resolveReaderContext(source, payload, officer)
    if errorResponse then
        return errorResponse
    end

    if readerFeatureEnabled() then
        local container, containerErr = ensureVirtualReaderContainer(terminalId, readerConfig)
        if not container then
            return {
                ok = false,
                error = containerErr or 'container_not_ready',
            }
        end

        local slotIndex, slotData = getVirtualReaderSlot(container.containerKey, readerConfig, payload and payload.slot)
        if not slotData then
            return {
                ok = false,
                error = 'no_document_in_reader',
                expectedSlot = readerConfig.readSlot,
                containerKey = container.containerKey,
            }
        end

        local normalized, normalizeErr = normalizeDocumentPayload(
            slotData.itemName,
            type(slotData.metadata) == 'table' and slotData.metadata or {},
            slotIndex
        )

        if not normalized then
            return {
                ok = false,
                error = normalizeErr or 'invalid_document',
                slot = slotIndex,
            }
        end

        return {
            ok = true,
            terminalId = terminalId,
            containerKey = container.containerKey,
            documentType = normalized.documentType,
            item = {
                name = slotData.itemName,
                label = slotData.label,
                slot = slotIndex,
            },
            source = normalized.source,
            person = normalized.person,
            vehicle = normalized.vehicle,
            metadata = normalized.metadata,
        }
    end

    if terminal and terminal.isVehicleEndpoint then
        return {
            ok = false,
            error = 'vehicle_reader_requires_virtual_container',
        }
    end

    local ready, ensureErr = ensureReaderStash(terminal, readerConfig)
    if not ready then
        return {
            ok = false,
            error = ensureErr or 'reader_not_ready',
        }
    end

    local item = getReaderStashSlotItem(readerConfig, payload and payload.slot)
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

    local normalized, normalizeErr = normalizeDocumentPayload(
        item.name,
        type(item.metadata) == 'table' and item.metadata or {},
        tonumber(item.slot) or nil
    )

    if not normalized then
        return {
            ok = false,
            error = normalizeErr or 'invalid_document',
        }
    end

    return {
        ok = true,
        terminalId = terminalId,
        stashId = readerConfig.stashId,
        documentType = normalized.documentType,
        item = {
            name = item.name,
            label = item.label,
            slot = item.slot,
        },
        source = normalized.source,
        person = normalized.person,
        vehicle = normalized.vehicle,
        metadata = normalized.metadata,
    }
end))
