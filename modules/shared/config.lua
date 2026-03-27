-- modules/shared/config.lua

local mediaService = string.lower(tostring(GetConvar('CAD_MEDIA_SERVICE', 'fivemanage')))
if mediaService == '' then
    mediaService = 'fivemanage'
end

local mediaApiKey = tostring(GetConvar('CAD_MEDIA_API_KEY', ''))
local mediaUploadUrl = tostring(GetConvar('CAD_MEDIA_UPLOAD_URL', ''))

local Config = {

    Profile = tostring(GetConvar('CAD_PROFILE', 'simple')):lower(),

    Debug = false,

    Framework = {
        Preferred = 'qb-core',
    },

    Features = {
        Dispatch = { Enabled = true, ShowInUI = true },
        EMS = { Enabled = true, ShowInUI = true },
        SecurityCameras = { Enabled = true, ShowInUI = true },
        Forensics = { Enabled = true, ShowInUI = true },
        News = { Enabled = true, ShowInUI = true },
        Map = { Enabled = true, ShowInUI = true },
        Radio = { Enabled = true, ShowInUI = true },
    },

    UI = {
        Command = 'cad',
        Keybind = 'F6',
        AccessMode = 'auto',
        AccessPoints = {
            {
                id = 'mrpd_frontdesk',
                label = 'MRPD Front Desk PC',
                coords = vector3(441.88, -981.92, 30.69),
                radius = 1.25,
                jobs = { 'police', 'sheriff', 'csi', 'dispatch', 'admin' },
                idReader = {
                    enabled = true,
                    stashId = 'cad_id_reader_mrpd_frontdesk',
                    label = 'MRPD ID Reader',
                    slots = 5,
                    weight = 2000,
                    readSlot = 1,
                    allowedItems = { 'id_card', 'driver_license', 'passport', 'weaponlicense' },
                },
                evidenceContainer = {
                    enabled = true,
                    stashId = 'cad_evidence_mrpd_frontdesk',
                    label = 'MRPD Forensics Locker',
                    slots = 200,
                    weight = 500000,
                    shared = true,
                },
            },
            {
                id = 'pillbox_ems_terminal',
                label = 'Pillbox EMS Terminal',
                coords = vector3(307.73, -595.2, 43.28),
                radius = 1.25,
                jobs = { 'ambulance', 'ems', 'admin' },
                idReader = { enabled = false },
                evidenceContainer = { enabled = false },
            },
            {
                id = 'sandy_so_frontdesk',
                label = 'Sandy Sheriff Office PC',
                coords = vector3(1855.74, 3687.66, 34.27),
                radius = 1.25,
                jobs = { 'police', 'sheriff', 'csi', 'dispatch', 'admin' },
                idReader = {
                    enabled = true,
                    stashId = 'cad_id_reader_sandy_so_frontdesk',
                    label = 'Sandy SO ID Reader',
                    slots = 5,
                    weight = 2000,
                    readSlot = 1,
                    allowedItems = { 'id_card', 'driver_license', 'passport', 'weaponlicense' },
                },
                evidenceContainer = {
                    enabled = true,
                    stashId = 'cad_evidence_sandy_so_frontdesk',
                    label = 'Sandy SO Forensics Locker',
                    slots = 200,
                    weight = 500000,
                    shared = true,
                },
            },
        },
    },

    Security = {
        AllowedJobs = {
            police = true, sheriff = true, csi = true,
            ambulance = true, ems = true, dispatch = true,
            reporter = true, weazelnews = true, admin = true,
        },
        AdminJobs = {
            admin = true, headadmin = true,
            policechief = true, emschief = true,
        },
        RateLimitPerMinute = { default = 80, heavy = 30 },
        Callsign = {
            RequireWhenEmpty = true,
            RequireWhenPrefix = { 'B-' },
        },
    },

    Cases = {
        DefaultStatus = 'OPEN',
        PublicState = { ClosedRetentionMinutes = 10, MaxCases = 300 },
        Types = {
            'GENERAL', 'THEFT', 'ASSAULT', 'HOMICIDE', 'ACCIDENT',
            'DRUGS', 'TRAFFIC', 'DISTURBANCE', 'SUSPICIOUS', 'MEDICAL',
        },
    },

    Dispatch = {
        Enabled = true,
        PositionBroadcastMs = 5000,
        UnitStaleSeconds = 300,
        PublicState = { ClosedRetentionMinutes = 10, MaxCalls = 250 },
        AllowEMSControl = true,
        CallTypeOptions = { 'GENERAL', '10-31', '10-50', '10-71', 'MEDICAL' },
    },

    SecurityCameras = {
        Enabled = true,
        MaxInstallDistance = 12.0,
        MinFov = 20.0,
        MaxFov = 90.0,
        DefaultFov = 55.0,
        RotationSpeed = 45.0,
        PitchMin = -80.0,
        PitchMax = 25.0,
        PlacementModel = 'prop_cctv_cam_01a',
        AllowedJobs = { police = true, sheriff = true, dispatch = true, admin = true },
    },

    Evidence = {
        MaxStagingPerOfficer = 60,
        StorageMode = 'state',
        UseVirtualContainer = true,
        VirtualContainerSlotCount = 200,
        TicketItemName = 'cad_ticket',
    },

    Fines = { AllowCustomCode = false },

    EMS = {
        AlertTTLSeconds = 1800,
        UnitStatuses = {
            AVAILABLE = true, EN_ROUTE = true, ON_SCENE = true,
            TRANSPORTING = true, AT_HOSPITAL = true, BUSY = true,
        },
    },

    News = { PublishWithoutConfirm = false },

    ForensicLabs = {
        Enabled = true,
        Locations = {
            {
                name = 'Mission Row Lab',
                coords = vector3(483.2, -988.3, 24.9),
                radius = 10.0,
                jobs = { 'police', 'sheriff', 'csi' },
            },
            {
                name = 'Pillbox Lab',
                coords = vector3(343.4, -1398.7, 32.5),
                radius = 10.0,
                jobs = { 'ambulance', 'ems' },
            },
        },
    },

    Forensics = {
        AutoCreateUnknownCase = true,
        UnknownPersonLabel = 'UNKNOWN',
        DefaultEvidenceItem = 'cad_evidence_item',
        WorldTraceTTLSeconds = 1800,
        WorldTraceMinIntervalMs = 750,
        WorldTraceDetectRadius = 18.0,
        WorldTraceInteractRadius = 1.8,
        WorldTraceVisibleJobs = { police = true, sheriff = true, csi = true },
        AllowAllIngestResources = false,
        AllowedIngestResources = {},
        BloodAnalysisDurationMs = 45000,
        BloodPostAnalysis = {
            mode = 'reminder',
            timeoutMs = 120000,
            reminderIntervalMs = 120000,
        },
        BloodSampleItemName = 'cad_blood_sample',
        BloodSampleStash = {
            enabled = true,
            stashId = 'cad_ems_blood_lab',
            label = 'EMS Blood Evidence Locker',
            slots = 200,
            weight = 500000,
        },
        BloodSampleContainer = {
            enabled = true,
            containerKey = 'forensics:cad_ems_blood_lab',
            slots = 200,
        },
        Toxicology = {
            Enabled = true,
            MetadataKey = 'cad_toxicology',
            StateBagKey = 'cad_toxicology',
            DefaultWindowMs = 1800000,
            TrackedItems = {
                weed_joint = { substance = 'THC', windowMs = 1800000, severity = 'LOW' },
                cocaine_baggy = { substance = 'COCAINE', windowMs = 2700000, severity = 'HIGH' },
                meth_baggy = { substance = 'METHAMPHETAMINE', windowMs = 3600000, severity = 'HIGH' },
                heroin_baggy = { substance = 'OPIOID', windowMs = 3600000, severity = 'HIGH' },
                mdma_tablet = { substance = 'MDMA', windowMs = 2400000, severity = 'MEDIUM' },
            },
        },
        IdReader = {
            Enabled = true,
            UseVirtualContainer = true,
            ReaderModel = 'hei_prop_hei_securitypanel',
            ReaderModelFallback = 'prop_ld_keypad_01',
            CardModel = 'prop_cs_swipe_card',
            InteractionDistance = 1.6,
            SlotCount = 5,
            ReadSlot = 1,
            StrictAllowedItems = false,
            VehicleTablet = {
                Enabled = true,
                RequireFrontSeat = true,
                Slots = 2,
                ReadSlot = 1,
                QuickDockEnabled = true,
                QuickDockLockKey = 'K',
                QuickDockToggleKey = 'U',
                StrictAllowedItems = false,
                AllowedJobs = { 'police', 'sheriff' },
                PoliceModels = {},
                DataSource = {
                    PlayersTable = 'players',
                    PlayersCitizenColumn = 'citizenid',
                    PlayersCharinfoColumn = 'charinfo',
                    PlayersMetadataColumn = 'metadata',
                    PlayerVehiclesTable = 'player_vehicles',
                    PlayerVehiclesPlateColumn = 'plate',
                    PlayerVehiclesOwnerColumn = 'citizenid',
                    PlayerVehiclesDataColumn = 'vehicle',
                },
                AllowedItems = {
                    'id_card', 'driver_license', 'passport',
                    'vehicle_registration', 'vehicle_registration_card',
                },
            },
        },
        VirtualContainer = { Persistence = true },
    },

    PhotoSystem = {
        Provider = 'screenshot-basic',
        Upload = {
            MethodByType = {
                image = 'server_proxy',
                video = 'medal',
                audio = 'fivemanage',
            },
            Service = mediaService,
        },
        UploadAPI = {
            Type = mediaService,
            FiveManage = {
                FormEndpoint = 'https://api.fivemanage.com/api/v3/file',
                Base64Endpoint = 'https://api.fivemanage.com/api/v3/file/base64',
                FieldName = 'file',
                ApiKey = mediaApiKey ~= '' and mediaApiKey or GetConvar('CAD_FIVEMANAGE_API_KEY', ''),
                UseApiKeyQueryForClientDirect = false,
                ApiKeyQueryParam = 'apiKey',
                FilenamePrefix = 'cad_capture',
                Path = 'cad/photos',
            },
            Discord = {
                Webhook = GetConvar('CAD_DISCORD_WEBHOOK', ''),
                FieldName = 'files[]',
            },
            Medal = {
                UploadUrl = mediaUploadUrl ~= '' and mediaUploadUrl or GetConvar('CAD_MEDAL_UPLOAD_URL', ''),
                FieldName = 'file',
                AuthHeader = 'Authorization',
                ApiKey = mediaApiKey ~= '' and mediaApiKey or GetConvar('CAD_MEDAL_API_KEY', ''),
                UseApiKeyQueryForClientDirect = false,
                ApiKeyQueryParam = 'apiKey',
            },
            Custom = {
                Endpoint = mediaUploadUrl,
                FieldName = 'file',
                Headers = {},
                AuthHeader = 'Authorization',
                ApiKey = mediaApiKey,
                UseApiKeyQueryForClientDirect = false,
                ApiKeyQueryParam = 'apiKey',
            },
        },
        ReleaseRanks = { police = 3, sheriff = 3 },
        FOV = {
            MaxDistance = 50.0,
            ShowMarker = true,
            MarkerSize = 0.1,
            RecordEntityInfo = true,
        },
        Animations = { Scenario = 'WORLD_HUMAN_PAPARAZZI', Duration = 2000 },
        MaxPhotosPerPlayer = 100,
        AutoDeleteLocal = true,
        RetentionDays = 30,
    },

    PhotoItems = {
        ['police_camera'] = {
            label = 'Evidence Camera',
            weight = 500,
            stack = false,
            close = true,
            description = 'Official evidence camera with GPS and FOV tracking',
            client = { export = 'cad-system.usePoliceCamera' },
            jobs = { 'police', 'sheriff', 'admin' },
        },
        ['news_camera'] = {
            label = 'Press Camera',
            weight = 300,
            stack = false,
            close = true,
            description = 'Professional camera for news coverage',
            client = { export = 'cad-system.useNewsCamera' },
            jobs = { 'reporter', 'weazelnews', 'admin' },
        },
        ['police_camera_photo'] = {
            label = 'Evidence Photo',
            weight = 0,
            stack = false,
            close = true,
            description = 'Developed evidence photograph with metadata',
            client = { export = 'cad-system.viewPhotoItem' },
        },
        ['news_camera_photo'] = {
            label = 'Press Photo',
            weight = 0,
            stack = false,
            close = true,
            description = 'News photograph ready for publication',
            client = { export = 'cad-system.viewPhotoItem' },
        },
    },
}

-- Profile application

local function applyFeatureFlags(overrides)
    if type(overrides) ~= 'table' then return end
    Config.Features = Config.Features or {}
    for featureName, override in pairs(overrides) do
        if type(override) == 'table' then
            local current = Config.Features[featureName] or {}
            if override.Enabled ~= nil then current.Enabled = override.Enabled == true end
            if override.ShowInUI ~= nil then current.ShowInUI = override.ShowInUI == true end
            Config.Features[featureName] = current
        end
    end
end

local function applySimpleProfile()
    applyFeatureFlags({
        Dispatch = { Enabled = false, ShowInUI = false },
        SecurityCameras = { Enabled = false, ShowInUI = false },
        Forensics = { Enabled = false, ShowInUI = false },
        EMS = { Enabled = true, ShowInUI = true },
        News = { Enabled = true, ShowInUI = true },
        Map = { Enabled = true, ShowInUI = true },
        Radio = { Enabled = false, ShowInUI = false },
    })
    Config.Dispatch.Enabled = false
    Config.SecurityCameras.Enabled = false
    Config.ForensicLabs.Enabled = false
    Config.Evidence.StorageMode = 'state'
    Config.Evidence.UseVirtualContainer = true
    Config.News = Config.News or {}
    Config.News.PublishWithoutConfirm = true
end

local function applyProfile()
    local profile = tostring(Config.Profile or 'simple'):lower()
    if profile == 'simple' then
        applySimpleProfile()
        return
    end
    if profile == 'full' then return end
    if profile == 'custom' then
        Config.Evidence.StorageMode = Config.Evidence.StorageMode or 'state'
        return
    end
    Config.Profile = 'simple'
    applySimpleProfile()
end

applyProfile()

-- Feature flag helpers

local function getFeatureTable(featureName)
    local features = Config.Features
    if type(features) ~= 'table' then return {} end
    local name = tostring(featureName or '')
    if name == '' then return {} end
    return features[name] or {}
end

function Config.IsFeatureEnabled(featureName)
    local feature = getFeatureTable(featureName)
    if feature.Enabled == nil then return true end
    return feature.Enabled == true
end

function Config.IsFeatureVisibleInUI(featureName)
    local feature = getFeatureTable(featureName)
    if feature.ShowInUI == nil then return Config.IsFeatureEnabled(featureName) end
    return feature.ShowInUI == true
end

return Config
