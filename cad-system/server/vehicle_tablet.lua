CAD = CAD or {}
CAD.VehicleTablet = CAD.VehicleTablet or {}

---@class CadEntityNote
---@field id string
---@field entityType 'PERSON'|'VEHICLE'
---@field entityId string
---@field author string
---@field authorName string|nil
---@field content string
---@field important boolean
---@field timestamp string

---@class CadVehicleStop
---@field stopId string
---@field plate string
---@field vehicleModel string|nil
---@field ownerIdentifier string|nil
---@field ownerName string|nil
---@field riskLevel string
---@field riskTags string[]
---@field noteHint string|nil
---@field createdAt string
---@field officer string|nil

local ALLOWED_JOBS = { 'police', 'sheriff', 'csi', 'dispatch', 'admin' }

local function sanitizeIdentifier(value, fallback)
    local text = tostring(value or fallback or '')
    text = text:gsub('[^%w_]', '')
    if text == '' then
        return fallback
    end
    return text
end

local function safeJsonDecode(raw, fallback)
    if type(raw) ~= 'string' or raw == '' then
        return fallback
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok then
        return fallback
    end

    if decoded == nil then
        return fallback
    end

    return decoded
end

local function safeQuery(sql, params, context)
    local ok, rows = pcall(function()
        return MySQL.query.await(sql, params or {})
    end)

    if not ok then
        CAD.Log('warn', 'Vehicle tablet query failed (%s): %s', tostring(context or sql), tostring(rows))
        return {}
    end

    return rows or {}
end

local function safeInsert(sql, params, context)
    local ok, result = pcall(function()
        return MySQL.insert.await(sql, params or {})
    end)

    if not ok then
        CAD.Log('warn', 'Vehicle tablet insert failed (%s): %s', tostring(context or sql), tostring(result))
        return false
    end

    return true
end

local function isAllowedOfficer(source)
    return CAD.Server.HasRole(source, ALLOWED_JOBS)
end

local function normalizeEntityType(value)
    local entityType = tostring(value or ''):upper()
    if entityType == 'PERSON' or entityType == 'VEHICLE' then
        return entityType
    end
    return nil
end

local function boolFromAny(value)
    if value == true or value == 1 or value == '1' then
        return true
    end

    if type(value) == 'string' then
        local lowered = value:lower()
        return lowered == 'true' or lowered == 'yes' or lowered == 'y'
    end

    return false
end

local function decodeVehicleModel(vehicleRaw)
    local decoded = safeJsonDecode(vehicleRaw, nil)
    if type(decoded) ~= 'table' then
        return nil, false
    end

    local model = CAD.Server.SanitizeString(
        decoded.modelName or decoded.model or decoded.vehicle or decoded.name,
        128
    )

    local stolen = boolFromAny(decoded.stolen or decoded.isStolen)
    if type(decoded.flags) == 'table' then
        for i = 1, #decoded.flags do
            if tostring(decoded.flags[i]):upper() == 'STOLEN' then
                stolen = true
                break
            end
        end
    end

    return model ~= '' and model or nil, stolen
end

local function resolveDataSource()
    local cfg = CAD.Config.Forensics and CAD.Config.Forensics.IdReader or {}
    local tabletCfg = type(cfg.VehicleTablet) == 'table' and cfg.VehicleTablet or {}
    local data = type(tabletCfg.DataSource) == 'table' and tabletCfg.DataSource or {}

    return {
        playersTable = sanitizeIdentifier(data.PlayersTable, 'players') or 'players',
        playerVehiclesTable = sanitizeIdentifier(data.PlayerVehiclesTable, 'player_vehicles') or 'player_vehicles',
        playersCitizenColumn = sanitizeIdentifier(data.PlayersCitizenColumn, 'citizenid') or 'citizenid',
        playersCharinfoColumn = sanitizeIdentifier(data.PlayersCharinfoColumn, 'charinfo') or 'charinfo',
        playersMetadataColumn = sanitizeIdentifier(data.PlayersMetadataColumn, 'metadata') or 'metadata',
        vehiclesPlateColumn = sanitizeIdentifier(data.PlayerVehiclesPlateColumn, 'plate') or 'plate',
        vehiclesOwnerColumn = sanitizeIdentifier(data.PlayerVehiclesOwnerColumn, 'citizenid') or 'citizenid',
        vehiclesDataColumn = sanitizeIdentifier(data.PlayerVehiclesDataColumn, 'vehicle') or 'vehicle',
    }
end

local function formatPersonFromRow(row, source)
    local charinfoRaw = row[source.playersCharinfoColumn]
    local metadataRaw = row[source.playersMetadataColumn]
    local charinfo = safeJsonDecode(charinfoRaw, {})
    local metadata = safeJsonDecode(metadataRaw, {})

    local firstName = CAD.Server.SanitizeString(charinfo.firstname or charinfo.firstName, 64)
    local lastName = CAD.Server.SanitizeString(charinfo.lastname or charinfo.lastName, 64)
    local genderRaw = charinfo.gender
    local gender = 'OTHER'
    if genderRaw == 0 or tostring(genderRaw) == '0' or tostring(genderRaw):lower() == 'male' then
        gender = 'MALE'
    elseif genderRaw == 1 or tostring(genderRaw) == '1' or tostring(genderRaw):lower() == 'female' then
        gender = 'FEMALE'
    end

    local bloodType = CAD.Server.SanitizeString(
        metadata.bloodtype or metadata.bloodType or charinfo.bloodtype,
        16
    )

    return {
        citizenid = tostring(row[source.playersCitizenColumn] or ''),
        firstName = firstName ~= '' and firstName or 'UNKNOWN',
        lastName = lastName ~= '' and lastName or 'UNKNOWN',
        dateOfBirth = CAD.Server.SanitizeString(charinfo.birthdate or charinfo.dateOfBirth, 32),
        ssn = CAD.Server.SanitizeString(charinfo.ssn or row[source.playersCitizenColumn] or 'UNKNOWN', 64),
        phone = CAD.Server.SanitizeString(charinfo.phone or charinfo.phone_number, 32),
        address = CAD.Server.SanitizeString(charinfo.address or metadata.address, 128),
        bloodType = bloodType ~= '' and bloodType or nil,
        allergies = CAD.Server.SanitizeString(metadata.allergies, 120),
        gender = gender,
        createdAt = CAD.Server.ToIso(),
        lastUpdated = CAD.Server.ToIso(),
        isDead = boolFromAny(metadata.isdead or metadata.isDead),
    }
end

local function getPersonByCitizenId(citizenId, source)
    if citizenId == '' then
        return nil
    end

    local sql = ('SELECT * FROM %s WHERE %s = ? LIMIT 1')
        :format(source.playersTable, source.playersCitizenColumn)
    local rows = safeQuery(sql, { citizenId }, 'person_by_citizenid')
    local row = rows[1]
    if not row then
        return nil
    end

    return formatPersonFromRow(row, source)
end

local function getVehicleByPlate(plate, source)
    local sql = ('SELECT * FROM %s WHERE %s = ? LIMIT 1')
        :format(source.playerVehiclesTable, source.vehiclesPlateColumn)
    local rows = safeQuery(sql, { plate }, 'vehicle_by_plate')
    local row = rows[1]
    if not row then
        return nil
    end

    local rawModel, decodedStolen = decodeVehicleModel(row[source.vehiclesDataColumn])
    local plateText = CAD.Server.SanitizeString(row[source.vehiclesPlateColumn], 32)
    local ownerId = CAD.Server.SanitizeString(row[source.vehiclesOwnerColumn], 64)
    local isStolen = decodedStolen

    if row.stolen ~= nil then
        isStolen = boolFromAny(row.stolen)
    end

    return {
        plate = plateText,
        model = rawModel or CAD.Server.SanitizeString(row.vehicle_name or row.model, 64) or 'UNKNOWN',
        make = CAD.Server.SanitizeString(row.make or row.brand, 64),
        year = tonumber(row.year) or tonumber(os.date('%Y')),
        color = CAD.Server.SanitizeString(row.color, 32),
        ownerId = ownerId,
        vin = CAD.Server.SanitizeString(row.vin or row[source.vehiclesPlateColumn], 64),
        registrationStatus = 'VALID',
        insuranceStatus = 'VALID',
        stolen = isStolen == true,
        flags = {},
        createdAt = CAD.Server.ToIso(),
    }
end

---@param entityType 'PERSON'|'VEHICLE'
---@param entityId string
---@param limit number
---@return CadEntityNote[]
local function listEntityNotes(entityType, entityId, limit)
    local rows = safeQuery([[
        SELECT note_id, entity_type, entity_id, author_identifier, author_name, content, is_important, created_at
        FROM cad_entity_notes
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    ]], { entityType, entityId, limit }, 'entity_notes_list')

    local notes = {}
    for i = 1, #rows do
        local row = rows[i]
        notes[#notes + 1] = {
            id = row.note_id,
            entityType = row.entity_type,
            entityId = row.entity_id,
            author = row.author_identifier,
            authorName = row.author_name,
            content = row.content,
            important = tonumber(row.is_important) == 1,
            timestamp = row.created_at,
        }
    end

    return notes
end

local function getRiskFromData(vehicle, ownerId, noteRows)
    local hasImportant = false
    local hasWarrant = false
    local hasStolen = vehicle and vehicle.stolen == true or false
    local lastImportant = nil

    for i = 1, #noteRows do
        local note = noteRows[i]
        if note.important == true then
            hasImportant = true
            if not lastImportant then
                lastImportant = note.content
            end

            local lowered = tostring(note.content or ''):lower()
            if lowered:find('warrant', 1, true) then
                hasWarrant = true
            end
            if lowered:find('stolen', 1, true) then
                hasStolen = true
            end
        end
    end

    local riskLevel = 'NONE'
    if hasStolen or hasWarrant then
        riskLevel = 'HIGH'
    elseif hasImportant then
        riskLevel = 'MEDIUM'
    end

    local tags = {}
    if hasStolen then tags[#tags + 1] = 'STOLEN' end
    if hasWarrant then tags[#tags + 1] = 'WARRANT' end
    if hasImportant then tags[#tags + 1] = 'IMPORTANT_NOTE' end
    if ownerId ~= '' then tags[#tags + 1] = ('OWNER:%s'):format(ownerId) end

    return {
        riskLevel = riskLevel,
        riskTags = tags,
        hasStolen = hasStolen,
        hasWarrant = hasWarrant,
        hasImportant = hasImportant,
        noteHint = lastImportant,
    }
end

---@param officer table
---@param payload table
---@return { stopId: string, createdAt: string }|nil
local function insertStopLog(officer, payload)
    local stopId = CAD.Server.GenerateId('STOP')
    local createdAt = CAD.Server.ToIso()
    local riskLevel = CAD.Server.SanitizeString(payload.riskLevel, 16)
    if riskLevel == '' then
        riskLevel = 'NONE'
    end

    local ok = safeInsert([[
        INSERT INTO cad_vehicle_stops (
            stop_id,
            officer_identifier,
            officer_name,
            plate,
            vehicle_model,
            owner_identifier,
            owner_name,
            risk_level,
            risk_tags,
            note_hint,
            stop_source,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        stopId,
        officer.identifier,
        officer.name,
        payload.plate,
        payload.vehicleModel,
        payload.ownerIdentifier,
        payload.ownerName,
        riskLevel,
        json.encode(payload.riskTags or {}),
        payload.noteHint,
        payload.stopSource or 'QUICK_DOCK',
        createdAt,
    }, 'vehicle_stop_insert')

    if not ok then
        return nil
    end

    return {
        stopId = stopId,
        createdAt = createdAt,
    }
end

lib.callback.register('cad:lookup:searchPersons', CAD.Auth.WithGuard('default', function(source, payload)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local query = CAD.Server.SanitizeString(payload and payload.query, 64)
    if query == '' then
        return { ok = true, persons = {} }
    end

    local limit = math.max(1, math.min(30, tonumber(payload and payload.limit) or 10))
    local dataSource = resolveDataSource()
    local wildcard = ('%%%s%%'):format(query)

    local sql = ('SELECT * FROM %s WHERE %s LIKE ? OR %s LIKE ? LIMIT ?')
        :format(dataSource.playersTable, dataSource.playersCitizenColumn, dataSource.playersCharinfoColumn)

    local rows = safeQuery(sql, { wildcard, wildcard, limit }, 'search_persons')
    local persons = {}
    for i = 1, #rows do
        local mapped = formatPersonFromRow(rows[i], dataSource)
        if mapped.citizenid ~= '' then
            persons[#persons + 1] = mapped
        end
    end

    return { ok = true, persons = persons }
end))

lib.callback.register('cad:lookup:searchVehicles', CAD.Auth.WithGuard('default', function(source, payload)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local query = CAD.Server.SanitizeString(payload and payload.query, 64)
    if query == '' then
        return { ok = true, vehicles = {} }
    end

    local limit = math.max(1, math.min(30, tonumber(payload and payload.limit) or 10))
    local dataSource = resolveDataSource()
    local wildcard = ('%%%s%%'):format(query)

    local sql = ('SELECT * FROM %s WHERE %s LIKE ? OR %s LIKE ? OR %s LIKE ? LIMIT ?')
        :format(
            dataSource.playerVehiclesTable,
            dataSource.vehiclesPlateColumn,
            dataSource.vehiclesOwnerColumn,
            dataSource.vehiclesDataColumn
        )

    local rows = safeQuery(sql, { wildcard, wildcard, wildcard, limit }, 'search_vehicles')
    local vehicles = {}
    for i = 1, #rows do
        local mapped = getVehicleByPlate(rows[i][dataSource.vehiclesPlateColumn], dataSource)
        if mapped then
            local owner = getPersonByCitizenId(mapped.ownerId, dataSource)
            mapped.ownerName = owner and (('%s %s'):format(owner.firstName, owner.lastName)) or 'UNKNOWN'
            vehicles[#vehicles + 1] = mapped
        end
    end

    return { ok = true, vehicles = vehicles }
end))

lib.callback.register('cad:entityNotes:list', CAD.Auth.WithGuard('default', function(source, payload)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local entityType = normalizeEntityType(payload and payload.entityType)
    local entityId = CAD.Server.SanitizeString(payload and payload.entityId, 128)
    local limit = math.max(1, math.min(50, tonumber(payload and payload.limit) or 20))

    if not entityType or entityId == '' then
        return { ok = false, error = 'invalid_entity' }
    end

    return {
        ok = true,
        notes = listEntityNotes(entityType, entityId, limit),
    }
end))

lib.callback.register('cad:entityNotes:add', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local entityType = normalizeEntityType(payload and payload.entityType)
    local entityId = CAD.Server.SanitizeString(payload and payload.entityId, 128)
    local content = CAD.Server.SanitizeString(payload and payload.content, 1200)
    local important = payload and payload.important == true

    if not entityType or entityId == '' then
        return { ok = false, error = 'invalid_entity' }
    end

    if content == '' then
        return { ok = false, error = 'content_required' }
    end

    local noteId = CAD.Server.GenerateId('NOTE')
    local createdAt = CAD.Server.ToIso()

    local ok = safeInsert([[
        INSERT INTO cad_entity_notes (
            note_id,
            entity_type,
            entity_id,
            author_identifier,
            author_name,
            content,
            is_important,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        noteId,
        entityType,
        entityId,
        officer.identifier,
        officer.name,
        content,
        important and 1 or 0,
        createdAt,
    }, 'entity_note_insert')

    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    return {
        ok = true,
        note = {
            id = noteId,
            entityType = entityType,
            entityId = entityId,
            author = officer.identifier,
            authorName = officer.name,
            content = content,
            important = important,
            timestamp = createdAt,
        },
    }
end))

lib.callback.register('cad:vehicle:getRecentStops', CAD.Auth.WithGuard('default', function(source, payload)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end

    local limit = math.max(1, math.min(30, tonumber(payload and payload.limit) or 8))
    local plate = CAD.Server.SanitizeString(payload and payload.plate, 32)

    local rows
    if plate ~= '' then
        rows = safeQuery([[
            SELECT *
            FROM cad_vehicle_stops
            WHERE plate = ?
            ORDER BY created_at DESC
            LIMIT ?
        ]], { plate, limit }, 'vehicle_stops_plate')
    else
        rows = safeQuery([[
            SELECT *
            FROM cad_vehicle_stops
            WHERE officer_identifier = ?
            ORDER BY created_at DESC
            LIMIT ?
        ]], { officer.identifier, limit }, 'vehicle_stops_officer')
    end

    local stops = {}
    for i = 1, #rows do
        local row = rows[i]
        stops[#stops + 1] = {
            stopId = row.stop_id,
            plate = row.plate,
            vehicleModel = row.vehicle_model,
            ownerIdentifier = row.owner_identifier,
            ownerName = row.owner_name,
            riskLevel = row.risk_level,
            riskTags = safeJsonDecode(row.risk_tags, {}),
            noteHint = row.note_hint,
            createdAt = row.created_at,
            officer = row.officer_name,
        }
    end

    return { ok = true, stops = stops }
end))

lib.callback.register('cad:vehicle:quickSummary', CAD.Auth.WithGuard('default', function(source, payload)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local plate = CAD.Server.SanitizeString(payload and payload.plate, 32):upper()
    local fallbackModel = CAD.Server.SanitizeString(payload and payload.model, 128)
    if plate == '' then
        return { ok = false, error = 'plate_required' }
    end

    local dataSource = resolveDataSource()
    local vehicle = getVehicleByPlate(plate, dataSource) or {
        plate = plate,
        model = fallbackModel ~= '' and fallbackModel or 'UNKNOWN',
        make = '',
        year = tonumber(os.date('%Y')),
        color = '',
        ownerId = '',
        ownerName = 'UNKNOWN',
        vin = plate,
        registrationStatus = 'VALID',
        insuranceStatus = 'VALID',
        stolen = false,
        flags = {},
        createdAt = CAD.Server.ToIso(),
    }

    if vehicle.ownerId ~= '' then
        local owner = getPersonByCitizenId(vehicle.ownerId, dataSource)
        if owner then
            vehicle.ownerName = ('%s %s'):format(owner.firstName, owner.lastName)
        end
    end

    local vehicleNotes = listEntityNotes('VEHICLE', plate, 20)
    local personNotes = {}
    if vehicle.ownerId ~= '' then
        personNotes = listEntityNotes('PERSON', vehicle.ownerId, 20)
    end

    local allNotes = {}
    for i = 1, #vehicleNotes do
        allNotes[#allNotes + 1] = vehicleNotes[i]
    end
    for i = 1, #personNotes do
        allNotes[#allNotes + 1] = personNotes[i]
    end

    local risk = getRiskFromData(vehicle, vehicle.ownerId, allNotes)

    return {
        ok = true,
        plate = plate,
        model = vehicle.model,
        ownerId = vehicle.ownerId,
        ownerName = vehicle.ownerName,
        riskLevel = risk.riskLevel,
        riskTags = risk.riskTags,
        hasStolen = risk.hasStolen,
        hasWarrant = risk.hasWarrant,
        hasImportant = risk.hasImportant,
        noteHint = risk.noteHint,
        noteCount = #allNotes,
        vehicle = vehicle,
    }
end))

lib.callback.register('cad:vehicle:logStop', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local plate = CAD.Server.SanitizeString(payload and payload.plate, 32):upper()
    if plate == '' then
        return { ok = false, error = 'plate_required' }
    end

    local inserted = insertStopLog(officer, {
        plate = plate,
        vehicleModel = CAD.Server.SanitizeString(payload and payload.model, 128),
        ownerIdentifier = CAD.Server.SanitizeString(payload and payload.ownerId, 64),
        ownerName = CAD.Server.SanitizeString(payload and payload.ownerName, 128),
        riskLevel = CAD.Server.SanitizeString(payload and payload.riskLevel, 16),
        riskTags = type(payload and payload.riskTags) == 'table' and payload.riskTags or {},
        noteHint = CAD.Server.SanitizeString(payload and payload.noteHint, 255),
        stopSource = CAD.Server.SanitizeString(payload and payload.stopSource, 32),
    })

    if not inserted then
        return { ok = false, error = 'db_write_failed' }
    end

    return {
        ok = true,
        stopId = inserted.stopId,
        createdAt = inserted.createdAt,
    }
end))
