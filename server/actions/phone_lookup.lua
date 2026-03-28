local Utils = require 'modules.shared.utils'
local Auth = require 'modules.server.auth'
local Fn = require 'modules.server.functions'


local PHONE_LOOKUP_JOBS = { 'police', 'sheriff', 'csi', 'dispatch', 'admin' }
local GCPHONE_RESOURCE = 'gcphone-next'

---@param sql string
---@param params table|nil
---@param context string|nil
---@return table
local function safeQuery(sql, params, context)
    local ok, rows = pcall(function()
        return MySQL.query.await(sql, params or {})
    end)

    if not ok then
        Utils.Log('warn', 'Phone lookup query failed (%s): %s', tostring(context or sql), tostring(rows))
        return {}
    end

    return rows or {}
end

---@param sql string
---@param params table|nil
---@param context string|nil
---@return table|nil
local function safeSingle(sql, params, context)
    local rows = safeQuery(sql, params, context)
    return rows[1]
end

---@param raw any
---@return table|nil
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

---@param value any
---@param maxLen integer
---@return string|nil
local function sanitizeLookupValue(value, maxLen)
    local sanitized = Fn.SanitizeString(value, maxLen)
    if sanitized == '' then
        return nil
    end

    return sanitized
end

---@param row any
---@return table|nil
local function normalizePhoneLookupRecord(row)
    if type(row) ~= 'table' then
        return nil
    end

    return {
        identifier = Fn.SanitizeString(row.identifier, 80),
        phoneNumber = Fn.SanitizeString(row.phone_number, 20),
        imei = Fn.SanitizeString(row.imei, 32),
        isStolen = tonumber(row.is_stolen) == 1,
        stolenAt = row.stolen_at,
        stolenReason = Fn.SanitizeString(row.stolen_reason, 255),
        stolenReporter = Fn.SanitizeString(row.stolen_reporter, 80),
    }
end

---@param phoneNumber any
---@return table|nil, string|nil
local function getPhoneRecordByNumber(phoneNumber)
    local safePhoneNumber = sanitizeLookupValue(phoneNumber, 20)
    if not safePhoneNumber then
        return nil, 'invalid_phone_number'
    end

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

---@param imei any
---@return table|nil, string|nil
local function getPhoneRecordByImei(imei)
    local safeImei = sanitizeLookupValue(imei, 32)
    if not safeImei then
        return nil, 'invalid_imei'
    end

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

---@param identifier any
---@return table|nil
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
    local firstName = Fn.SanitizeString(charinfo.firstname or charinfo.firstName, 64)
    local lastName = Fn.SanitizeString(charinfo.lastname or charinfo.lastName, 64)
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
        dateOfBirth = Fn.SanitizeString(charinfo.birthdate or charinfo.dateOfBirth, 32),
        ssn = Fn.SanitizeString(charinfo.ssn or safeIdentifier, 64),
        phone = Fn.SanitizeString(charinfo.phone or charinfo.phone_number, 32),
        address = Fn.SanitizeString(charinfo.address or metadata.address, 128),
        bloodType = Fn.SanitizeString(metadata.bloodtype or metadata.bloodType or charinfo.bloodtype, 16),
        allergies = Fn.SanitizeString(metadata.allergies, 120),
        gender = gender,
        createdAt = Utils.ToIso(),
        lastUpdated = Utils.ToIso(),
        isDead = metadata.isdead == true or metadata.isDead == true or metadata.isdead == 1 or metadata.isDead == 1,
    }
end

---@param phone table|nil
---@return table|nil
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

---@param source number
---@return boolean
local function isAllowedOfficer(source)
    return Fn.HasRole(source, PHONE_LOOKUP_JOBS)
end

---@return boolean
local function isGcPhoneAvailable()
    return GetResourceState(GCPHONE_RESOURCE) == 'started'
end

---@param action string
---@param phoneNumber string
---@param imei string
---@param officerName string
---@return any, string|nil
local function executeStolenAction(action, phoneNumber, imei, officerName)
    if not isGcPhoneAvailable() then
        return nil, 'gcphone_unavailable'
    end

    local safeAction = Fn.SanitizeString(action, 16):upper()
    local safePhoneNumber = Fn.SanitizeString(phoneNumber, 20)
    local safeImei = Fn.SanitizeString(imei, 32)
    local reporter = Fn.SanitizeString(officerName, 80)
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

lib.callback.register('cad:phone:lookupByNumber', Auth.WithGuard('default', function(source, payload)
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

lib.callback.register('cad:phone:lookupByImei', Auth.WithGuard('default', function(source, payload)
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

lib.callback.register('cad:phone:setStolenPlaceholder', Auth.WithGuard('heavy', function(source, payload, officer)
    if not isAllowedOfficer(source) then
        return { ok = false, error = 'forbidden' }
    end

    local action = Fn.SanitizeString(payload and payload.action, 16):upper()
    local phoneNumber = Fn.SanitizeString(payload and payload.phoneNumber, 20)
    local imei = Fn.SanitizeString(payload and payload.imei, 32)

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
