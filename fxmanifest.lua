

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

    'client/shared functions.lua',

    'client/app/main.lua',
    'client/app/nui.lua',

    'client/actions/ticket.lua',
    'client/actions/evidence.lua',
    'client/actions/photos.lua',
    'client/actions/id_search.lua',

    'client/actions/forensics/index.lua',
    'client/actions/forensics/blood.lua',
    'client/actions/forensics/fingerprint.lua',
    'client/actions/forensics/casing.lua',
    'client/actions/forensics/tools.lua',
    'client/actions/forensics/camera.lua',
    'client/actions/forensics/target.lua',

    'client/actions/security_cameras.lua',
    'client/actions/vehicle_cad.lua',

    'client/shared/sounds.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/core/qb.lua',
    'server/core/init.lua',
    'server/infra/functions.lua',
    'server/infra/database.lua',
    'server/auth/officers.lua',
    'server/auth/auth.lua',
    'server/actions/virtual_container.lua',
    'server/actions/cases.lua',
    'server/actions/evidence.lua',
    'server/actions/photos.lua',
    'server/actions/news.lua',
    'server/actions/dispatch.lua',
    'server/actions/security_cameras.lua',
    'server/actions/police.lua',
    'server/actions/fines.lua',
    'server/actions/ems.lua',
    'server/actions/forensics/index.lua',
    'server/actions/forensics/toxicology.lua',
    'server/actions/forensics/sync.lua',
    'server/actions/forensics/decay.lua',
    'server/actions/id_reader.lua',
    'server/actions/vehicle_tablet.lua',
    'addons/gcphone.lua',
    'server/actions/phone_lookup.lua',
    'server/infra/exports.lua',
    'server/infra/main.lua'
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
