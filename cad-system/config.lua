

CAD = CAD or {}

local mediaService = string.lower(tostring(GetConvar('CAD_MEDIA_SERVICE', 'fivemanage')))
if mediaService == '' then
    mediaService = 'fivemanage'
end

local mediaApiKey = tostring(GetConvar('CAD_MEDIA_API_KEY', ''))
local mediaUploadUrl = tostring(GetConvar('CAD_MEDIA_UPLOAD_URL', ''))

CAD.Config = {
    -- Global debug toggle for developer-only helpers and test commands.
    Debug = false,

    -- Framework adapter used by identity/job resolution.
    Framework = {
        Preferred = 'qb-core',
    },

    -- Module toggles. Enabled controls backend logic, ShowInUI controls visibility in NUI.
    Features = {
        Dispatch = {
            Enabled = true,
            ShowInUI = true,
        },
        SecurityCameras = {
            Enabled = true,
            ShowInUI = true,
        },
        Forensics = {
            Enabled = true,
            ShowInUI = true,
        },
        News = {
            Enabled = true,
            ShowInUI = true,
        },
    },

    -- CAD terminal access settings and fixed world terminals.
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
                    allowedItems = {
                        'id_card',
                        'driver_license',
                        'passport',
                        'weaponlicense',
                    },
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
                idReader = {
                    enabled = false,
                },
                evidenceContainer = {
                    enabled = false,
                },
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
                    allowedItems = {
                        'id_card',
                        'driver_license',
                        'passport',
                        'weaponlicense',
                    },
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

    -- Permission matrix and callback rate limits.
    Security = {

        AllowedJobs = {
            police = true,
            sheriff = true,
            csi = true,
            ambulance = true,
            ems = true,
            dispatch = true,
            admin = true,
        },
        AdminJobs = {
            admin = true,
            headadmin = true,
            policechief = true,
            emschief = true,
        },
        RateLimitPerMinute = {

            default = 80,
            heavy = 30,
        },
        Callsign = {
            RequireWhenEmpty = true,
            RequireWhenPrefix = { 'B-' },
        },
    },

    -- Case defaults and case list retention in replicated public state.
    Cases = {

        DefaultStatus = 'OPEN',
        PublicState = {
            ClosedRetentionMinutes = 10,
            MaxCases = 300,
        },
        Types = {
            'GENERAL',
            'THEFT',
            'ASSAULT',
            'HOMICIDE',
            'ACCIDENT',
            'DRUGS',
            'TRAFFIC',
            'DISTURBANCE',
            'SUSPICIOUS',
            'MEDICAL',
        },
    },

    -- Dispatch board behavior, SLA timings, and auto-assignment tuning.
    Dispatch = {
        Enabled = true,

        PositionBroadcastMs = 5000,
        UnitStaleSeconds = 300,

        PublicState = {
            CellSizeMeters = 200,
            ClosedRetentionMinutes = 10,
            MaxCalls = 250,
        },

        AllowEMSControl = true,

        Easy = {
            Preset = 'standard',
            Presets = {
                relaxed = {
                    refreshIntervalMs = 10000,
                    clockTickMs = 20000,
                    pendingWarningMinutes = 6,
                    pendingBreachMinutes = 12,
                    activeWarningMinutes = 14,
                    activeBreachMinutes = 25,
                    autoAssignEnabled = true,
                },
                standard = {
                    refreshIntervalMs = 8000,
                    clockTickMs = 15000,
                    pendingWarningMinutes = 4,
                    pendingBreachMinutes = 8,
                    activeWarningMinutes = 10,
                    activeBreachMinutes = 20,
                    autoAssignEnabled = true,
                },
                strict = {
                    refreshIntervalMs = 6000,
                    clockTickMs = 10000,
                    pendingWarningMinutes = 2,
                    pendingBreachMinutes = 5,
                    activeWarningMinutes = 8,
                    activeBreachMinutes = 15,
                    autoAssignEnabled = true,
                },
            },
        },

        RefreshIntervalMs = 8000,
        ClockTickMs = 15000,

        CallTypeOptions = {
            'GENERAL',
            '10-31',
            '10-50',
            '10-71',
            'MEDICAL',
        },
        SLA = {

            Enabled = true,
            Pending = {
                WarningMinutes = {
                    p1 = 2,
                    p2 = 4,
                    p3 = 6,
                    default = 6,
                },
                BreachMinutes = {
                    p1 = 4,
                    p2 = 8,
                    p3 = 12,
                    default = 12,
                },
            },
            Active = {
                WarningMinutes = {
                    p1 = 8,
                    p2 = 10,
                    p3 = 12,
                    default = 12,
                },
                BreachMinutes = {
                    p1 = 15,
                    p2 = 20,
                    p3 = 25,
                    default = 25,
                },
            },
        },
        AutoAssignment = {

            Enabled = true,
            DistanceMetersPerPenaltyPoint = 70,
            UnknownDistancePenalty = 15,
            ServicePenalties = {
                NeedsEmsButNotEms = 40,
                NonMedicalEms = 25,
            },
        },
    },

    -- In-world CCTV settings used by the security camera module.
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
        AllowedJobs = {
            police = true,
            sheriff = true,
            dispatch = true,
            admin = true,
        },
    },

    -- Evidence staging and locker behavior.
    Evidence = {

        MaxStagingPerOfficer = 60,

        UseVirtualContainer = true,
        VirtualContainerSlotCount = 200,

        TicketItemName = 'cad_ticket',
    },

    -- Fine/ticket policy.
    Fines = {

        AllowCustomCode = false,
    },

    -- EMS dashboard and alert lifecycle.
    EMS = {

        AlertTTLSeconds = 1800,
        UnitStatuses = {
            AVAILABLE = true,
            EN_ROUTE = true,
            ON_SCENE = true,
            TRANSPORTING = true,
            AT_HOSPITAL = true,
            BUSY = true,
        },
    },

    -- Physical lab locations and job access.
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

    -- Forensic subsystem configuration: traces, blood workflow, toxicology, and readers.
    Forensics = {

        AutoCreateUnknownCase = true,
        UnknownPersonLabel = 'UNKNOWN',
        DefaultEvidenceItem = 'cad_evidence_item',
        WorldTraceTTLSeconds = 1800,
        WorldTraceMinIntervalMs = 750,
        WorldTraceDetectRadius = 18.0,
        WorldTraceInteractRadius = 1.8,
        WorldTraceVisibleJobs = {
            police = true,
            sheriff = true,
            csi = true,
        },
        AllowAllIngestResources = true,
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
        -- Toxicology windows are inferred from ox_inventory item usage.
        -- Data is stored on QBCore player metadata and copied into blood evidence snapshot.
        Toxicology = {
            -- Master toggle for metadata/statebag toxicology tracking.
            Enabled = true,
            -- Key inside PlayerData.metadata where active toxicology windows are stored.
            MetadataKey = 'cad_toxicology',
            -- Replicated player statebag key with current active toxicology summary.
            StateBagKey = 'cad_toxicology',
            -- Fallback duration when a tracked item does not define windowMs.
            DefaultWindowMs = 1800000,
            -- Map of item name -> toxicology profile.
            -- item key: exact ox_inventory item name
            -- substance: label shown in blood snapshot
            -- windowMs: how long it can be detected
            -- severity: LOW | MEDIUM | HIGH | CRITICAL
            TrackedItems = {
                weed_joint = {
                    substance = 'THC',
                    windowMs = 1800000,
                    severity = 'LOW',
                },
                cocaine_baggy = {
                    substance = 'COCAINE',
                    windowMs = 2700000,
                    severity = 'HIGH',
                },
                meth_baggy = {
                    substance = 'METHAMPHETAMINE',
                    windowMs = 3600000,
                    severity = 'HIGH',
                },
                heroin_baggy = {
                    substance = 'OPIOID',
                    windowMs = 3600000,
                    severity = 'HIGH',
                },
                mdma_tablet = {
                    substance = 'MDMA',
                    windowMs = 2400000,
                    severity = 'MEDIUM',
                },
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
                    'id_card',
                    'driver_license',
                    'passport',
                    'vehicle_registration',
                    'vehicle_registration_card',
                },
            },
        },
        VirtualContainer = {
            Persistence = true,
        },
    },

    -- Photo capture/upload providers and media item definitions.
    PhotoSystem = {

        Provider = 'screenshot-basic',

        -- Upload routing by media type.
        -- image is used by CAD camera captures right now.
        Upload = {
            MethodByType = {
                image = 'server_proxy', -- server_proxy | client_direct
                video = 'medal',
                audio = 'fivemanage',
            },
            Service = mediaService, -- fivemanage | discord | medal | custom
        },

        UploadAPI = {

            -- Backward-compatible selector used as fallback when Upload.Service is not set.
            Type = mediaService,

            -- Recommended for CAD evidence uploads.
            -- With image = server_proxy, the API key stays server-side only.
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

            -- Direct upload target for screenshot-basic client uploads.
            Discord = {
                Webhook = GetConvar('CAD_DISCORD_WEBHOOK', ''),
                FieldName = 'files[]',
            },

            -- Medal upload target (set endpoint/key if your Medal pipeline requires it).
            Medal = {
                UploadUrl = mediaUploadUrl ~= '' and mediaUploadUrl or GetConvar('CAD_MEDAL_UPLOAD_URL', ''),
                FieldName = 'file',
                AuthHeader = 'Authorization',
                ApiKey = mediaApiKey ~= '' and mediaApiKey or GetConvar('CAD_MEDAL_API_KEY', ''),
                UseApiKeyQueryForClientDirect = false,
                ApiKeyQueryParam = 'apiKey',
            },

            -- Generic endpoint fallback for custom media services.
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

        ReleaseRanks = {
            police = 3,
            sheriff = 3,
        },

        FOV = {

            MaxDistance = 50.0,

            ShowMarker = true,

            MarkerSize = 0.1,

            RecordEntityInfo = true,
        },

        Animations = {

            Scenario = 'WORLD_HUMAN_PAPARAZZI',

            Duration = 2000,
        },

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

            client = {
                export = 'cad-system.usePoliceCamera'
            },

            jobs = { 'police', 'sheriff', 'admin' },
        },

        ['news_camera'] = {
            label = 'Press Camera',
            weight = 300,
            stack = false,
            close = true,
            description = 'Professional camera for news coverage',
            client = {
                export = 'cad-system.useNewsCamera'
            },
            jobs = { 'reporter', 'weazelnews', 'admin' },
        },

        ['police_camera_photo'] = {
            label = 'Evidence Photo',
            weight = 0,
            stack = false,
            close = true,
            description = 'Developed evidence photograph with metadata',

            client = {
                export = 'cad-system.viewPhotoItem'
            },
        },

        ['news_camera_photo'] = {
            label = 'Press Photo',
            weight = 0,
            stack = false,
            close = true,
            description = 'News photograph ready for publication',
            client = {
                export = 'cad-system.viewPhotoItem'
            },
        },
    },
}

CAD.State = CAD.State or {
    Cases = {},
    Dispatch = {
        Units = {},
        Calls = {},
    },
    SecurityCameras = {
        Cameras = {},
        LastNumber = 0,
    },
    Evidence = {
        Staging = {},
    },
    Fines = {},
    EMS = {
        Alerts = {},
        Units = {},
        BloodRequests = {},
    },
    Police = {
        JailTransfers = {},
    },
    OfficerStatus = {},
    Forensics = {
        LockerItems = {},
        WorldTraces = {},
        IdReaders = {},
        VirtualContainers = {},
        VirtualContainerLocks = {},
    },
    News = {
        Articles = {},
    },
    Photos = {
        Photos = {},
        Staging = {},
        ReviewQueue = {},
        ReleasedPhotos = {},
        LastId = 0,
    },
}

function CAD.Log(level, message, ...)
    local formatted = string.format(message or '', ...)
    if level == 'debug' and not CAD.Config.Debug then
        return
    end

    local color = '^7'
    if level == 'error' then color = '^1' end
    if level == 'warn' then color = '^3' end
    if level == 'success' then color = '^2' end
    if level == 'debug' then color = '^5' end

    print(('%s[CAD:%s]^7 %s'):format(color, string.upper(level or 'info'), formatted))
end
