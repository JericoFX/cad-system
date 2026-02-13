CAD = CAD or {}

local function bootstrapFromDatabase()
    local caseRows = MySQL.query.await('SELECT * FROM cad_cases', {}) or {}
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

    local noteRows = MySQL.query.await('SELECT * FROM cad_case_notes', {}) or {}
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

    local evidenceRows = MySQL.query.await('SELECT * FROM cad_evidence', {}) or {}
    for i = 1, #evidenceRows do
        local row = evidenceRows[i]
        local caseObj = CAD.State.Cases[row.case_id]
        if caseObj then
            caseObj.evidence[#caseObj.evidence + 1] = {
                evidenceId = row.evidence_id,
                caseId = row.case_id,
                evidenceType = row.evidence_type,
                data = row.payload and json.decode(row.payload) or {},
                attachedBy = row.attached_by,
                attachedAt = row.attached_at,
                custodyChain = row.custody_chain and json.decode(row.custody_chain) or {},
            }
        end
    end

    local callRows = MySQL.query.await('SELECT * FROM cad_dispatch_calls WHERE status <> ?', { 'CLOSED' }) or {}
    for i = 1, #callRows do
        local row = callRows[i]
        CAD.State.Dispatch.Calls[row.call_id] = {
            callId = row.call_id,
            type = row.call_type,
            priority = tonumber(row.priority) or 2,
            title = row.title,
            description = row.description or '',
            location = row.location,
            coordinates = row.coordinates and json.decode(row.coordinates) or nil,
            status = row.status,
            assignedUnits = row.assigned_units and json.decode(row.assigned_units) or {},
            createdAt = row.created_at,
        }
    end

    local fineRows = MySQL.query.await('SELECT * FROM cad_fines WHERE status = ?', { 'PENDING' }) or {}
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

    local bloodRows = MySQL.query.await('SELECT * FROM cad_ems_blood_requests', {}) or {}
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
            sampleMetadata = row.sample_metadata and json.decode(row.sample_metadata) or nil,
            evidenceId = row.evidence_id,
        }
    end

    CAD.Log('success', 'Bootstrap loaded: %s cases, %s calls, %s fines, %s blood requests', #caseRows, #callRows, #fineRows, #bloodRows)
end

CreateThread(function()
    CAD.Log('info', 'Starting CAD backend v1.0.0')
    math.randomseed(GetGameTimer())
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

lib.callback.register('cad:getPlayerData', function(source)
    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then
        return nil
    end

    return {
        identifier = officer.identifier,
        callsign = officer.callsign,
        name = officer.name,
        job = officer.job,
        jobLabel = officer.jobLabel,
        grade = officer.grade,
        isAdmin = officer.isAdmin,
    }
end)

AddEventHandler('playerDropped', function()
    local source = source
    CAD.State.OfficerStatus[source] = nil
    CAD.State.Evidence.Staging[source] = nil
end)
