--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Officers = CAD.Officers or {}

local CALLSIGN_PATTERN = '^%d%d?%d?%-[A-Z][A-Z]+%-%d%d?%d?$'

-- Validate callsign format: 1-ADAM-15, 2-K9-7, 3-LINCOLN-22
function CAD.Officers.ValidateCallsign(callsign)
    if type(callsign) ~= 'string' then
        return false, 'invalid_type'
    end

    local normalized = callsign:upper():gsub('^%s+', ''):gsub('%s+$', '')

    if #normalized < 5 or #normalized > 20 then
        return false, 'invalid_length'
    end

    if not normalized:match(CALLSIGN_PATTERN) then
        return false, 'invalid_format'
    end

    return true, normalized
end

-- Get callsign from database
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

-- Save callsign to database
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

-- Sync callsign to framework metadata
function CAD.Officers.SyncToFramework(source, callsign)
    local framework = CAD.Core.Server.GetFramework()

    if framework == 'qb' then
        if CAD.Core.Server.QB and CAD.Core.Server.QB.SaveCallsign then
            return CAD.Core.Server.QB.SaveCallsign(source, callsign)
        end
    elseif framework == 'qbox' then
        if CAD.Core.Server.QBox and CAD.Core.Server.QBox.SaveCallsign then
            return CAD.Core.Server.QBox.SaveCallsign(source, callsign)
        end
    elseif framework == 'esx' then
        if CAD.Core.Server.ESX and CAD.Core.Server.ESX.SaveCallsign then
            return CAD.Core.Server.ESX.SaveCallsign(source, callsign)
        end
    end

    return false
end

-- Check if callsign is already in use
function CAD.Officers.CheckDuplicate(callsign, excludeIdentifier)
    local result = MySQL.query.await(
        'SELECT identifier FROM cad_officers WHERE callsign = ? AND identifier != ?',
        { callsign, excludeIdentifier or '' }
    )

    return result and #result > 0
end

-- Exports
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
