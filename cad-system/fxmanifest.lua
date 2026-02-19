

fx_version 'cerulean'
game 'gta5'

lua54 'yes'
use_experimental_fxv2_oal 'yes'

description 'C.A.D. Terminal System - Computer Aided Dispatch'
author 'JericoFX'
version '1.0.0'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
    'modules/shared.lua',
    'shared/evidence_types.lua',
    'shared/catalogs/fines.lua',
    'shared/catalogs/codes.lua'
}

client_scripts {
    'client/core/qb.lua',
    'client/core/init.lua',

    'client/functions.lua',

    'client/main.lua',
    'client/nui.lua',

    'client/ticket.lua',
    'client/evidence.lua',
    'client/photos.lua',

    'client/forensic.lua',
    'client/forensic/blood.lua',
    'client/forensic/fingerprint.lua',
    'client/forensic/casing.lua',
    'client/forensic/tools.lua',
    'client/forensic/camera.lua',
    'client/forensic/target.lua',

    'client/security_cameras.lua',
    'client/vehicle_cad.lua',

    'client/sounds.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/core/qb.lua',
    'server/core/init.lua',
    'server/functions.lua',
    'server/database.lua',
    'server/officers.lua',
    'server/auth.lua',
    'server/virtual_container.lua',
    'server/cases.lua',
    'server/evidence.lua',
    'server/photos.lua',
    'server/news.lua',
    'server/dispatch.lua',
    'server/security_cameras.lua',
    'server/police.lua',
    'server/fines.lua',
    'server/ems.lua',
    'server/forensic.lua',
    'server/forensic/toxicology.lua',
    'server/forensic/sync.lua',
    'server/forensic/decay.lua',
    'server/id_reader.lua',
    'server/vehicle_tablet.lua',
    'server/exports.lua',
    'server/main.lua'
}

files {
    'locales/*.json',
    'nui/build/index.html',
    'nui/build/*.js',
    'nui/build/*.css'
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
    'GetOfficerData',
    'LogJailTransfer',
    'GetJailTransfers',

    'PlayPTTStart',
    'PlayPTTEnd',
    'PlayDispatchIncoming',
    'PlayEmergencyAlert',
    'PlaySuccess',
    'PlayError'
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
    'GetOfficerData',
    'LogJailTransfer',
    'GetJailTransfers'
}
