-- inicialmente iba a tener mas cores pero ta, da paja -- maybe later i will add support for others frameworks.

CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Client = CAD.Core.Client or {}

function CAD.Core.Client.GetFramework()
    return 'qb-core'
end

function CAD.Core.Client.RegisterAccessEvents(refreshAccess)
    if CAD.Core.Client.QB and CAD.Core.Client.QB.RegisterAccessEvents then
        CAD.Core.Client.QB.RegisterAccessEvents(refreshAccess)
    end
end
