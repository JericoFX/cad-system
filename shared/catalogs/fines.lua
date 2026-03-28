local FineCatalog = {
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

---@return table[]
function FineCatalog.Get()
    return lib.table.deepclone(FineCatalog)
end

return FineCatalog
