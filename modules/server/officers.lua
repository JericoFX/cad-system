local Utils = require 'modules.shared.utils'
local Core = require 'modules.server.core'

local Officers = {}

---@type string
local CALLSIGN_PATTERN = '^%d%d?%d?%-[A-Z][A-Z]+%-%d%d?%d?$'

---@param callsign any
---@return boolean, string
function Officers.ValidateCallsign(callsign)
    if type(callsign) ~= 'string' then return false, 'invalid_type' end
    local normalized = Utils.UpperTrim(callsign)
    if #normalized < 5 or #normalized > 20 then return false, 'invalid_length' end
    if not normalized:match(CALLSIGN_PATTERN) then return false, 'invalid_format' end
    return true, normalized
end

---@param identifier string|nil
---@return string|nil
function Officers.GetCallsign(identifier)
    if not identifier then return nil end
    local result = MySQL.query.await(
        'SELECT callsign FROM cad_officers WHERE identifier = ?',
        { identifier }
    )
    if result and result[1] then return result[1].callsign end
    return nil
end

---@param identifier string|nil
---@param callsign string
---@return boolean
function Officers.SetCallsignDB(identifier, callsign)
    if not identifier then return false end
    local now = os.date('%Y-%m-%dT%H:%M:%S')
    MySQL.query.await(
        'INSERT INTO cad_officers (identifier, callsign, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE callsign = ?, updated_at = ?',
        { identifier, callsign, now, callsign, now }
    )
    return true
end

---@param source integer
---@param callsign string
---@return boolean
function Officers.SyncToFramework(source, callsign)
    return Core.SaveCallsign(source, callsign)
end

---@param callsign string
---@param excludeIdentifier string|nil
---@return boolean
function Officers.CheckDuplicate(callsign, excludeIdentifier)
    local result = MySQL.query.await(
        'SELECT identifier FROM cad_officers WHERE callsign = ? AND identifier != ?',
        { callsign, excludeIdentifier or '' }
    )
    return result and #result > 0
end

exports('GetOfficerCallsign', function(identifier)
    return Officers.GetCallsign(identifier)
end)

exports('SetOfficerCallsign', function(identifier, callsign)
    local valid, normalized = Officers.ValidateCallsign(callsign)
    if not valid then return false end
    return Officers.SetCallsignDB(identifier, normalized)
end)

return Officers
