CAD = CAD or {}
CAD.Topology = CAD.Topology or {}
CAD.State = CAD.State or {}
CAD.State.Topology = CAD.State.Topology or {
    revision = 0,
    terminals = {},
    readers = {},
    readersByTerminal = {},
    lockers = {},
    lockersByTerminal = {},
    labs = {},
    runtime = {},
}

local topologyState = CAD.State.Topology

local function dbQuery(sql, params, context)
    local ok, rows = pcall(function()
        return MySQL.query.await(sql, params or {})
    end)

    if not ok then
        CAD.Log('error', 'Topology query failed (%s): %s', tostring(context or sql), tostring(rows))
        return {}
    end

    return rows or {}
end

local function dbExec(sql, params, context)
    local ok, result = pcall(function()
        return MySQL.query.await(sql, params or {})
    end)

    if not ok then
        CAD.Log('error', 'Topology exec failed (%s): %s', tostring(context or sql), tostring(result))
        return false
    end

    return true
end

local function decodeJson(raw, fallback)
    if type(raw) ~= 'string' or raw == '' then
        return fallback
    end

    local ok, value = pcall(json.decode, raw)
    if not ok then
        return fallback
    end

    if value == nil then
        return fallback
    end

    return value
end

local function toVector3(raw)
    if type(raw) == 'vector3' then
        return raw
    end

    if type(raw) ~= 'table' then
        return nil
    end

    local x = tonumber(raw.x)
    local y = tonumber(raw.y)
    local z = tonumber(raw.z)
    if not x or not y or not z then
        return nil
    end

    return vector3(x, y, z)
end

local function toVecPayload(raw)
    local vec = toVector3(raw)
    if not vec then
        return nil
    end

    return {
        x = vec.x,
        y = vec.y,
        z = vec.z,
    }
end

local function sanitizeVecPayload(raw)
    if type(raw) ~= 'table' then
        return nil
    end

    local x = tonumber(raw.x)
    local y = tonumber(raw.y)
    local z = tonumber(raw.z)
    if not x or not y or not z then
        return nil
    end

    if math.abs(x) > 100000.0 or math.abs(y) > 100000.0 or math.abs(z) > 100000.0 then
        return nil
    end

    return {
        x = x,
        y = y,
        z = z,
    }
end

local function sanitizeJobs(input)
    if type(input) ~= 'table' then
        return {}
    end

    local out = {}
    local seen = {}
    for i = 1, #input do
        local job = CAD.Server.SanitizeString(input[i], 64):lower()
        if job ~= '' and not seen[job] then
            seen[job] = true
            out[#out + 1] = job
        end
    end

    table.sort(out)
    return out
end

local function hasJobAccess(officer, jobs)
    if not officer then
        return false
    end

    if officer.isAdmin then
        return true
    end

    if type(jobs) ~= 'table' or #jobs == 0 then
        return true
    end

    local target = tostring(officer.job or ''):lower()
    for i = 1, #jobs do
        if tostring(jobs[i]):lower() == target then
            return true
        end
    end

    return false
end

local function canAdmin(officer, source)
    if officer and officer.isAdmin then
        return true
    end

    return IsPlayerAceAllowed(source, 'cad.admincad')
end

local function deviceJobsOrTerminal(deviceJobs, terminalJobs)
    if type(deviceJobs) == 'table' and #deviceJobs > 0 then
        return deviceJobs
    end
    return terminalJobs
end

local function loadRuntimeConfig()
    topologyState.runtime = {}
    local rows = dbQuery('SELECT * FROM cad_runtime_config', {}, 'runtime_config')
    for i = 1, #rows do
        local row = rows[i]
        topologyState.runtime[row.config_key] = decodeJson(row.config_value, row.config_value)
    end
end

function CAD.Topology.LoadFromDatabase()
    topologyState.terminals = {}
    topologyState.readers = {}
    topologyState.readersByTerminal = {}
    topologyState.lockers = {}
    topologyState.lockersByTerminal = {}
    topologyState.labs = {}

    local terminalRows = dbQuery('SELECT * FROM cad_terminals', {}, 'terminals')
    local terminalJobRows = dbQuery('SELECT terminal_id, job_name FROM cad_terminal_jobs', {}, 'terminal_jobs')
    local readerRows = dbQuery('SELECT * FROM cad_terminal_readers', {}, 'readers')
    local readerJobRows = dbQuery('SELECT reader_id, job_name FROM cad_terminal_reader_jobs', {}, 'reader_jobs')
    local lockerRows = dbQuery('SELECT * FROM cad_terminal_lockers', {}, 'lockers')
    local lockerJobRows = dbQuery('SELECT locker_id, job_name FROM cad_terminal_locker_jobs', {}, 'locker_jobs')
    local labRows = dbQuery('SELECT * FROM cad_forensic_labs', {}, 'labs')
    local labJobRows = dbQuery('SELECT lab_id, job_name FROM cad_forensic_lab_jobs', {}, 'lab_jobs')

    local terminalJobsMap = {}
    for i = 1, #terminalJobRows do
        local row = terminalJobRows[i]
        local terminalId = tostring(row.terminal_id or '')
        local job = tostring(row.job_name or ''):lower()
        if terminalId ~= '' and job ~= '' then
            terminalJobsMap[terminalId] = terminalJobsMap[terminalId] or {}
            terminalJobsMap[terminalId][#terminalJobsMap[terminalId] + 1] = job
        end
    end

    for i = 1, #terminalRows do
        local row = terminalRows[i]
        local coords = decodeJson(row.coords, nil)
        local terminalId = tostring(row.terminal_id or '')
        if terminalId ~= '' and toVector3(coords) then
            topologyState.terminals[terminalId] = {
                terminalId = terminalId,
                label = CAD.Server.SanitizeString(row.label, 128),
                coords = toVector3(coords),
                radius = tonumber(row.radius) or 1.25,
                enabled = tonumber(row.enabled) ~= 0,
                metadata = decodeJson(row.metadata, {}),
                jobs = sanitizeJobs(terminalJobsMap[terminalId] or {}),
                createdAt = row.created_at,
                updatedAt = row.updated_at,
            }
        end
    end

    local readerJobsMap = {}
    for i = 1, #readerJobRows do
        local row = readerJobRows[i]
        local readerId = tostring(row.reader_id or '')
        local job = tostring(row.job_name or ''):lower()
        if readerId ~= '' and job ~= '' then
            readerJobsMap[readerId] = readerJobsMap[readerId] or {}
            readerJobsMap[readerId][#readerJobsMap[readerId] + 1] = job
        end
    end

    for i = 1, #readerRows do
        local row = readerRows[i]
        local readerId = tostring(row.reader_id or '')
        local terminalId = tostring(row.terminal_id or '')
        local coords = decodeJson(row.coords, nil)
        if readerId ~= '' and terminalId ~= '' and topologyState.terminals[terminalId] and toVector3(coords) then
            local allowedItems = decodeJson(row.allowed_items, {})
            if type(allowedItems) ~= 'table' then
                allowedItems = {}
            end

            local reader = {
                readerId = readerId,
                terminalId = terminalId,
                label = CAD.Server.SanitizeString(row.label, 128),
                coords = toVector3(coords),
                rotation = decodeJson(row.rotation, nil),
                interactionDistance = tonumber(row.interaction_distance) or 1.6,
                slots = math.max(1, math.floor(tonumber(row.slots) or 5)),
                readSlot = math.max(1, math.floor(tonumber(row.read_slot) or 1)),
                weight = math.max(100, math.floor(tonumber(row.weight) or 2000)),
                strictAllowedItems = tonumber(row.strict_allowed_items) == 1,
                allowedItems = allowedItems,
                enabled = tonumber(row.enabled) ~= 0,
                metadata = decodeJson(row.metadata, {}),
                jobs = sanitizeJobs(readerJobsMap[readerId] or {}),
            }

            topologyState.readers[readerId] = reader
            topologyState.readersByTerminal[terminalId] = reader
        end
    end

    local lockerJobsMap = {}
    for i = 1, #lockerJobRows do
        local row = lockerJobRows[i]
        local lockerId = tostring(row.locker_id or '')
        local job = tostring(row.job_name or ''):lower()
        if lockerId ~= '' and job ~= '' then
            lockerJobsMap[lockerId] = lockerJobsMap[lockerId] or {}
            lockerJobsMap[lockerId][#lockerJobsMap[lockerId] + 1] = job
        end
    end

    for i = 1, #lockerRows do
        local row = lockerRows[i]
        local lockerId = tostring(row.locker_id or '')
        local terminalId = tostring(row.terminal_id or '')
        local coords = decodeJson(row.coords, nil)
        if lockerId ~= '' and terminalId ~= '' and topologyState.terminals[terminalId] and toVector3(coords) then
            local locker = {
                lockerId = lockerId,
                terminalId = terminalId,
                label = CAD.Server.SanitizeString(row.label, 128),
                coords = toVector3(coords),
                rotation = decodeJson(row.rotation, nil),
                interactionDistance = tonumber(row.interaction_distance) or 1.6,
                slots = math.max(1, math.floor(tonumber(row.slots) or 200)),
                weight = math.max(100, math.floor(tonumber(row.weight) or 500000)),
                enabled = tonumber(row.enabled) ~= 0,
                metadata = decodeJson(row.metadata, {}),
                jobs = sanitizeJobs(lockerJobsMap[lockerId] or {}),
            }

            topologyState.lockers[lockerId] = locker
            topologyState.lockersByTerminal[terminalId] = topologyState.lockersByTerminal[terminalId] or {}
            topologyState.lockersByTerminal[terminalId][#topologyState.lockersByTerminal[terminalId] + 1] = locker
        end
    end

    local labJobsMap = {}
    for i = 1, #labJobRows do
        local row = labJobRows[i]
        local labId = tostring(row.lab_id or '')
        local job = tostring(row.job_name or ''):lower()
        if labId ~= '' and job ~= '' then
            labJobsMap[labId] = labJobsMap[labId] or {}
            labJobsMap[labId][#labJobsMap[labId] + 1] = job
        end
    end

    for i = 1, #labRows do
        local row = labRows[i]
        local labId = tostring(row.lab_id or '')
        local coords = decodeJson(row.coords, nil)
        if labId ~= '' and toVector3(coords) then
            topologyState.labs[labId] = {
                labId = labId,
                name = CAD.Server.SanitizeString(row.name, 128),
                coords = toVector3(coords),
                radius = tonumber(row.radius) or 10.0,
                enabled = tonumber(row.enabled) ~= 0,
                metadata = decodeJson(row.metadata, {}),
                jobs = sanitizeJobs(labJobsMap[labId] or {}),
            }
        end
    end

    loadRuntimeConfig()

    topologyState.revision = (tonumber(topologyState.revision) or 0) + 1
    CAD.Log('success', 'Topology loaded: %s terminals, %s readers, %s lockers, %s labs',
        tostring(#terminalRows), tostring(#readerRows), tostring(#lockerRows), tostring(#labRows))
end

function CAD.Topology.GetRevision()
    return tonumber(topologyState.revision) or 0
end

function CAD.Topology.GetTerminalById(terminalId)
    return topologyState.terminals[tostring(terminalId or '')]
end

function CAD.Topology.GetReaderByTerminal(terminalId)
    return topologyState.readersByTerminal[tostring(terminalId or '')]
end

function CAD.Topology.GetLockerById(lockerId)
    return topologyState.lockers[tostring(lockerId or '')]
end

function CAD.Topology.GetLockersByTerminal(terminalId)
    return topologyState.lockersByTerminal[tostring(terminalId or '')] or {}
end

function CAD.Topology.ResolveReaderContext(officer, terminalId)
    local terminal = CAD.Topology.GetTerminalById(terminalId)
    if not terminal or terminal.enabled ~= true then
        return nil, nil, 'terminal_not_found'
    end

    if not hasJobAccess(officer, terminal.jobs) then
        return nil, nil, 'forbidden'
    end

    local reader = CAD.Topology.GetReaderByTerminal(terminal.terminalId)
    if not reader or reader.enabled ~= true then
        return terminal, nil, 'reader_not_enabled'
    end

    local resolvedJobs = deviceJobsOrTerminal(reader.jobs, terminal.jobs)
    if not hasJobAccess(officer, resolvedJobs) then
        return terminal, nil, 'forbidden'
    end

    return terminal, reader, nil
end

function CAD.Topology.ResolveLockerContext(officer, payload)
    local data = type(payload) == 'table' and payload or {}
    local lockerId = CAD.Server.SanitizeString(data.lockerId, 64)
    local terminalId = CAD.Server.SanitizeString(data.terminalId, 64)

    if lockerId ~= '' then
        local locker = CAD.Topology.GetLockerById(lockerId)
        if not locker or locker.enabled ~= true then
            return nil, nil, 'locker_not_found'
        end

        local terminal = CAD.Topology.GetTerminalById(locker.terminalId)
        if not terminal or terminal.enabled ~= true then
            return nil, nil, 'terminal_not_found'
        end

        if not hasJobAccess(officer, terminal.jobs) then
            return nil, nil, 'forbidden'
        end

        local resolvedJobs = deviceJobsOrTerminal(locker.jobs, terminal.jobs)
        if not hasJobAccess(officer, resolvedJobs) then
            return nil, nil, 'forbidden'
        end

        return terminal, locker, nil
    end

    if terminalId == '' then
        return nil, nil, 'terminal_id_required'
    end

    local terminal = CAD.Topology.GetTerminalById(terminalId)
    if not terminal or terminal.enabled ~= true then
        return nil, nil, 'terminal_not_found'
    end

    if not hasJobAccess(officer, terminal.jobs) then
        return nil, nil, 'forbidden'
    end

    local lockers = CAD.Topology.GetLockersByTerminal(terminal.terminalId)
    for i = 1, #lockers do
        local locker = lockers[i]
        if locker.enabled == true then
            local resolvedJobs = deviceJobsOrTerminal(locker.jobs, terminal.jobs)
            if hasJobAccess(officer, resolvedJobs) then
                return terminal, locker, nil
            end
        end
    end

    return terminal, nil, 'container_not_enabled'
end

function CAD.Topology.GetLabsForOfficer(officer)
    local out = {}
    for _, lab in pairs(topologyState.labs) do
        if lab.enabled == true and hasJobAccess(officer, lab.jobs) then
            out[#out + 1] = lab
        end
    end
    return out
end

function CAD.Topology.GetAllLabs()
    local out = {}
    for _, lab in pairs(topologyState.labs) do
        if lab.enabled == true then
            out[#out + 1] = lab
        end
    end
    return out
end

function CAD.Topology.IsOfficerInLab(source, officer)
    local ped = GetPlayerPed(source)
    if not ped or ped <= 0 then
        return false
    end

    local coords = GetEntityCoords(ped)
    local labs = CAD.Topology.GetLabsForOfficer(officer)
    for i = 1, #labs do
        local lab = labs[i]
        if #(coords - lab.coords) <= (tonumber(lab.radius) or 10.0) then
            return true, lab
        end
    end

    return false, nil
end

local function tableCopy(list)
    local out = {}
    for i = 1, #list do
        out[i] = list[i]
    end
    return out
end

function CAD.Topology.GetSnapshotForOfficer(officer)
    local terminals = {}

    for _, terminal in pairs(topologyState.terminals) do
        if terminal.enabled == true and hasJobAccess(officer, terminal.jobs) then
            local reader = CAD.Topology.GetReaderByTerminal(terminal.terminalId)
            local readerOut = nil
            if reader and reader.enabled == true then
                local readerJobs = deviceJobsOrTerminal(reader.jobs, terminal.jobs)
                if hasJobAccess(officer, readerJobs) then
                    readerOut = {
                        readerId = reader.readerId,
                        label = reader.label,
                        coords = toVecPayload(reader.coords),
                        interactionDistance = reader.interactionDistance,
                        readSlot = reader.readSlot,
                    }
                end
            end

            local lockersOut = {}
            local lockers = CAD.Topology.GetLockersByTerminal(terminal.terminalId)
            for i = 1, #lockers do
                local locker = lockers[i]
                if locker.enabled == true then
                    local lockerJobs = deviceJobsOrTerminal(locker.jobs, terminal.jobs)
                    if hasJobAccess(officer, lockerJobs) then
                        lockersOut[#lockersOut + 1] = {
                            lockerId = locker.lockerId,
                            label = locker.label,
                            coords = toVecPayload(locker.coords),
                            interactionDistance = locker.interactionDistance,
                            slots = locker.slots,
                        }
                    end
                end
            end

            terminals[#terminals + 1] = {
                terminalId = terminal.terminalId,
                label = terminal.label,
                coords = toVecPayload(terminal.coords),
                radius = terminal.radius,
                hasReader = readerOut ~= nil,
                reader = readerOut,
                hasContainer = #lockersOut > 0,
                lockers = lockersOut,
                defaultLockerId = lockersOut[1] and lockersOut[1].lockerId or nil,
                jobs = tableCopy(terminal.jobs),
            }
        end
    end

    table.sort(terminals, function(a, b)
        return tostring(a.terminalId) < tostring(b.terminalId)
    end)

    local labs = {}
    local officerLabs = CAD.Topology.GetLabsForOfficer(officer)
    for i = 1, #officerLabs do
        local lab = officerLabs[i]
        labs[#labs + 1] = {
            labId = lab.labId,
            name = lab.name,
            coords = toVecPayload(lab.coords),
            radius = lab.radius,
            jobs = tableCopy(lab.jobs),
        }
    end

    table.sort(labs, function(a, b)
        return tostring(a.labId) < tostring(b.labId)
    end)

    return {
        rev = CAD.Topology.GetRevision(),
        terminals = terminals,
        labs = labs,
    }
end

function CAD.Topology.BroadcastSnapshots()
    local players = GetPlayers()
    for i = 1, #players do
        local src = tonumber(players[i])
        if src and src > 0 then
            local officer = CAD.Auth.GetOfficerData(src)
            if officer then
                CAD.Server.BroadcastToPlayer(src, 'topologyUpdated', {
                    snapshot = CAD.Topology.GetSnapshotForOfficer(officer),
                })
            end
        end
    end
end

local function refreshAndBroadcast()
    CAD.Topology.LoadFromDatabase()
    CAD.Topology.BroadcastSnapshots()
end

local function upsertJobList(tableName, keyName, keyValue, jobs)
    dbExec(('DELETE FROM %s WHERE %s = ?'):format(tableName, keyName), { keyValue }, tableName .. ':clear_jobs')
    for i = 1, #jobs do
        dbExec(
            ('INSERT INTO %s (%s, job_name) VALUES (?, ?)'):format(tableName, keyName),
            { keyValue, jobs[i] },
            tableName .. ':insert_job'
        )
    end
end

lib.callback.register('cad:topology:getSnapshot', CAD.Auth.WithGuard('default', function(_, _, officer)
    return {
        ok = true,
        snapshot = CAD.Topology.GetSnapshotForOfficer(officer),
    }
end))

lib.callback.register('cad:topology:isAdmin', CAD.Auth.WithGuard('default', function(source, _, officer)
    return {
        ok = true,
        isAdmin = canAdmin(officer, source),
    }
end))

lib.callback.register('cad:topology:createTerminal', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not canAdmin(officer, source) then
        return { ok = false, error = 'forbidden' }
    end

    local label = CAD.Server.SanitizeString(payload and payload.label, 128)
    if label == '' then
        return { ok = false, error = 'label_required' }
    end

    local coords = sanitizeVecPayload(payload and payload.coords)
    if not coords then
        return { ok = false, error = 'invalid_coords' }
    end

    local terminalId = CAD.Server.SanitizeString(payload and payload.terminalId, 64)
    if terminalId == '' then
        terminalId = CAD.Server.GenerateId('TERM')
    end

    local now = CAD.Server.ToIso()
    local radius = tonumber(payload and payload.radius) or 1.25
    if radius < 0.5 then radius = 0.5 end
    if radius > 12.0 then radius = 12.0 end
    local jobs = sanitizeJobs(payload and payload.jobs or {})

    local ok = dbExec([[
        INSERT INTO cad_terminals (terminal_id, label, coords, radius, enabled, metadata, created_by, created_by_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            label = VALUES(label),
            coords = VALUES(coords),
            radius = VALUES(radius),
            metadata = VALUES(metadata),
            updated_at = VALUES(updated_at)
    ]], {
        terminalId,
        label,
        json.encode(coords),
        radius,
        json.encode(type(payload and payload.metadata) == 'table' and payload.metadata or {}),
        officer.identifier,
        officer.name,
        now,
        now,
    }, 'create_terminal')

    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    upsertJobList('cad_terminal_jobs', 'terminal_id', terminalId, jobs)
    refreshAndBroadcast()

    return {
        ok = true,
        terminalId = terminalId,
    }
end))

lib.callback.register('cad:topology:createReader', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not canAdmin(officer, source) then
        return { ok = false, error = 'forbidden' }
    end

    local terminalId = CAD.Server.SanitizeString(payload and payload.terminalId, 64)
    local terminal = CAD.Topology.GetTerminalById(terminalId)
    if not terminal then
        return { ok = false, error = 'terminal_not_found' }
    end

    local existing = CAD.Topology.GetReaderByTerminal(terminalId)
    if existing and existing.enabled == true then
        return { ok = false, error = 'reader_already_exists', readerId = existing.readerId }
    end

    local coords = sanitizeVecPayload(payload and payload.coords)
    if not coords then
        return { ok = false, error = 'invalid_coords' }
    end

    local readerId = CAD.Server.SanitizeString(payload and payload.readerId, 64)
    if readerId == '' then
        readerId = CAD.Server.GenerateId('RDR')
    end

    local label = CAD.Server.SanitizeString(payload and payload.label, 128)
    if label == '' then
        label = ('%s Reader'):format(terminal.label)
    end

    local now = CAD.Server.ToIso()
    local interactionDistance = tonumber(payload and payload.interactionDistance) or 1.6
    local slots = math.max(1, math.floor(tonumber(payload and payload.slots) or 5))
    local readSlot = math.max(1, math.floor(tonumber(payload and payload.readSlot) or 1))
    local weight = math.max(100, math.floor(tonumber(payload and payload.weight) or 2000))
    local strictAllowedItems = payload and payload.strictAllowedItems == true
    local allowedItems = type(payload and payload.allowedItems) == 'table' and payload.allowedItems or {}
    local jobs = sanitizeJobs(payload and payload.jobs or {})

    local ok = dbExec([[
        INSERT INTO cad_terminal_readers (
            reader_id, terminal_id, label, coords, rotation, interaction_distance,
            slots, read_slot, weight, strict_allowed_items, allowed_items,
            enabled, metadata, created_by, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            terminal_id = VALUES(terminal_id),
            label = VALUES(label),
            coords = VALUES(coords),
            rotation = VALUES(rotation),
            interaction_distance = VALUES(interaction_distance),
            slots = VALUES(slots),
            read_slot = VALUES(read_slot),
            weight = VALUES(weight),
            strict_allowed_items = VALUES(strict_allowed_items),
            allowed_items = VALUES(allowed_items),
            enabled = 1,
            metadata = VALUES(metadata),
            updated_at = VALUES(updated_at)
    ]], {
        readerId,
        terminalId,
        label,
        json.encode(coords),
        json.encode(type(payload and payload.rotation) == 'table' and payload.rotation or {}),
        interactionDistance,
        slots,
        readSlot,
        weight,
        strictAllowedItems and 1 or 0,
        json.encode(allowedItems),
        json.encode(type(payload and payload.metadata) == 'table' and payload.metadata or {}),
        officer.identifier,
        officer.name,
        now,
        now,
    }, 'create_reader')

    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    upsertJobList('cad_terminal_reader_jobs', 'reader_id', readerId, jobs)
    refreshAndBroadcast()

    return {
        ok = true,
        terminalId = terminalId,
        readerId = readerId,
    }
end))

lib.callback.register('cad:topology:createLocker', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not canAdmin(officer, source) then
        return { ok = false, error = 'forbidden' }
    end

    local terminalId = CAD.Server.SanitizeString(payload and payload.terminalId, 64)
    local terminal = CAD.Topology.GetTerminalById(terminalId)
    if not terminal then
        return { ok = false, error = 'terminal_not_found' }
    end

    local coords = sanitizeVecPayload(payload and payload.coords)
    if not coords then
        return { ok = false, error = 'invalid_coords' }
    end

    local lockerId = CAD.Server.SanitizeString(payload and payload.lockerId, 64)
    if lockerId == '' then
        lockerId = CAD.Server.GenerateId('LCK')
    end

    local label = CAD.Server.SanitizeString(payload and payload.label, 128)
    if label == '' then
        label = ('%s Locker'):format(terminal.label)
    end

    local now = CAD.Server.ToIso()
    local interactionDistance = tonumber(payload and payload.interactionDistance) or 1.6
    local slots = math.max(1, math.floor(tonumber(payload and payload.slots) or 200))
    local weight = math.max(100, math.floor(tonumber(payload and payload.weight) or 500000))
    local jobs = sanitizeJobs(payload and payload.jobs or {})

    local ok = dbExec([[
        INSERT INTO cad_terminal_lockers (
            locker_id, terminal_id, label, coords, rotation, interaction_distance,
            slots, weight, enabled, metadata, created_by, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            terminal_id = VALUES(terminal_id),
            label = VALUES(label),
            coords = VALUES(coords),
            rotation = VALUES(rotation),
            interaction_distance = VALUES(interaction_distance),
            slots = VALUES(slots),
            weight = VALUES(weight),
            enabled = 1,
            metadata = VALUES(metadata),
            updated_at = VALUES(updated_at)
    ]], {
        lockerId,
        terminalId,
        label,
        json.encode(coords),
        json.encode(type(payload and payload.rotation) == 'table' and payload.rotation or {}),
        interactionDistance,
        slots,
        weight,
        json.encode(type(payload and payload.metadata) == 'table' and payload.metadata or {}),
        officer.identifier,
        officer.name,
        now,
        now,
    }, 'create_locker')

    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    upsertJobList('cad_terminal_locker_jobs', 'locker_id', lockerId, jobs)
    refreshAndBroadcast()

    return {
        ok = true,
        terminalId = terminalId,
        lockerId = lockerId,
    }
end))

lib.callback.register('cad:topology:createLab', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not canAdmin(officer, source) then
        return { ok = false, error = 'forbidden' }
    end

    local name = CAD.Server.SanitizeString(payload and payload.name, 128)
    if name == '' then
        return { ok = false, error = 'name_required' }
    end

    local coords = sanitizeVecPayload(payload and payload.coords)
    if not coords then
        return { ok = false, error = 'invalid_coords' }
    end

    local labId = CAD.Server.SanitizeString(payload and payload.labId, 64)
    if labId == '' then
        labId = CAD.Server.GenerateId('LAB')
    end

    local radius = tonumber(payload and payload.radius) or 10.0
    if radius < 0.5 then radius = 0.5 end
    if radius > 80.0 then radius = 80.0 end
    local now = CAD.Server.ToIso()
    local jobs = sanitizeJobs(payload and payload.jobs or {})

    local ok = dbExec([[
        INSERT INTO cad_forensic_labs (lab_id, name, coords, radius, enabled, metadata, created_by, created_by_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            coords = VALUES(coords),
            radius = VALUES(radius),
            enabled = 1,
            metadata = VALUES(metadata),
            updated_at = VALUES(updated_at)
    ]], {
        labId,
        name,
        json.encode(coords),
        radius,
        json.encode(type(payload and payload.metadata) == 'table' and payload.metadata or {}),
        officer.identifier,
        officer.name,
        now,
        now,
    }, 'create_lab')

    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    upsertJobList('cad_forensic_lab_jobs', 'lab_id', labId, jobs)
    refreshAndBroadcast()

    return {
        ok = true,
        labId = labId,
    }
end))

lib.callback.register('cad:topology:removeLocker', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not canAdmin(officer, source) then
        return { ok = false, error = 'forbidden' }
    end

    local lockerId = CAD.Server.SanitizeString(payload and payload.lockerId, 64)
    if lockerId == '' then
        return { ok = false, error = 'locker_id_required' }
    end

    dbExec('DELETE FROM cad_terminal_locker_jobs WHERE locker_id = ?', { lockerId }, 'remove_locker_jobs')
    local ok = dbExec('DELETE FROM cad_terminal_lockers WHERE locker_id = ?', { lockerId }, 'remove_locker')
    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    refreshAndBroadcast()
    return { ok = true }
end))

lib.callback.register('cad:topology:removeReader', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not canAdmin(officer, source) then
        return { ok = false, error = 'forbidden' }
    end

    local readerId = CAD.Server.SanitizeString(payload and payload.readerId, 64)
    if readerId == '' then
        return { ok = false, error = 'reader_id_required' }
    end

    dbExec('DELETE FROM cad_terminal_reader_jobs WHERE reader_id = ?', { readerId }, 'remove_reader_jobs')
    local ok = dbExec('DELETE FROM cad_terminal_readers WHERE reader_id = ?', { readerId }, 'remove_reader')
    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    refreshAndBroadcast()
    return { ok = true }
end))

lib.callback.register('cad:topology:removeTerminal', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not canAdmin(officer, source) then
        return { ok = false, error = 'forbidden' }
    end

    local terminalId = CAD.Server.SanitizeString(payload and payload.terminalId, 64)
    if terminalId == '' then
        return { ok = false, error = 'terminal_id_required' }
    end

    local lockers = CAD.Topology.GetLockersByTerminal(terminalId)
    for i = 1, #lockers do
        dbExec('DELETE FROM cad_terminal_locker_jobs WHERE locker_id = ?', { lockers[i].lockerId }, 'remove_terminal_locker_jobs')
    end

    local reader = CAD.Topology.GetReaderByTerminal(terminalId)
    if reader then
        dbExec('DELETE FROM cad_terminal_reader_jobs WHERE reader_id = ?', { reader.readerId }, 'remove_terminal_reader_jobs')
    end

    dbExec('DELETE FROM cad_terminal_lockers WHERE terminal_id = ?', { terminalId }, 'remove_terminal_lockers')
    dbExec('DELETE FROM cad_terminal_readers WHERE terminal_id = ?', { terminalId }, 'remove_terminal_reader')
    dbExec('DELETE FROM cad_terminal_jobs WHERE terminal_id = ?', { terminalId }, 'remove_terminal_jobs')
    local ok = dbExec('DELETE FROM cad_terminals WHERE terminal_id = ?', { terminalId }, 'remove_terminal')
    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    refreshAndBroadcast()
    return { ok = true }
end))

lib.callback.register('cad:topology:removeLab', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not canAdmin(officer, source) then
        return { ok = false, error = 'forbidden' }
    end

    local labId = CAD.Server.SanitizeString(payload and payload.labId, 64)
    if labId == '' then
        return { ok = false, error = 'lab_id_required' }
    end

    dbExec('DELETE FROM cad_forensic_lab_jobs WHERE lab_id = ?', { labId }, 'remove_lab_jobs')
    local ok = dbExec('DELETE FROM cad_forensic_labs WHERE lab_id = ?', { labId }, 'remove_lab')
    if not ok then
        return { ok = false, error = 'db_write_failed' }
    end

    refreshAndBroadcast()
    return { ok = true }
end))
