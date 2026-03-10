CAD = CAD or {}
CAD.PhoneLookup = CAD.PhoneLookup or {}

local PHONE_LOOKUP_JOBS = { 'police', 'sheriff', 'csi', 'dispatch', 'admin' }
local GCPHONE_RESOURCE = 'gcphone-next'

local function safeQuery(sql, params, context)
    local ok, rows = pcall(function()
        return MySQL.query.await(sql, params or {})
    end)

    if not ok then
        CAD.Log('warn', 'Phone lookup query failed (%s): %s', tostring(context or sql), tostring(rows))
        return {}
    end

    return rows or {}
end

local function safeSingle(sql, params, context)
    local rows = safeQuery(sql, params, context)
    return rows[1]
end

local function decodeJson(raw)
    if type(raw) ~= 'string' or raw == '' then
        return nil
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok or type(decoded) ~= 'table' then
        return nil
    end

    return decoded
end

local function sanitizeLookupValue(value, maxLen)
    local sanitized = CAD.Server.SanitizeString(value, maxLen)
    if sanitized == '' then
        return nil
    end

    return sanitized
end

local function normalizePhoneLookupRecord(row)
    if type(row) ~= 'table' then
        return nil
    end

    return {
        identifier = CAD.Server.SanitizeString(row.identifier, 80),
        phoneNumber = CAD.Server.SanitizeString(row.phone_number, 20),
        imei = CAD.Server.SanitizeString(row.imei, 32),
        isStolen = tonumber(row.is_stolen) == 1,
        stolenAt = row.stolen_at,
        stolenReason = CAD.Server.SanitizeString(row.stolen_reason, 255),
        stolenReporter = CAD.Server.SanitizeString(row.stolen_reporter, 80),
    }
end

local function getPhoneRecordByNumber(phoneNumber)
    local safePhoneNumber = sanitizeLookupValue(phoneNumber, 20)
    if not safePhoneNumber then
        return nil, 'invalid_phone_number'
    end

    -- Verified: gcphone-next sql/schema.sql defines phone_numbers(identifier, phone_number, imei).
    local row = safeSingle([[
        SELECT identifier, phone_number, imei, is_stolen, stolen_at, stolen_reason, stolen_reporter
        FROM phone_numbers
        WHERE phone_number = ?
        LIMIT 1
    ]], { safePhoneNumber }, 'phone_lookup_by_number')

    if not row then
        return nil, 'phone_not_found'
    end

    return normalizePhoneLookupRecord(row), nil
end

local function getPhoneRecordByImei(imei)
    local safeImei = sanitizeLookupValue(imei, 32)
    if not safeImei then
        return nil, 'invalid_imei'
    end

    -- Verified: gcphone-next server/modules/database.lua migration 16 adds is_stolen, stolen_at, stolen_reason, stolen_reporter.
    local row = safeSingle([[
        SELECT identifier, phone_number, imei, is_stolen, stolen_at, stolen_reason, stolen_reporter
        FROM phone_numbers
        WHERE imei = ?
        LIMIT 1
    ]], { safeImei }, 'phone_lookup_by_imei')

    if not row then
        return nil, 'phone_not_found'
    end

    return normalizePhoneLookupRecord(row), nil
end

local function buildPersonFromIdentifier(identifier)
    local safeIdentifier = sanitizeLookupValue(identifier, 80)
    if not safeIdentifier then
        return nil
    end

    local row = safeSingle('SELECT citizenid, charinfo, metadata FROM players WHERE citizenid = ? LIMIT 1', {
        safeIdentifier,
    }, 'phone_lookup_person_by_identifier')

    if not row then
        return nil
    end

    local charinfo = decodeJson(row.charinfo) or {}
    local metadata = decodeJson(row.metadata) or {}
    local firstName = CAD.Server.SanitizeString(charinfo.firstname or charinfo.firstName, 64)
    local lastName = CAD.Server.SanitizeString(charinfo.lastname or charinfo.lastName, 64)
    local genderRaw = charinfo.gender
    local gender = 'OTHER'

    if genderRaw == 0 or tostring(genderRaw) == '0' or tostring(genderRaw):lower() == 'male' then
        gender = 'MALE'
    elseif genderRaw == 1 or tostring(genderRaw) == '1' or tostring(genderRaw):lower() == 'female' then
        gender = 'FEMALE'
    end

    return {
        citizenid = safeIdentifier,
        firstName = firstName ~= '' and firstName or 'UNKNOWN',
        lastName = lastName ~= '' and lastName or 'UNKNOWN',
        dateOfBirth = CAD.Server.SanitizeString(charinfo.birthdate or charinfo.dateOfBirth, 32),
        ssn = CAD.Server.SanitizeString(charinfo.ssn or safeIdentifier, 64),
        phone = CAD.Server.SanitizeString(charinfo.phone or charinfo.phone_number, 32),
        address = CAD.Server.SanitizeString(charinfo.address or metadata.address, 128),
        bloodType = CAD.Server.SanitizeString(metadata.bloodtype or metadata.bloodType or charinfo.bloodtype, 16),
        allergies = CAD.Server.SanitizeString(metadata.allergies, 120),
        gender = gender,
        createdAt = CAD.Server.ToIso(),
        lastUpdated = CAD.Server.ToIso(),
        isDead = metadata.isdead == true or metadata.isDead == true or metadata.isdead == 1 or metadata.isDead == 1,
    }
end

local function buildPhoneLookupResponse(phone)
    if not phone then
        return nil
    end

    local person = buildPersonFromIdentifier(phone.identifier)
    local ownerName = nil
    local ownerCitizenId = phone.identifier

    if person then
        person.phone = phone.phoneNumber ~= '' and phone.phoneNumber or person.phone
        ownerName = ('%s %s'):format(person.firstName, person.lastName)
        ownerCitizenId = person.citizenid
    end

    return {
        identifier = phone.identifier,
        phoneNumber = phone.phoneNumber,
        imei = phone.imei,
        isStolen = phone.isStolen == true,
        stolenAt = phone.stolenAt,
        stolenReason = phone.stolenReason ~= '' and phone.stolenReason or nil,
        stolenReporter = phone.stolenReporter ~= '' and phone.stolenReporter or nil,
        ownerCitizenId = ownerCitizenId,
        ownerName = ownerName,
        person = person,
        placeholderActions = false,
    }
end

local function isAllowedOfficer(source)
    return CAD.Server.HasRole(source, PHONE_LOOKUP_JOBS)
end

local function isGcPhoneAvailable()
    return GetResourceState(GCPHONE_RESOURCE) == 'started'
end

local function executeStolenAction(action, phoneNumber, imei, officerName)
    if not isGcPhoneAvailable() then
        return nil, 'gcphone_unavailable'
    end

    local safeAction = CAD.Server.SanitizeString(action, 16):upper()
    local safePhoneNumber = CAD.Server.SanitizeString(phoneNumber, 20)
    local safeImei = CAD.Server.SanitizeString(imei, 32)
    local reporter = CAD.Server.SanitizeString(officerName, 80)
    local reason = 'CAD investigation flag'

    local ok, result = pcall(function()
        if safeAction == 'MARK' then
            if safeImei ~= '' then
                return exports[GCPHONE_RESOURCE]:MarkPhoneAsStolenByIMEI(safeImei, reason, reporter)
            end

            return exports[GCPHONE_RESOURCE]:MarkPhoneAsStolenByNumber(safePhoneNumber, reason, reporter)
        end

        if safeImei ~= '' then
            return exports[GCPHONE_RESOURCE]:ClearPhoneStolenByIMEI(safeImei)
        end

        return exports[GCPHONE_RESOURCE]:ClearPhoneStolenByNumber(safePhoneNumber)
    end)

    if not ok then
        return nil, 'gcphone_export_failed'
    end

    if type(result) ~= 'table' or result.success ~= true then
        return nil, type(result) == 'table' and tostring(result.error or 'gcphone_action_failed') or 'gcphone_action_failed'
    end

    return result.phone or {}, nil
end

lib.callback.register('cad:phone:lookupByNumber', CAD.Auth.WithGuard('default', function(source, payload)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local phone, err = getPhoneRecordByNumber(payload and payload.phoneNumber)
    if err then
        return { ok = false, error = err }
    end

    return {
        ok = true,
        result = buildPhoneLookupResponse(phone),
    }
end))

lib.callback.register('cad:phone:lookupByImei', CAD.Auth.WithGuard('default', function(source, payload)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local phone, err = getPhoneRecordByImei(payload and payload.imei)
    if err then
        return { ok = false, error = err }
    end

    return {
        ok = true,
        result = buildPhoneLookupResponse(phone),
    }
end))

lib.callback.register('cad:phone:setStolenPlaceholder', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local action = CAD.Server.SanitizeString(payload and payload.action, 16):upper()
    local phoneNumber = CAD.Server.SanitizeString(payload and payload.phoneNumber, 20)
    local imei = CAD.Server.SanitizeString(payload and payload.imei, 32)

    if action ~= 'MARK' and action ~= 'CLEAR' then
        return { ok = false, error = 'invalid_action' }
    end

    if phoneNumber == '' and imei == '' then
        return { ok = false, error = 'phone_reference_required' }
    end

    local updatedPhone, err = executeStolenAction(action, phoneNumber, imei, officer and officer.name or nil)
    if err then
        return { ok = false, error = err }
    end

    local normalized = normalizePhoneLookupRecord({
        identifier = updatedPhone.identifier,
        phone_number = updatedPhone.phoneNumber,
        imei = updatedPhone.imei,
        is_stolen = updatedPhone.isStolen and 1 or 0,
        stolen_at = updatedPhone.stolenAt,
        stolen_reason = updatedPhone.stolenReason,
        stolen_reporter = updatedPhone.stolenReporter,
    })

    return {
        ok = true,
        placeholder = false,
        action = action,
        result = buildPhoneLookupResponse(normalized),
    }
end))
