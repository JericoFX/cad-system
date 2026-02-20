

CAD = CAD or {}
CAD.Fines = CAD.Fines or {}

local fines = CAD.State.Fines

local function getFineCatalog()
    if CAD.GetFineCatalog then
        return CAD.GetFineCatalog()
    end

    if CAD.Config.Fines and type(CAD.Config.Fines.DefaultCatalog) == 'table' then
        return CAD.Config.Fines.DefaultCatalog
    end

    return {}
end

local function findFineDefinition(code)
    local needle = tostring(code or ''):upper()
    if needle == '' then
        return nil
    end

    local catalog = getFineCatalog()
    for i = 1, #catalog do
        local row = catalog[i]
        if tostring(row.code or ''):upper() == needle then
            return row
        end
    end

    return nil
end

local function saveFineDb(fine)
    MySQL.insert.await([[
        INSERT INTO cad_fines (
            fine_id, target_type, target_id, target_name, fine_code, description,
            amount, jail_time, issued_by, issued_by_name, issued_at,
            paid, paid_at, paid_method, status, is_bail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            paid = VALUES(paid),
            paid_at = VALUES(paid_at),
            paid_method = VALUES(paid_method),
            status = VALUES(status)
    ]], {
        fine.fineId,
        fine.targetType,
        fine.targetId,
        fine.targetName,
        fine.fineCode,
        fine.description,
        fine.amount,
        fine.jailTime,
        fine.issuedBy,
        fine.issuedByName,
        fine.issuedAt,
        fine.paid and 1 or 0,
        fine.paidAt,
        fine.paidMethod,
        fine.status,
        fine.isBail and 1 or 0,
    })
end

local function getSourceByIdentifier(identifier)
    local players = GetPlayers()
    for i = 1, #players do
        local source = tonumber(players[i])
        if CAD.Server.GetIdentifier(source) == identifier then
            return source
        end
    end
    return nil
end

local function issueFine(payload, officer)
    local fineCode = CAD.Server.SanitizeString(payload.fineCode, 32)
    local def = findFineDefinition(fineCode)

    if not def and (not CAD.Config.Fines or CAD.Config.Fines.AllowCustomCode ~= true) then
        return { ok = false, error = 'invalid_fine_code' }
    end

    local fine = {
        fineId = CAD.Server.GenerateId('FINE'),
        targetType = tostring(payload.targetType or 'PERSON'):upper(),
        targetId = CAD.Server.SanitizeString(payload.targetId, 128),
        targetName = CAD.Server.SanitizeString(payload.targetName, 128),
        fineCode = def and tostring(def.code) or fineCode,
        description = def and CAD.Server.SanitizeString(def.description, 255) or CAD.Server.SanitizeString(payload.description, 255),
        amount = def and math.max(0, tonumber(def.amount) or 0) or math.max(0, tonumber(payload.amount) or 0),
        jailTime = def and math.max(0, tonumber(def.jailTime) or 0) or math.max(0, tonumber(payload.jailTime) or 0),
        issuedBy = officer.identifier,
        issuedByName = officer.name,
        issuedAt = CAD.Server.ToIso(),
        paid = false,
        paidAt = nil,
        paidMethod = nil,
        status = 'PENDING',
        isBail = payload.isBail == true,
    }

    if fine.targetId == '' or fine.description == '' then
        return { ok = false, error = 'invalid_fine' }
    end

    fines[fine.fineId] = fine
    saveFineDb(fine)

    local targetSource = getSourceByIdentifier(fine.targetId)
    if targetSource then
        CAD.Server.Notify(targetSource, ('New fine: $%s (%s)'):format(fine.amount, fine.fineCode), 'warning')
    end

    CAD.Server.BroadcastToJobs(
        {'police', 'sheriff'},
        'fineCreated',
        { fine = fine }
    )

    if GetResourceState('ox_inventory') == 'started' then
        local ticketMetadata = {
            fineId = fine.fineId,
            targetId = fine.targetId,
            amount = fine.amount,
            fineCode = fine.fineCode,
            description = fine.description,
            issuedBy = fine.issuedByName,
            issuedAt = fine.issuedAt,
        }

        local recipient = targetSource or officer.source
        pcall(function()
            exports.ox_inventory:AddItem(recipient, CAD.Config.Evidence.TicketItemName, 1, ticketMetadata)
        end)
    end

    return fine
end

local function canPlayerPayFine(source, fine)
    local payerIdentifier = CAD.Server.GetIdentifier(source)
    if payerIdentifier and payerIdentifier == fine.targetId then
        return true
    end

    local officer = CAD.Auth.GetOfficerData(source)
    if officer and officer.isAdmin then
        return true
    end

    if officer and (officer.job == 'police' or officer.job == 'sheriff' or officer.job == 'dispatch') then
        return true
    end

    return false
end

local function payFine(source, fineId, method)
    local fine = fines[fineId]
    if not fine then
        return { ok = false, error = 'fine_not_found' }
    end

    if fine.paid then
        return fine
    end

    if not canPlayerPayFine(source, fine) then
        return { ok = false, error = 'forbidden' }
    end

    fine.paid = true
    fine.paidAt = CAD.Server.ToIso()
    fine.paidMethod = tostring(method or 'BANK')
    fine.status = 'PAID'
    saveFineDb(fine)

    CAD.Server.BroadcastToJobs(
        {'police', 'sheriff'},
        'finePaid',
        {
            fineId = fineId,
            paidAt = fine.paidAt,
            paidMethod = fine.paidMethod,
            paidBy = source
        }
    )

    return fine
end

lib.callback.register('cad:getFineCatalog', CAD.Auth.WithGuard('default', function()
    return getFineCatalog()
end))

lib.callback.register('cad:createFine', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not CAD.Server.HasRole(source, { 'police', 'sheriff', 'admin' }) then
        return { ok = false, error = 'forbidden' }
    end
    return issueFine(payload, officer)
end))

lib.callback.register('cad:getFines', CAD.Auth.WithGuard('default', function(source, payload)
    local targetId = payload.targetId and tostring(payload.targetId) or nil
    local status = payload.status and string.upper(tostring(payload.status)) or nil
    local includeMine = payload.mine == true
    local out = {}
    local myIdentifier = includeMine and CAD.Server.GetIdentifier(source) or nil

    for _, fine in pairs(fines) do
        local ok = true
        if targetId then ok = fine.targetId == targetId end
        if ok and myIdentifier then ok = fine.targetId == myIdentifier end
        if ok and status then ok = fine.status == status end
        if ok then out[#out + 1] = fine end
    end

    table.sort(out, function(a, b)
        return (a.issuedAt or '') > (b.issuedAt or '')
    end)

    return out
end))

lib.callback.register('cad:payFine', CAD.Auth.WithGuard('payments', function(source, payload)
    if type(payload) ~= 'table' then
        return { ok = false, error = 'invalid_payload' }
    end
    if type(payload.fineId) ~= 'string' or #payload.fineId > 128 then
        return { ok = false, error = 'invalid_fine_id' }
    end
    return payFine(source, payload.fineId, payload.method)
end))

lib.callback.register('cad:payFineByTicket', CAD.Auth.WithGuard('payments', function(source, payload)
    if type(payload) ~= 'table' then
        return { ok = false, error = 'invalid_payload' }
    end
    if type(payload.fineId) ~= 'string' or #payload.fineId > 128 then
        return { ok = false, error = 'invalid_fine_id' }
    end
    if payload.slot ~= nil and (type(payload.slot) ~= 'number' or payload.slot < 1 or payload.slot > 50) then
        return { ok = false, error = 'invalid_slot' }
    end

    local result = payFine(source, payload.fineId, 'TICKET')
    if result and result.ok == false then
        return result
    end

    if GetResourceState('ox_inventory') == 'started' then
        pcall(function()
            exports.ox_inventory:RemoveItem(source, CAD.Config.Evidence.TicketItemName, 1, nil, payload.slot, true, false)
        end)
    end

    return result
end))
