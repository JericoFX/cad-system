CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Toxicology = CAD.Forensic.Toxicology or {}

local sourceCitizenIndex = {}
local citizenExposureCache = {}
local trackedItemsCache = nil
local trackedItemsRef = nil

local function getNowMs()
    return os.time() * 1000
end

local function safeJsonDecode(raw, fallback)
    if type(raw) ~= 'string' or raw == '' then
        return fallback
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok or decoded == nil then
        return fallback
    end

    return decoded
end

local function sanitizeIdentifier(value, fallback)
    local text = tostring(value or fallback or '')
    text = text:gsub('[^%w_]', '')
    if text == '' then
        return fallback
    end
    return text
end

local function parseIsoToMs(value)
    if type(value) ~= 'string' then
        return nil
    end

    local year, month, day, hour, minute, second =
        string.match(value, '^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)Z$')
    if not year then
        return nil
    end

    return os.time({
        year = tonumber(year),
        month = tonumber(month),
        day = tonumber(day),
        hour = tonumber(hour),
        min = tonumber(minute),
        sec = tonumber(second),
    }) * 1000
end

local function getConfig()
    local forensics = CAD.Config and CAD.Config.Forensics or {}
    return forensics.Toxicology or {}
end

local function isEnabled()
    local cfg = getConfig()
    if cfg.Enabled == false then
        return false
    end

    return true
end

local function getMetadataKey()
    local cfg = getConfig()
    local key = CAD.Server.SanitizeString(cfg.MetadataKey, 64)
    if key == '' then
        return 'cad_toxicology'
    end
    return key
end

local function getStateBagKey()
    local cfg = getConfig()
    local key = CAD.Server.SanitizeString(cfg.StateBagKey, 64)
    if key == '' then
        return 'cad_toxicology'
    end
    return key
end

local function getDefaultWindowMs()
    local cfg = getConfig()
    local windowMs = tonumber(cfg.DefaultWindowMs) or 1800000
    if windowMs < 1000 then
        windowMs = 1000
    end
    return math.floor(windowMs)
end

local function normalizeItemName(value)
    local itemName = string.lower(CAD.StringTrim(tostring(value or '')))
    return itemName
end

local function normalizeSubstance(value)
    local substance = CAD.Server.SanitizeString(value, 64)
    if substance == '' then
        return 'UNKNOWN'
    end
    return string.upper(substance)
end

local function normalizeSeverity(value)
    local severity = string.upper(CAD.Server.SanitizeString(value, 16))
    if severity ~= 'LOW' and severity ~= 'MEDIUM' and severity ~= 'HIGH' and severity ~= 'CRITICAL' then
        return 'MEDIUM'
    end
    return severity
end

local function getTrackedItemsMap()
    local cfg = getConfig()
    local trackedItems = type(cfg.TrackedItems) == 'table' and cfg.TrackedItems or {}

    if trackedItemsRef == trackedItems and trackedItemsCache ~= nil then
        return trackedItemsCache
    end

    local mapped = {}
    for itemName, itemCfg in pairs(trackedItems) do
        local normalizedItemName = normalizeItemName(itemName)
        if normalizedItemName ~= '' then
            local configEntry = type(itemCfg) == 'table' and itemCfg or {}
            local windowMs = tonumber(configEntry.windowMs) or tonumber(configEntry.durationMs) or getDefaultWindowMs()
            if windowMs < 1000 then
                windowMs = 1000
            end

            mapped[normalizedItemName] = {
                itemName = normalizedItemName,
                substance = normalizeSubstance(configEntry.substance or normalizedItemName),
                windowMs = math.floor(windowMs),
                severity = normalizeSeverity(configEntry.severity),
            }
        end
    end

    trackedItemsRef = trackedItems
    trackedItemsCache = mapped
    return mapped
end

local function buildEmptySnapshot(sourceLabel)
    return {
        testedAt = CAD.Server.ToIso(),
        isPositive = false,
        activeCount = 0,
        substances = {},
        source = sourceLabel or 'QBCORE_METADATA',
    }
end

local function normalizeActiveExposures(rawExposures, nowMs)
    local normalized = {}
    if type(rawExposures) ~= 'table' then
        return normalized
    end

    for key, value in pairs(rawExposures) do
        local entry = type(value) == 'table' and value or {}
        local substance = normalizeSubstance(entry.substance or key)
        local usedAtMs = tonumber(entry.usedAtMs or entry.used_at_ms)
        if not usedAtMs then
            usedAtMs = parseIsoToMs(entry.usedAt)
        end
        if not usedAtMs then
            usedAtMs = nowMs
        end

        local expiresAtMs = tonumber(entry.expiresAtMs or entry.expires_at_ms)
        if not expiresAtMs then
            expiresAtMs = parseIsoToMs(entry.expiresAt)
        end

        if expiresAtMs and expiresAtMs > nowMs then
            normalized[substance] = {
                substance = substance,
                sourceItem = normalizeItemName(entry.sourceItem or entry.itemName),
                severity = normalizeSeverity(entry.severity),
                usedAtMs = usedAtMs,
                usedAt = entry.usedAt or CAD.Server.ToIso(math.floor(usedAtMs / 1000)),
                expiresAtMs = expiresAtMs,
                expiresAt = entry.expiresAt or CAD.Server.ToIso(math.floor(expiresAtMs / 1000)),
                slotId = tonumber(entry.slotId) or nil,
            }
        end
    end

    return normalized
end

local function extractExposuresFromMetadataTable(metadataTable, nowMs)
    if type(metadataTable) ~= 'table' then
        return {}
    end

    local metadataKey = getMetadataKey()
    local stored = metadataTable[metadataKey]
    if type(stored) ~= 'table' then
        return {}
    end

    local exposures = type(stored.exposures) == 'table' and stored.exposures or stored
    return normalizeActiveExposures(exposures, nowMs)
end

local function buildMetadataStore(exposures, nowMs)
    return {
        updatedAt = CAD.Server.ToIso(math.floor(nowMs / 1000)),
        updatedAtMs = nowMs,
        exposures = exposures,
    }
end

local function buildSnapshot(exposures, nowMs, sourceLabel)
    local list = {}
    for _, value in pairs(exposures or {}) do
        local remainingMs = math.max(0, (tonumber(value.expiresAtMs) or 0) - nowMs)
        if remainingMs > 0 then
            list[#list + 1] = {
                substance = value.substance,
                severity = value.severity,
                sourceItem = value.sourceItem,
                usedAt = value.usedAt,
                expiresAt = value.expiresAt,
                remainingMs = remainingMs,
            }
        end
    end

    table.sort(list, function(a, b)
        if a.remainingMs == b.remainingMs then
            return a.substance < b.substance
        end
        return a.remainingMs > b.remainingMs
    end)

    return {
        testedAt = CAD.Server.ToIso(math.floor(nowMs / 1000)),
        isPositive = #list > 0,
        activeCount = #list,
        substances = list,
        source = sourceLabel or 'QBCORE_METADATA',
    }
end

local function getQBCoreObject()
    if GetResourceState('qb-core') ~= 'started' then
        return nil
    end

    local ok, qb = pcall(function()
        return exports['qb-core']:GetCoreObject()
    end)

    if not ok then
        return nil
    end

    return qb
end

local function getQbPlayerBySource(playerSource)
    local source = tonumber(playerSource)
    if not source or source <= 0 then
        return nil
    end

    local qb = getQBCoreObject()
    if not qb or not qb.Functions or not qb.Functions.GetPlayer then
        return nil
    end

    local ok, qbPlayer = pcall(function()
        return qb.Functions.GetPlayer(source)
    end)

    if not ok then
        return nil
    end

    return qbPlayer
end

local function getQbPlayerByCitizenId(citizenId)
    local qb = getQBCoreObject()
    if not qb or not qb.Functions then
        return nil
    end

    if qb.Functions.GetPlayerByCitizenId then
        local ok, qbPlayer = pcall(function()
            return qb.Functions.GetPlayerByCitizenId(citizenId)
        end)
        if ok and qbPlayer then
            return qbPlayer
        end
    end

    local players = GetPlayers()
    for i = 1, #players do
        local playerSource = tonumber(players[i])
        local qbPlayer = getQbPlayerBySource(playerSource)
        local playerData = qbPlayer and qbPlayer.PlayerData or {}
        if playerData and tostring(playerData.citizenid or '') == citizenId then
            return qbPlayer
        end
    end

    return nil
end

local function getCitizenIdFromQbPlayer(qbPlayer)
    local playerData = qbPlayer and qbPlayer.PlayerData or {}
    local citizenId = CAD.Server.SanitizeString(playerData.citizenid, 64)
    if citizenId == '' then
        return nil
    end
    return citizenId
end

local function getSourceFromQbPlayer(qbPlayer)
    local playerData = qbPlayer and qbPlayer.PlayerData or {}
    local source = tonumber(playerData.source)
    if source and source > 0 then
        return source
    end
    return nil
end

local function getMetadataFromQbPlayer(qbPlayer)
    local playerData = qbPlayer and qbPlayer.PlayerData or {}
    return type(playerData.metadata) == 'table' and playerData.metadata or {}
end

local function setPlayerStateBag(playerSource, snapshot)
    local source = tonumber(playerSource)
    if not source or source <= 0 then
        return
    end

    local stateBagKey = getStateBagKey()
    local ok, err = pcall(function()
        local player = Player(source)
        if not player or not player.state then
            return
        end

        if type(player.state.set) == 'function' then
            player.state:set(stateBagKey, snapshot, true)
        else
            player.state[stateBagKey] = snapshot
        end
    end)

    if not ok then
        CAD.Log('warn', 'Failed to set toxicology state bag for %s: %s', tostring(source), tostring(err))
    end
end

local function setToxicologyMetadataOnQbPlayer(qbPlayer, exposures, nowMs)
    if not qbPlayer or not qbPlayer.Functions or not qbPlayer.Functions.SetMetaData then
        return false
    end

    local metadataKey = getMetadataKey()
    qbPlayer.Functions.SetMetaData(metadataKey, buildMetadataStore(exposures, nowMs))
    return true
end

local function getDataSourceConfig()
    local forensics = CAD.Config.Forensics or {}
    local idReader = type(forensics.IdReader) == 'table' and forensics.IdReader or {}
    local tablet = type(idReader.VehicleTablet) == 'table' and idReader.VehicleTablet or {}
    local data = type(tablet.DataSource) == 'table' and tablet.DataSource or {}

    return {
        playersTable = sanitizeIdentifier(data.PlayersTable, 'players') or 'players',
        playersCitizenColumn = sanitizeIdentifier(data.PlayersCitizenColumn, 'citizenid') or 'citizenid',
        playersMetadataColumn = sanitizeIdentifier(data.PlayersMetadataColumn, 'metadata') or 'metadata',
    }
end

local function loadMetadataFromDatabase(citizenId)
    local source = getDataSourceConfig()
    local sql = ('SELECT %s FROM %s WHERE %s = ? LIMIT 1')
        :format(source.playersMetadataColumn, source.playersTable, source.playersCitizenColumn)

    local ok, rows = pcall(function()
        return MySQL.query.await(sql, { citizenId })
    end)

    if not ok then
        CAD.Log('warn', 'Failed loading toxicology metadata for %s: %s', citizenId, tostring(rows))
        return {}
    end

    local row = rows and rows[1] or nil
    if not row then
        return {}
    end

    local metadataRaw = row[source.playersMetadataColumn]
    return safeJsonDecode(metadataRaw, {})
end

local function resolveActiveExposuresByCitizenId(citizenId)
    local nowMs = getNowMs()
    local cached = citizenExposureCache[citizenId]
    if type(cached) == 'table' then
        local activeCached = normalizeActiveExposures(cached, nowMs)
        citizenExposureCache[citizenId] = activeCached
        if next(activeCached) ~= nil then
            return activeCached, nowMs, 'CACHE'
        end
    end

    local qbPlayer = getQbPlayerByCitizenId(citizenId)
    if qbPlayer then
        local metadata = getMetadataFromQbPlayer(qbPlayer)
        local active = extractExposuresFromMetadataTable(metadata, nowMs)
        citizenExposureCache[citizenId] = active

        local source = getSourceFromQbPlayer(qbPlayer)
        if source then
            sourceCitizenIndex[source] = citizenId
            setPlayerStateBag(source, buildSnapshot(active, nowMs, 'QBCORE_METADATA'))
        end

        return active, nowMs, 'QBCORE_METADATA'
    end

    local dbMetadata = loadMetadataFromDatabase(citizenId)
    local active = extractExposuresFromMetadataTable(dbMetadata, nowMs)
    citizenExposureCache[citizenId] = active
    return active, nowMs, 'QBCORE_DB_METADATA'
end

function CAD.Forensic.Toxicology.GetSnapshotForCitizen(citizenId)
    local normalizedCitizenId = CAD.Server.SanitizeString(citizenId, 64)
    if normalizedCitizenId == '' then
        return buildEmptySnapshot('QBCORE_METADATA')
    end

    if not isEnabled() then
        return buildEmptySnapshot('DISABLED')
    end

    local exposures, nowMs, sourceLabel = resolveActiveExposuresByCitizenId(normalizedCitizenId)
    return buildSnapshot(exposures, nowMs, sourceLabel)
end

function CAD.Forensic.Toxicology.GetSnapshotForSource(playerSource)
    local source = tonumber(playerSource)
    if not source or source <= 0 then
        return buildEmptySnapshot('QBCORE_METADATA')
    end

    local qbPlayer = getQbPlayerBySource(source)
    if not qbPlayer then
        return buildEmptySnapshot('QBCORE_METADATA')
    end

    local citizenId = getCitizenIdFromQbPlayer(qbPlayer)
    if not citizenId then
        return buildEmptySnapshot('QBCORE_METADATA')
    end

    local nowMs = getNowMs()
    local active = extractExposuresFromMetadataTable(getMetadataFromQbPlayer(qbPlayer), nowMs)
    citizenExposureCache[citizenId] = active
    sourceCitizenIndex[source] = citizenId
    local snapshot = buildSnapshot(active, nowMs, 'QBCORE_METADATA')
    setPlayerStateBag(source, snapshot)
    return snapshot
end

function CAD.Forensic.Toxicology.RecordItemUse(playerSource, itemName, slotId)
    local source = tonumber(playerSource)
    if not source or source <= 0 then
        return nil, 'invalid_source'
    end

    if not isEnabled() then
        return nil, 'disabled'
    end

    local trackedItems = getTrackedItemsMap()
    local normalizedItemName = normalizeItemName(itemName)
    local tracked = trackedItems[normalizedItemName]
    if not tracked then
        return nil, 'item_not_tracked'
    end

    local qbPlayer = getQbPlayerBySource(source)
    if not qbPlayer then
        return nil, 'player_not_found'
    end

    local citizenId = getCitizenIdFromQbPlayer(qbPlayer)
    if not citizenId then
        return nil, 'citizenid_not_found'
    end

    local nowMs = getNowMs()
    local activeExposures = extractExposuresFromMetadataTable(getMetadataFromQbPlayer(qbPlayer), nowMs)
    local previous = type(activeExposures[tracked.substance]) == 'table' and activeExposures[tracked.substance] or {}
    local expiresAtMs = nowMs + tracked.windowMs
    local previousExpiresAtMs = tonumber(previous.expiresAtMs) or 0
    if previousExpiresAtMs > expiresAtMs then
        expiresAtMs = previousExpiresAtMs
    end

    activeExposures[tracked.substance] = {
        substance = tracked.substance,
        sourceItem = tracked.itemName,
        severity = tracked.severity,
        usedAtMs = nowMs,
        usedAt = CAD.Server.ToIso(math.floor(nowMs / 1000)),
        expiresAtMs = expiresAtMs,
        expiresAt = CAD.Server.ToIso(math.floor(expiresAtMs / 1000)),
        slotId = tonumber(slotId) or nil,
    }

    local persisted = setToxicologyMetadataOnQbPlayer(qbPlayer, activeExposures, nowMs)
    if not persisted then
        return nil, 'metadata_persist_failed'
    end

    citizenExposureCache[citizenId] = activeExposures
    sourceCitizenIndex[source] = citizenId

    local snapshot = buildSnapshot(activeExposures, nowMs, 'QBCORE_METADATA')
    setPlayerStateBag(source, snapshot)
    return snapshot
end

function CAD.Forensic.Toxicology.SyncPlayerState(playerSource)
    return CAD.Forensic.Toxicology.GetSnapshotForSource(playerSource)
end

AddEventHandler('ox_inventory:usedItem', function(playerId, name, slotId)
    local source = tonumber(playerId)
    if not source or source <= 0 then
        return
    end

    local _, err = CAD.Forensic.Toxicology.RecordItemUse(source, name, slotId)
    if err and err ~= 'item_not_tracked' and err ~= 'disabled' then
        CAD.Log('warn', 'Toxicology record failed for %s using %s: %s', tostring(source), tostring(name), tostring(err))
    end
end)

RegisterNetEvent('QBCore:Server:OnPlayerLoaded', function(playerSource)
    local eventSource = tonumber(source)
    local playerId = tonumber(playerSource) or eventSource
    if not playerId or playerId <= 0 then
        return
    end

    CAD.Forensic.Toxicology.SyncPlayerState(playerId)
end)

AddEventHandler('playerDropped', function()
    local playerId = tonumber(source)
    if not playerId or playerId <= 0 then
        return
    end

    local citizenId = sourceCitizenIndex[playerId]
    sourceCitizenIndex[playerId] = nil
    if citizenId then
        citizenExposureCache[citizenId] = nil
    end
end)

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    local players = GetPlayers()
    for i = 1, #players do
        local source = tonumber(players[i])
        if source and source > 0 then
            CAD.Forensic.Toxicology.SyncPlayerState(source)
        end
    end
end)
