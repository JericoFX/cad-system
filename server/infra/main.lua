

CAD = CAD or {}

local function safeJsonDecode(raw, fallback, context)
    if type(raw) ~= 'string' or raw == '' then
        return fallback
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok then
        CAD.Log('warn', 'Invalid JSON in %s: %s', tostring(context or 'unknown'), tostring(decoded))
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
        CAD.Log('error', 'Database bootstrap query failed (%s): %s', tostring(context or sql), tostring(rows))
        return {}
    end

    return rows or {}
end

local function bootstrapFromDatabase()
    local caseRows = safeQuery('SELECT case_id, case_type, title, description, status, priority, created_by, assigned_to, linked_call_id, person_id, person_name, created_at, updated_at FROM cad_cases', {}, 'cad_cases')
    for i = 1, #caseRows do
        local row = caseRows[i]
        CAD.State.Cases[row.case_id] = {
            caseId = row.case_id,
            caseType = row.case_type,
            title = row.title,
            description = row.description or '',
            status = row.status,
            priority = tonumber(row.priority) or 2,
            createdBy = row.created_by,
            assignedTo = row.assigned_to,
            linkedCallId = row.linked_call_id,
            personId = row.person_id,
            personName = row.person_name,
            createdAt = row.created_at,
            updatedAt = row.updated_at,
            notes = {},
            evidence = {},
            tasks = {},
        }
    end

    local noteRows = safeQuery('SELECT note_id, case_id, author, content, timestamp, note_type FROM cad_case_notes', {}, 'cad_case_notes')
    for i = 1, #noteRows do
        local row = noteRows[i]
        local caseObj = CAD.State.Cases[row.case_id]
        if caseObj then
            caseObj.notes[#caseObj.notes + 1] = {
                id = row.note_id,
                caseId = row.case_id,
                author = row.author,
                content = row.content,
                timestamp = row.timestamp,
                type = string.lower(row.note_type or 'general'),
            }
        end
    end

    local evidenceRows = safeQuery('SELECT evidence_id, case_id, evidence_type, payload, attached_by, attached_at, custody_chain FROM cad_evidence', {}, 'cad_evidence')
    for i = 1, #evidenceRows do
        local row = evidenceRows[i]
        local caseObj = CAD.State.Cases[row.case_id]
        if caseObj then
            caseObj.evidence[#caseObj.evidence + 1] = {
                evidenceId = row.evidence_id,
                caseId = row.case_id,
                evidenceType = row.evidence_type,
                data = safeJsonDecode(row.payload, {}, ('cad_evidence.payload:%s'):format(tostring(row.evidence_id))),
                attachedBy = row.attached_by,
                attachedAt = row.attached_at,
                custodyChain = safeJsonDecode(row.custody_chain, {}, ('cad_evidence.custody_chain:%s'):format(tostring(row.evidence_id))),
            }
        end
    end

    local callRows = {}
    if CAD.IsFeatureEnabled == nil or CAD.IsFeatureEnabled('Dispatch') then
        callRows = safeQuery('SELECT * FROM cad_dispatch_calls WHERE status <> ?', { 'CLOSED' }, 'cad_dispatch_calls')
        for i = 1, #callRows do
            local row = callRows[i]
            CAD.State.Dispatch.Calls[row.call_id] = {
                callId = row.call_id,
                type = row.call_type,
                priority = tonumber(row.priority) or 2,
                title = row.title,
                description = row.description or '',
                location = row.location,
                coordinates = safeJsonDecode(row.coordinates, nil, ('cad_dispatch_calls.coordinates:%s'):format(tostring(row.call_id))),
                status = row.status,
                assignedUnits = safeJsonDecode(row.assigned_units, {}, ('cad_dispatch_calls.assigned_units:%s'):format(tostring(row.call_id))),
                createdAt = row.created_at,
            }
        end
    end

    local fineRows = safeQuery('SELECT * FROM cad_fines WHERE status = ?', { 'PENDING' }, 'cad_fines')
    for i = 1, #fineRows do
        local row = fineRows[i]
        CAD.State.Fines[row.fine_id] = {
            fineId = row.fine_id,
            targetType = row.target_type,
            targetId = row.target_id,
            targetName = row.target_name,
            fineCode = row.fine_code,
            description = row.description,
            amount = tonumber(row.amount) or 0,
            jailTime = tonumber(row.jail_time) or 0,
            issuedBy = row.issued_by,
            issuedByName = row.issued_by_name,
            issuedAt = row.issued_at,
            paid = tonumber(row.paid) == 1,
            paidAt = row.paid_at,
            paidMethod = row.paid_method,
            status = row.status,
            isBail = tonumber(row.is_bail) == 1,
        }
    end

    local bloodRows = {}
    if CAD.IsFeatureEnabled == nil or CAD.IsFeatureEnabled('EMS') then
        bloodRows = safeQuery('SELECT * FROM cad_ems_blood_requests', {}, 'cad_ems_blood_requests')
        for i = 1, #bloodRows do
            local row = bloodRows[i]
            CAD.State.EMS.BloodRequests[row.request_id] = {
                requestId = row.request_id,
                caseId = row.case_id,
                citizenId = row.citizen_id,
                personName = row.person_name,
                reason = row.reason,
                location = row.location,
                status = row.status,
                requestedBy = row.requested_by,
                requestedByName = row.requested_by_name,
                requestedByJob = row.requested_by_job,
                requestedAt = row.requested_at,
                handledBy = row.handled_by,
                handledByName = row.handled_by_name,
                handledAt = row.handled_at,
                notes = row.notes or '',
                analysisStartedAt = row.analysis_started_at,
                analysisStartedAtMs = tonumber(row.analysis_started_ms) or nil,
                analysisDurationMs = tonumber(row.analysis_duration_ms) or nil,
                analysisEndsAt = row.analysis_ends_at,
                analysisEndsAtMs = tonumber(row.analysis_ends_ms) or nil,
                analysisCompletedAt = row.analysis_completed_at,
                analysisCompletedAtMs = tonumber(row.analysis_completed_ms) or nil,
                lastReminderAt = row.last_reminder_at,
                lastReminderAtMs = tonumber(row.last_reminder_ms) or nil,
                sampleStashId = row.sample_stash_id,
                sampleSlot = tonumber(row.sample_slot) or nil,
                sampleItemName = row.sample_item_name,
                sampleMetadata = safeJsonDecode(row.sample_metadata, nil, ('cad_ems_blood_requests.sample_metadata:%s'):format(tostring(row.request_id))),
                evidenceId = row.evidence_id,
            }
        end
    end

    local jailRows = safeQuery('SELECT transfer_id, citizen_id, person_name, case_id, jail_months, reason, facility, notes, created_by, created_by_name, created_at FROM cad_jail_transfers ORDER BY created_at DESC LIMIT 500', {}, 'cad_jail_transfers')
    for i = 1, #jailRows do
        local row = jailRows[i]
        CAD.State.Police.JailTransfers[row.transfer_id] = {
            transferId = row.transfer_id,
            citizenId = row.citizen_id,
            personName = row.person_name,
            caseId = row.case_id,
            jailMonths = tonumber(row.jail_months) or 0,
            reason = row.reason or '',
            facility = row.facility or 'Bolingbroke Penitentiary',
            notes = row.notes or '',
            createdBy = row.created_by,
            createdByName = row.created_by_name,
            createdAt = row.created_at,
        }
    end

    CAD.State.SecurityCameras = CAD.State.SecurityCameras or {
        Cameras = {},
        LastNumber = 0,
    }
    CAD.State.SecurityCameras.Cameras = CAD.State.SecurityCameras.Cameras or {}
    CAD.State.SecurityCameras.LastNumber = 0

    local cameraRows = {}
    if CAD.IsFeatureEnabled == nil or CAD.IsFeatureEnabled('SecurityCameras') then
        cameraRows = safeQuery('SELECT * FROM cad_security_cameras', {}, 'cad_security_cameras')
        for i = 1, #cameraRows do
            local row = cameraRows[i]
            local cameraNumber = tonumber(row.camera_number) or 0
            CAD.State.SecurityCameras.Cameras[row.camera_id] = {
                cameraId = row.camera_id,
                cameraNumber = cameraNumber,
                label = row.label or ('Camera %04d'):format(math.max(0, cameraNumber)),
                street = row.street or '',
                crossStreet = row.cross_street or '',
                zone = row.zone_name or '',
                coords = safeJsonDecode(row.coords, nil, ('cad_security_cameras.coords:%s'):format(tostring(row.camera_id))),
                rotation = safeJsonDecode(row.rotation, nil, ('cad_security_cameras.rotation:%s'):format(tostring(row.camera_id))),
                fov = tonumber(row.fov) or 55.0,
                status = row.status or 'ACTIVE',
                installedBy = row.installed_by,
                installedByName = row.installed_by_name,
                createdAt = row.created_at,
                updatedAt = row.updated_at,
            }

            if cameraNumber > CAD.State.SecurityCameras.LastNumber then
                CAD.State.SecurityCameras.LastNumber = cameraNumber
            end
        end
    end

    if CAD.Topology and CAD.Topology.LoadFromDatabase then
        CAD.Topology.LoadFromDatabase()
    end

    local virtualSlots = 0
    if CAD.VirtualContainer and CAD.VirtualContainer.LoadFromDatabase then
        virtualSlots = tonumber(CAD.VirtualContainer.LoadFromDatabase()) or 0
    end

    CAD.Log(
        'success',
        'Bootstrap loaded: %s cases, %s calls, %s fines, %s jail transfers, %s blood requests, %s cameras, %s virtual slots',
        #caseRows,
        #callRows,
        #fineRows,
        #jailRows,
        #bloodRows,
        #cameraRows,
        virtualSlots
    )
end

local function validateConfig()
    local errors = {}

    if type(CAD.Config) ~= 'table' then
        errors[#errors + 1] = 'CAD.Config is not a table'
        return errors
    end

    if type(CAD.Config.Security) ~= 'table' then
        errors[#errors + 1] = 'CAD.Config.Security is not a table'
    else
        if type(CAD.Config.Security.AllowedJobs) ~= 'table' then
            errors[#errors + 1] = 'CAD.Config.Security.AllowedJobs must be a table'
        end
        local rlpm = CAD.Config.Security.RateLimitPerMinute
        if type(rlpm) == 'table' then
            if rlpm.default and not tonumber(rlpm.default) then
                errors[#errors + 1] = 'RateLimitPerMinute.default must be a number'
            end
            if rlpm.heavy and not tonumber(rlpm.heavy) then
                errors[#errors + 1] = 'RateLimitPerMinute.heavy must be a number'
            end
        end
    end

    if type(CAD.Config.Cases) ~= 'table' then
        errors[#errors + 1] = 'CAD.Config.Cases is not a table'
    else
        if type(CAD.Config.Cases.Types) ~= 'table' or #CAD.Config.Cases.Types == 0 then
            errors[#errors + 1] = 'CAD.Config.Cases.Types must be a non-empty table'
        end
        local ps = CAD.Config.Cases.PublicState
        if type(ps) == 'table' then
            if ps.MaxCases and (not tonumber(ps.MaxCases) or tonumber(ps.MaxCases) < 1) then
                errors[#errors + 1] = 'Cases.PublicState.MaxCases must be a positive number'
            end
        end
    end

    if type(CAD.Config.Dispatch) == 'table' then
        local d = CAD.Config.Dispatch
        if d.PositionBroadcastMs and (not tonumber(d.PositionBroadcastMs) or tonumber(d.PositionBroadcastMs) < 1000) then
            errors[#errors + 1] = 'Dispatch.PositionBroadcastMs must be a number >= 1000'
        end
        if d.RefreshIntervalMs and (not tonumber(d.RefreshIntervalMs) or tonumber(d.RefreshIntervalMs) < 1000) then
            errors[#errors + 1] = 'Dispatch.RefreshIntervalMs must be a number >= 1000'
        end
    end

    if type(CAD.Config.Evidence) == 'table' then
        local e = CAD.Config.Evidence
        if e.MaxStagingPerOfficer and (not tonumber(e.MaxStagingPerOfficer) or tonumber(e.MaxStagingPerOfficer) < 1) then
            errors[#errors + 1] = 'Evidence.MaxStagingPerOfficer must be a positive number'
        end
    end

    if type(CAD.Config.UI) ~= 'table' then
        errors[#errors + 1] = 'CAD.Config.UI is not a table'
    end

    return errors
end

CreateThread(function()
    CAD.Log('info', 'Starting CAD backend v1.0.0')
    math.randomseed(GetGameTimer())

    local configErrors = validateConfig()
    if #configErrors > 0 then
        for i = 1, #configErrors do
            CAD.Log('error', 'Config validation: %s', configErrors[i])
        end
        CAD.Log('error', 'CAD startup aborted due to %d config errors. Fix config.lua and restart.', #configErrors)
        return
    end

    CAD.Database.EnsureSchema()
    bootstrapFromDatabase()
end)

lib.callback.register('cad:getConfig', CAD.Auth.WithGuard('default', function()
    return {
        caseTypes = CAD.Config.Cases.Types,
        statuses = { 'OPEN', 'PENDING', 'CLOSED' },
        priorities = { 1, 2, 3, 4, 5 },
    }
end))

local function getCallsignPolicy()
    local policy = CAD.Config.Security and CAD.Config.Security.Callsign or {}
    local prefixes = {}
    local raw = type(policy.RequireWhenPrefix) == 'table' and policy.RequireWhenPrefix or { 'B-' }

    for i = 1, #raw do
        local prefix = CAD.Server.SanitizeString(raw[i], 20)
        if prefix ~= '' then
            prefixes[#prefixes + 1] = string.upper(prefix)
        end
    end

    return {
        requireWhenEmpty = policy.RequireWhenEmpty ~= false,
        blockedPrefixes = prefixes,
    }
end

lib.callback.register('cad:getPlayerData', CAD.Auth.WithGuard('default', function(_, _, officer)

    return {
        identifier = officer.identifier,
        callsign = officer.callsign,
        name = officer.name,
        job = officer.job,
        jobLabel = officer.jobLabel,
        grade = officer.grade,
        isAdmin = officer.isAdmin,
        callsignPolicy = getCallsignPolicy(),
    }
end))

AddEventHandler('playerDropped', function()
    local source = source
    CAD.State.OfficerStatus[source] = nil
    CAD.State.Evidence.Staging[source] = nil
    if CAD.Photos and CAD.Photos.State and CAD.Photos.State.Staging then
        CAD.Photos.State.Staging[source] = nil
    end

    if CAD.State.Dispatch and CAD.State.Dispatch.Units then
        for unitId, unit in pairs(CAD.State.Dispatch.Units) do
            if unit.source == source then
                unit.status = 'OFFLINE'
                unit.currentCall = nil
            end
        end
    end
end)

lib.callback.register('cad:getCallsign', CAD.Auth.WithGuard('default', function(_, _, officer)
    local callsign = CAD.Officers.GetCallsign(officer.identifier)

    return {
        success = true,
        callsign = callsign
    }
end))

lib.callback.register('cad:setCallsign', CAD.Auth.WithGuard('default', function(source, data, officer)
    if not data or type(data.callsign) ~= 'string' then
        return { success = false, error = 'invalid_data' }
    end

    local valid, normalizedOrError = CAD.Officers.ValidateCallsign(data.callsign)
    if not valid then
        return { success = false, error = 'invalid_format', detail = normalizedOrError }
    end

    local callsign = normalizedOrError

    local isDuplicate = CAD.Officers.CheckDuplicate(callsign, officer.identifier)

    local saved = CAD.Officers.SetCallsignDB(officer.identifier, callsign)
    if not saved then
        return { success = false, error = 'db_error' }
    end

    CAD.Officers.SyncToFramework(source, callsign)

    CAD.Log('info', 'Officer %s set callsign to %s', officer.identifier, callsign)

    return {
        success = true,
        callsign = callsign,
        warning = isDuplicate and 'callsign_duplicate' or nil
    }
end))
