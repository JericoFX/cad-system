

CAD = CAD or {}
CAD.Officers = CAD.Officers or {}

local CALLSIGN_PATTERN = '^%d%d?%d?%-[A-Z][A-Z]+%-%d%d?%d?$'

function CAD.Officers.ValidateCallsign(callsign)
    if type(callsign) ~= 'string' then
        return false, 'invalid_type'
    end

    local normalized = CAD.StringUpperTrim(callsign)

    if #normalized < 5 or #normalized > 20 then
        return false, 'invalid_length'
    end

    if not normalized:match(CALLSIGN_PATTERN) then
        return false, 'invalid_format'
    end

    return true, normalized
end

function CAD.Officers.GetCallsign(identifier)
    if not identifier then
        return nil
    end

    local result = MySQL.query.await(
        'SELECT callsign FROM cad_officers WHERE identifier = ?',
        { identifier }
    )

    if result and result[1] then
        return result[1].callsign
    end

    return nil
end

function CAD.Officers.SetCallsignDB(identifier, callsign)
    if not identifier then
        return false
    end

    local now = os.date('%Y-%m-%dT%H:%M:%S')

    MySQL.query.await(
        'INSERT INTO cad_officers (identifier, callsign, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE callsign = ?, updated_at = ?',
        { identifier, callsign, now, callsign, now }
    )

    return true
end

function CAD.Officers.SyncToFramework(source, callsign)
    if CAD.Core.Server.QB and CAD.Core.Server.QB.SaveCallsign then
        return CAD.Core.Server.QB.SaveCallsign(source, callsign)
    end

    return false
end

function CAD.Officers.CheckDuplicate(callsign, excludeIdentifier)
    local result = MySQL.query.await(
        'SELECT identifier FROM cad_officers WHERE callsign = ? AND identifier != ?',
        { callsign, excludeIdentifier or '' }
    )

    return result and #result > 0
end

exports('GetOfficerCallsign', function(identifier)
    return CAD.Officers.GetCallsign(identifier)
end)

exports('SetOfficerCallsign', function(identifier, callsign)
    local valid, normalized = CAD.Officers.ValidateCallsign(callsign)
    if not valid then
        return false
    end
    return CAD.Officers.SetCallsignDB(identifier, normalized)
end)
