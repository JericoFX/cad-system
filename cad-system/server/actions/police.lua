

CAD.Police = CAD.Police or {}

local jailTransfers = CAD.State.Police and CAD.State.Police.JailTransfers or {}

local function toArraySorted(transfers, caseId)
    local out = {}
    for _, row in pairs(transfers) do
        if not caseId or row.caseId == caseId then
            out[#out + 1] = row
        end
    end

    table.sort(out, function(a, b)
        return (a.createdAt or '') > (b.createdAt or '')
    end)

    return out
end

local function addCaseNote(caseObj, officer, transfer)
    if not caseObj then
        return true
    end

    local noteId = CAD.Server.GenerateId('NOTE')
    local content = ('Jail transfer logged\nCitizen: %s (%s)\nTime: %s months\nReason: %s\nFacility: %s\nOfficer: %s'):format(
        transfer.personName,
        transfer.citizenId,
        transfer.jailMonths,
        transfer.reason,
        transfer.facility,
        officer.name or officer.identifier
    )

    caseObj.notes = caseObj.notes or {}
    caseObj.notes[#caseObj.notes + 1] = {
        id = noteId,
        caseId = caseObj.caseId,
        author = officer.identifier,
        content = content,
        timestamp = transfer.createdAt,
        type = 'general',
    }

    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_case_notes (note_id, case_id, author, content, timestamp, note_type)
            VALUES (?, ?, ?, ?, ?, ?)
        ]], {
            noteId,
            caseObj.caseId,
            officer.identifier,
            content,
            transfer.createdAt,
            'GENERAL',
        })
    end)

    if not ok then
        table.remove(caseObj.notes, #caseObj.notes)
        CAD.Log('error', 'Failed saving jail note %s: %s', tostring(noteId), tostring(err))
        return false, 'db_write_failed'
    end

    return true
end

local function createJailTransfer(officer, payload)
    local citizenId = CAD.Server.SanitizeString(payload.citizenId, 64)
    local personName = CAD.Server.SanitizeString(payload.personName, 128)
    local caseId = CAD.Server.SanitizeString(payload.caseId, 64)
    local reason = CAD.Server.SanitizeString(payload.reason, 500)
    local facility = CAD.Server.SanitizeString(payload.facility, 128)
    local notes = CAD.Server.SanitizeString(payload.notes, 1200)
    local jailMonths = math.max(0, math.floor(tonumber(payload.jailMonths) or 0))

    if citizenId == '' or personName == '' then
        return nil, 'missing_person_data'
    end

    if jailMonths <= 0 then
        return nil, 'invalid_jail_time'
    end

    local transferId = CAD.Server.GenerateId('JAIL')
    local transfer = {
        transferId = transferId,
        citizenId = citizenId,
        personName = personName,
        caseId = caseId ~= '' and caseId or nil,
        jailMonths = jailMonths,
        reason = reason ~= '' and reason or 'No reason provided',
        facility = facility ~= '' and facility or 'Bolingbroke Penitentiary',
        notes = notes,
        createdBy = officer.identifier,
        createdByName = officer.name,
        createdAt = CAD.Server.ToIso(),
    }

    if transfer.caseId and CAD.State.Cases[transfer.caseId] then
        local noted, noteErr = addCaseNote(CAD.State.Cases[transfer.caseId], officer, transfer)
        if not noted then
            return nil, noteErr or 'cannot_add_case_note'
        end
    end

    jailTransfers[transferId] = transfer

    TriggerEvent('cad:hook:jailTransferLogged', transfer, officer)
    TriggerEvent('cad:server:jailTransferLogged', transfer, officer)

    return transfer
end

lib.callback.register('cad:police:getJailTransfers', CAD.Auth.WithGuard('default', function(_, payload)
    local caseId = payload and CAD.Server.SanitizeString(payload.caseId, 64) or nil
    if caseId == '' then
        caseId = nil
    end

    return {
        ok = true,
        transfers = toArraySorted(jailTransfers, caseId),
    }
end))

lib.callback.register('cad:police:logJailTransfer', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not CAD.Server.HasRole(source, { 'police', 'sheriff', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end

    local transfer, err = createJailTransfer(officer, payload or {})
    if not transfer then
        return { ok = false, error = err or 'cannot_create_jail_transfer' }
    end

    CAD.Server.NotifyJobs(
        { 'police', 'sheriff', 'dispatch' },
        ('Jail transfer logged: %s (%s) %s months'):format(transfer.personName, transfer.citizenId, transfer.jailMonths),
        'inform'
    )

    CAD.Server.BroadcastToJobs(
        {'police', 'sheriff', 'dispatch'},
        'policeJailTransferLogged',
        { transfer = transfer }
    )

    return {
        ok = true,
        transfer = transfer,
    }
end))

exports('LogJailTransfer', function(source, data)
    local officer = CAD.Auth.GetOfficerData(source)
    if not officer then
        return nil, 'officer_not_found'
    end

    return createJailTransfer(officer, data or {})
end)

exports('GetJailTransfers', function(caseId)
    if type(caseId) == 'string' and caseId ~= '' then
        return toArraySorted(jailTransfers, caseId)
    end
    return toArraySorted(jailTransfers)
end)
