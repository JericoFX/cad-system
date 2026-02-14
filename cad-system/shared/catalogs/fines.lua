--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Catalogs = CAD.Catalogs or {}

CAD.Catalogs.Fines = {
    {
        code = 'T001',
        category = 'traffic',
        description = 'Speeding (10-20 over)',
        amount = 150,
        jailTime = 0,
    },
    {
        code = 'T002',
        category = 'traffic',
        description = 'Speeding (20+ over)',
        amount = 300,
        jailTime = 0,
    },
    {
        code = 'T008',
        category = 'traffic',
        description = 'DUI',
        amount = 5000,
        jailTime = 30,
    },
    {
        code = 'C001',
        category = 'criminal',
        description = 'Petty theft',
        amount = 2000,
        jailTime = 10,
    },
    {
        code = 'C003',
        category = 'criminal',
        description = 'Assault',
        amount = 1500,
        jailTime = 20,
    },
    {
        code = 'W001',
        category = 'weapons',
        description = 'Illegal weapon possession',
        amount = 3000,
        jailTime = 30,
    },
}

local function clone(value)
    if CAD.DeepCopy then
        return CAD.DeepCopy(value)
    end

    if type(value) ~= 'table' then
        return value
    end

    local out = {}
    for k, v in pairs(value) do
        out[k] = clone(v)
    end

    return out
end

function CAD.GetFineCatalog()
    return clone(CAD.Catalogs.Fines)
end
