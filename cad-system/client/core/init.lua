--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}
CAD.Core = CAD.Core or {}
CAD.Core.Client = CAD.Core.Client or {}

local providerName

local function detectProvider()
    if providerName then
        return providerName
    end

    local preferred = CAD.Config.Framework.Preferred or 'auto'

    if preferred == 'qbox' and CAD.Core.Client.QBox.IsAvailable() then
        providerName = 'qbox'
        return providerName
    end

    if preferred == 'qb-core' and CAD.Core.Client.QB.IsAvailable() then
        providerName = 'qb-core'
        return providerName
    end

    if preferred == 'esx' and CAD.Core.Client.ESX.IsAvailable() then
        providerName = 'esx'
        return providerName
    end

    if preferred == 'standalone' then
        providerName = 'standalone'
        return providerName
    end

    if CAD.Core.Client.QBox.IsAvailable() then
        providerName = 'qbox'
        return providerName
    end

    if CAD.Core.Client.QB.IsAvailable() then
        providerName = 'qb-core'
        return providerName
    end

    if CAD.Core.Client.ESX.IsAvailable() then
        providerName = 'esx'
        return providerName
    end

    providerName = 'standalone'
    return providerName
end

function CAD.Core.Client.GetFramework()
    return detectProvider()
end

function CAD.Core.Client.RegisterAccessEvents(refreshAccess)
    local framework = detectProvider()

    if framework == 'qbox' then
        CAD.Core.Client.QBox.RegisterAccessEvents(refreshAccess)
        CAD.Core.Client.ESX.RegisterAccessEvents(refreshAccess)
        CAD.Core.Client.Standalone.RegisterAccessEvents(refreshAccess)
        return
    end

    if framework == 'qb-core' then
        CAD.Core.Client.QB.RegisterAccessEvents(refreshAccess)
        CAD.Core.Client.ESX.RegisterAccessEvents(refreshAccess)
        CAD.Core.Client.Standalone.RegisterAccessEvents(refreshAccess)
        return
    end

    if framework == 'esx' then
        CAD.Core.Client.ESX.RegisterAccessEvents(refreshAccess)
        CAD.Core.Client.QB.RegisterAccessEvents(refreshAccess)
        CAD.Core.Client.Standalone.RegisterAccessEvents(refreshAccess)
        return
    end

    CAD.Core.Client.Standalone.RegisterAccessEvents(refreshAccess)
end
