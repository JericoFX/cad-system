fx_version 'cerulean'
game 'gta5'

lua54 'yes'
use_experimental_fxv2_oal 'yes'

description 'C.A.D. Terminal System - Computer Aided Dispatch'
author 'CAD Team'
version '3.0.0'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
    'modules/shared.lua',
    'shared/catalogs/fines.lua',
    'shared/catalogs/codes.lua'
}

client_scripts {
    'client/core/qbox.lua',
    'client/core/qb.lua',
    'client/core/esx.lua',
    'client/core/standalone.lua',
    'client/core/init.lua',
    'client/main.lua',
    'client/functions.lua',
    'client/nui.lua',
    'client/ticket.lua',
    'client/evidence.lua',
    'client/forensic.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/core/qbox.lua',
    'server/core/qb.lua',
    'server/core/esx.lua',
    'server/core/standalone.lua',
    'server/core/init.lua',
    'server/functions.lua',
    'server/database.lua',
    'server/auth.lua',
    'server/cases.lua',
    'server/evidence.lua',
    'server/dispatch.lua',
    'server/fines.lua',
    'server/ems.lua',
    'server/forensic.lua',
    'server/id_reader.lua',
    'server/exports.lua',
    'server/main.lua'
}

files {
    'locales/*.json',
    'nui/build/index.html',
    'nui/build/assets/**/*'
}

ui_page 'nui/build/index.html'

dependencies {
    'ox_lib',
    'oxmysql'
}

exports {
    'CreateCase',
    'GetCase',
    'UpdateCase',
    'CloseCase',
    'SearchCases',
    
    'CreateEvidenceBag',
    'GetEvidenceById',
    'AttachEvidenceToCase',
    
    'GetForensicData',
    'AnalyzeEvidence',
    'IsPlayerInLab',
    'GetLabLocations',
    
    'CreateDispatchCall',
    'GetActiveCalls',
    'AssignUnit',
    'GetUnitStatus',
    'SetUnitStatus',
    
    'CheckPermission',
    'GetOfficerData'
}

server_exports {
    'CreateCase',
    'GetCase',
    'UpdateCase',
    'CloseCase',
    'SearchCases',
    
    'CreateEvidenceBag',
    'GetEvidenceById',
    'AttachEvidenceToCase',
    
    'GetForensicData',
    'AnalyzeEvidence',
    'IsPlayerInLab',
    'GetLabLocations',
    
    'CreateDispatchCall',
    'GetActiveCalls',
    'AssignUnit',
    'GetUnitStatus',
    'SetUnitStatus',
    
    'CheckPermission',
    'GetOfficerData'
}
