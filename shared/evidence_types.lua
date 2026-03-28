local EvidenceTypes = {}

---@type string[]
local BLOOD_TYPES = {
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
}

---@type table<string, table>
local EVIDENCE_TYPES = {
    blood = {
        id = 'blood',
        label = 'Blood',
        icon = 'fa-droplet',
        collectItem = 'collected_blood',
        requiredTool = 'forensic_kit',
        generation = {
            minDamage = 5,
            chance = 1.0,
            requireCrimeContext = true,
        },
        decay = {
            visibilityHalfLife = 1800,
            qualityHalfLife = 2400,
            rainDestroySeconds = 600,
        },
        visualization = {
            decalType = 1010,
        },
    },
    fingerprint = {
        id = 'fingerprint',
        label = 'Fingerprint',
        icon = 'fa-fingerprint',
        collectItem = 'collected_fingerprint',
        requiredTool = 'fingerprint_tape',
        revealTool = 'fingerprint_powder',
        generation = {
            chance = 0.85,
            requireCrimeContext = true,
        },
        decay = {
            visibilityHalfLife = 2700,
            qualityHalfLife = 3600,
            rainDestroySeconds = 0,
        },
        visualization = {
            decalType = 0,
        },
    },
    casing = {
        id = 'casing',
        label = 'Casing',
        icon = 'fa-gun',
        collectItem = 'collected_casing',
        requiredTool = 'forensic_kit',
        generation = {
            chance = 0.9,
            requireCrimeContext = true,
        },
        decay = {
            visibilityHalfLife = 3600,
            qualityHalfLife = 4800,
            rainDestroySeconds = 0,
        },
        visualization = {
            decalType = 0,
        },
    },
}

---@type table<string, string>
local TYPE_ALIASES = {
    BLOOD = 'blood',
    FINGERPRINT = 'fingerprint',
    FINGERPRINTS = 'fingerprint',
    CASING = 'casing',
    CASINGS = 'casing',
}

---@type table<string, table>
local TOOLS = {
    forensic_kit = {
        label = 'Forensic Kit',
        collects = { 'blood', 'casing' },
    },
    fingerprint_tape = {
        label = 'Fingerprint Tape',
        collects = { 'fingerprint' },
    },
    fingerprint_powder = {
        label = 'Fingerprint Powder',
        reveals = { 'fingerprint' },
    },
    uv_flashlight = {
        label = 'UV Light',
        reveals = { 'blood' },
    },
    hydrogen_peroxide = {
        label = 'Hydrogen Peroxide',
        destroys = { 'blood' },
    },
    camera = {
        label = 'Evidence Camera',
    },
}

---@param value any
---@return string|nil
local function normalizeTypeName(value)
    if type(value) ~= 'string' then
        return nil
    end

    local compact = value:gsub('%s+', '')
    if compact == '' then
        return nil
    end

    local lower = compact:lower()
    if EVIDENCE_TYPES[lower] then
        return lower
    end

    local alias = TYPE_ALIASES[compact:upper()]
    if alias and EVIDENCE_TYPES[alias] then
        return alias
    end

    return nil
end

---@param value any
---@return string|nil
local function normalizeToolName(value)
    if type(value) ~= 'string' then
        return nil
    end

    local compact = value:gsub('%s+', '')
    if compact == '' then
        return nil
    end

    return compact:lower()
end

---@param evidenceType string
---@return table|nil
function EvidenceTypes.GetType(evidenceType)
    local key = normalizeTypeName(evidenceType)
    if not key then
        return nil
    end

    return EVIDENCE_TYPES[key]
end

---@return table<string, table>
function EvidenceTypes.GetAllTypes()
    return EVIDENCE_TYPES
end

---@param toolName string
---@return table|nil
function EvidenceTypes.GetTool(toolName)
    local key = normalizeToolName(toolName)
    if not key then
        return nil
    end

    return TOOLS[key]
end

---@return string
function EvidenceTypes.GetRandomBloodType()
    return BLOOD_TYPES[math.random(1, #BLOOD_TYPES)]
end

---@param toolName string
---@param evidenceType string
---@return boolean
function EvidenceTypes.ToolCanCollect(toolName, evidenceType)
    local tool = EvidenceTypes.GetTool(toolName)
    local normalized = normalizeTypeName(evidenceType)
    if not tool or not normalized then
        return false
    end

    local collects = tool.collects or {}
    for _, v in ipairs(collects) do
        if v == normalized then
            return true
        end
    end
    return false
end

---@param toolName string
---@param evidenceType string
---@return boolean
function EvidenceTypes.ToolCanReveal(toolName, evidenceType)
    local tool = EvidenceTypes.GetTool(toolName)
    local normalized = normalizeTypeName(evidenceType)
    if not tool or not normalized then
        return false
    end

    local reveals = tool.reveals or {}
    for _, v in ipairs(reveals) do
        if v == normalized then
            return true
        end
    end
    return false
end

return EvidenceTypes
