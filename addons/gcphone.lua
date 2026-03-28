local PhoneLookup = {}


local GCPHONE_RESOURCE = 'gcphone-next'
local ALLOWLISTED_RESOURCE = 'cad-system'

---@return boolean
local function isGcPhoneAvailable()
    return GetResourceState(GCPHONE_RESOURCE) == 'started'
end

---@return boolean
local function canCallExport()
    local invokingResource = type(GetInvokingResource) == 'function' and GetInvokingResource() or nil
    return invokingResource == ALLOWLISTED_RESOURCE
end

---@param value any
---@param maxLen integer|nil
---@return string|nil
local function safeString(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local trimmed = value:gsub('^%s+', ''):gsub('%s+$', '')
    if trimmed == '' then return nil end
    if maxLen and #trimmed > maxLen then
        trimmed = trimmed:sub(1, maxLen)
    end
    return trimmed
end

---@param phoneNumber any
---@return table|nil, string|nil
function PhoneLookup.GetPhoneRecordByNumber(phoneNumber)
    if not isGcPhoneAvailable() then
        return nil, 'gcphone_unavailable'
    end

    local safePhoneNumber = safeString(phoneNumber, 20)
    if not safePhoneNumber then
        return nil, 'invalid_phone_number'
    end

    local result = exports[GCPHONE_RESOURCE]:GetPhoneNumber(safePhoneNumber, source)
    if type(result) ~= 'table' or result.success ~= true then
        return nil, type(result) == 'table' and tostring(result.error or 'phone_not_found') or 'phone_not_found'
    end

    return result.phone or {}, nil
end

---@param imei any
---@return table|nil, string|nil
function PhoneLookup.GetPhoneRecordByImei(imei)
    if not isGcPhoneAvailable() then
        return nil, 'gcphone_unavailable'
    end

    local safeImei = safeString(imei, 32)
    if not safeImei then
        return nil, 'invalid_imei'
    end

    local owner = exports[GCPHONE_RESOURCE]:GetPhoneOwnerByIMEI(safeImei)
    if type(owner) ~= 'table' or owner.identifier == nil then
        return nil, 'phone_not_found'
    end

    local phoneData = exports[GCPHONE_RESOURCE]:GetPhoneByIdentifier(owner.identifier, source)
    if type(phoneData) ~= 'table' or phoneData.success ~= true then
        return nil, type(phoneData) == 'table' and tostring(phoneData.error or 'phone_not_found') or 'phone_not_found'
    end

    return phoneData.phone or {}, nil
end

---@param phoneNumber any
---@param imei any
---@param reason any
---@param reporter any
---@return table|nil, string|nil
function PhoneLookup.MarkPhoneAsStolen(phoneNumber, imei, reason, reporter)
    if not isGcPhoneAvailable() then
        return nil, 'gcphone_unavailable'
    end

    if not canCallExport() then
        return nil, 'unauthorized_caller'
    end

    local safeReason = safeString(reason, 255) or 'CAD investigation flag'
    local safeReporter = safeString(reporter, 80)

    if imei and #imei > 0 then
        local result = exports[GCPHONE_RESOURCE]:MarkPhoneAsStolenByIMEI(imei, safeReason, safeReporter)
        if type(result) ~= 'table' or result.success ~= true then
            return nil,
                type(result) == 'table' and tostring(result.error or 'gcphone_action_failed') or 'gcphone_action_failed'
        end
        return result.phone or {}, nil
    end

    local safePhoneNumber = safeString(phoneNumber, 20)
    if not safePhoneNumber then
        return nil, 'invalid_phone_number'
    end

    local result = exports[GCPHONE_RESOURCE]:MarkPhoneAsStolenByNumber(safePhoneNumber, safeReason, safeReporter)
    if type(result) ~= 'table' or result.success ~= true then
        return nil,
            type(result) == 'table' and tostring(result.error or 'gcphone_action_failed') or 'gcphone_action_failed'
    end
    return result.phone or {}, nil
end

---@param phoneNumber any
---@param imei any
---@return table|nil, string|nil
function PhoneLookup.ClearPhoneStolen(phoneNumber, imei)
    if not isGcPhoneAvailable() then
        return nil, 'gcphone_unavailable'
    end

    if not canCallExport() then
        return nil, 'unauthorized_caller'
    end

    if imei and #imei > 0 then
        local result = exports[GCPHONE_RESOURCE]:ClearPhoneStolenByIMEI(imei)
        if type(result) ~= 'table' or result.success ~= true then
            return nil,
                type(result) == 'table' and tostring(result.error or 'gcphone_action_failed') or 'gcphone_action_failed'
        end
        return result.phone or {}, nil
    end

    local safePhoneNumber = safeString(phoneNumber, 20)
    if not safePhoneNumber then
        return nil, 'invalid_phone_number'
    end

    local result = exports[GCPHONE_RESOURCE]:ClearPhoneStolenByNumber(safePhoneNumber)
    if type(result) ~= 'table' or result.success ~= true then
        return nil,
            type(result) == 'table' and tostring(result.error or 'gcphone_action_failed') or 'gcphone_action_failed'
    end
    return result.phone or {}, nil
end

---@param identifier any
---@return table|nil, string|nil
function PhoneLookup.GetPhoneOwnerInfo(identifier)
    if not isGcPhoneAvailable() then
        return nil, 'gcphone_unavailable'
    end

    local safeIdentifier = safeString(identifier, 80)
    if not safeIdentifier then
        return nil, 'invalid_identifier'
    end

    local result = exports[GCPHONE_RESOURCE]:GetPhoneByIdentifier(safeIdentifier, source)
    if type(result) ~= 'table' or result.success ~= true then
        return nil, type(result) == 'table' and tostring(result.error or 'phone_not_found') or 'phone_not_found'
    end

    return {
        identifier = result.phone.identifier,
        phoneNumber = result.phone.phoneNumber,
        imei = result.phone.imei,
        isStolen = result.phone.isStolen == true,
        stolenAt = result.phone.stolenAt,
        stolenReason = result.phone.stolenReason,
        stolenReporter = result.phone.stolenReporter,
    }
end
