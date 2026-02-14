--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

CAD = CAD or {}

CAD.Config = {
    Debug = false,

    -- Framework adapter selection.
    -- Use 'auto' for mixed/shared setups.
    -- Force a value only if your server is single-framework.
    Framework = {
        Preferred = 'auto', -- auto | qbox | qb-core | esx | standalone
    },

    -- Feature toggles for backend + UI.
    -- Set Enabled = false to fully disable a module.
    -- Set ShowInUI = false to keep backend callbacks available but hide UI entry points.
    Features = {
        Dispatch = {
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

    UI = {
        -- Command and keybind are always available for allowed jobs.
        Command = 'cad',
        Keybind = 'F6',

        -- Access mode for in-world terminals.
        -- auto: uses ox_target when available, otherwise fallback zone prompts.
        AccessMode = 'auto', -- auto | zone | target

        -- Each access point can enable ID reader and evidence container independently.
        -- Copy one block and change coords/jobs to add more terminals.
        AccessPoints = {
            {
                id = 'mrpd_frontdesk',
                label = 'MRPD Front Desk PC',
                coords = vector3(441.88, -981.92, 30.69),
                radius = 1.25,
                jobs = { 'police', 'sheriff', 'dispatch', 'admin' },
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
                jobs = { 'police', 'sheriff', 'dispatch', 'admin' },
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

    Security = {
        -- AllowedJobs controls who can open and use CAD callbacks.
        -- AdminJobs bypasses most role restrictions for moderation/supervision.
        AllowedJobs = {
            police = true,
            sheriff = true,
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
            -- default: regular callbacks
            -- heavy: expensive callbacks (searches, large payloads)
            default = 80,
            heavy = 30,
        },
    },

    Cases = {
        -- Default values for new cases.
        DefaultStatus = 'OPEN',
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

    Dispatch = {
        Enabled = true,
        -- Player location sync and stale timeout for unit board.
        PositionBroadcastMs = 5000,
        UnitStaleSeconds = 300,

        -- If true, EMS can use dispatch controls (assign/release/manage calls).
        AllowEMSControl = true,

        -- Quick setup: choose one profile and leave the rest as-is.
        Easy = {
            Preset = 'standard', -- relaxed | standard | strict
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

        -- Optional advanced overrides.
        -- Leave defaults unless you want custom timings/scoring.
        RefreshIntervalMs = 8000,
        ClockTickMs = 15000,

        -- Call types shown in the incident creator dropdown.
        CallTypeOptions = {
            'GENERAL',
            '10-31',
            '10-50',
            '10-71',
            'MEDICAL',
        },
        SLA = {
            -- SLA thresholds by priority (p1 highest, p3 lowest).
            -- warning: highlighted
            -- breach: escalated visual state
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
            -- Scoring values used by the "Auto Assign Best" button.
            -- Lower score = better unit suggestion.
            Enabled = true,
            DistanceMetersPerPenaltyPoint = 70,
            UnknownDistancePenalty = 15,
            ServicePenalties = {
                NeedsEmsButNotEms = 40,
                NonMedicalEms = 25,
            },
        },
    },

    Evidence = {
        -- Max temporary staging items per officer in current session.
        MaxStagingPerOfficer = 60,

        -- Fine ticket inventory item name (ox_inventory).
        TicketItemName = 'cad_ticket',
    },

    Fines = {
        -- Fine definitions are loaded from shared/catalogs/fines.lua.
        AllowCustomCode = false,
    },

    EMS = {
        -- How long EMS alerts stay valid before cleanup policies remove them.
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

    ForensicLabs = {
        -- Lab area list used by lab checks and related UI.
        Enabled = true,
        Locations = {
            {
                name = 'Mission Row Lab',
                coords = vector3(483.2, -988.3, 24.9),
                radius = 10.0,
                jobs = { 'police', 'sheriff' },
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
        -- Evidence ingestion and analysis configuration.
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
            -- What happens after analysis is ready but not sent by EMS.
            -- disabled: no automation
            -- reminder: notify EMS at interval
            -- auto_send: transfer automatically after timeout
            mode = 'reminder', -- disabled | reminder | auto_send
            timeoutMs = 120000,
            reminderIntervalMs = 120000,
        },

        -- Temporary sample item used during EMS blood processing.
        BloodSampleItemName = 'cad_blood_sample',
        BloodSampleStash = {
            enabled = true,
            stashId = 'cad_ems_blood_lab',
            label = 'EMS Blood Evidence Locker',
            slots = 200,
            weight = 500000,
        },
        IdReader = {
            -- If true, only allowedItems from each terminal reader are accepted.
            StrictAllowedItems = false,
        },
    },

    --[[
    Photo System Configuration
    Camera items for evidence collection and news reporting
    ]]
    PhotoSystem = {
        -- Active provider: 'screenshot-basic' (default) or 'cad-upload'
        Provider = 'screenshot-basic',
        
        -- Upload API Configuration (for cad-upload provider)
        UploadAPI = {
            -- Provider type: 'discord', 'imgur', 'custom'
            Type = 'discord',
            
            -- Discord webhook URL (for Discord uploads)
            DiscordWebhook = GetConvar('CAD_DISCORD_WEBHOOK', ''),
            
            -- Imgur Client ID (for Imgur uploads)
            ImgurClientId = GetConvar('CAD_IMGUR_CLIENT_ID', ''),
            
            -- Custom API endpoint (if Type = 'custom')
            CustomEndpoint = '',
            CustomHeaders = {},
        },
        
        -- Minimum rank required to release photos to press
        -- Uses job grade number (3 = Sargento+)
        ReleaseRanks = {
            police = 3,
            sheriff = 3,
        },
        
        -- FOV (Field of View) Settings
        FOV = {
            -- Maximum raycast distance in meters
            MaxDistance = 50.0,
            
            -- Show visual marker where camera is aiming
            ShowMarker = true,
            
            -- Size of the aim marker
            MarkerSize = 0.1,
            
            -- Record detailed entity info on capture
            RecordEntityInfo = true,
        },
        
        -- Animation settings
        Animations = {
            -- Scenario to play during capture
            Scenario = 'WORLD_HUMAN_PAPARAZZI',
            
            -- Duration in milliseconds (focus time)
            Duration = 2000,
        },
        
        -- Maximum photos allowed per player
        MaxPhotosPerPlayer = 100,
        
        -- Auto-delete local photos after successful upload
        AutoDeleteLocal = true,
        
        -- Days to keep photos before auto-cleanup (0 = never)
        RetentionDays = 30,
    },

    --[[
    Photo Items Configuration
    These are physical items for inventory systems (ox_inventory, qb-inventory, etc.)
    ]]
    PhotoItems = {
        -- Police evidence camera
        ['police_camera'] = {
            label = 'Evidence Camera',
            weight = 500,
            stack = false,
            close = true,
            description = 'Official evidence camera with GPS and FOV tracking',
            -- client side export when item is used
            client = {
                export = 'cad-system.usePoliceCamera'
            },
            -- Allowed jobs
            jobs = { 'police', 'sheriff', 'admin' },
        },
        
        -- News/press camera
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
        
        -- Developed evidence photo (police)
        ['police_camera_photo'] = {
            label = 'Evidence Photo',
            weight = 0,
            stack = false,
            close = true,
            description = 'Developed evidence photograph with metadata',
            -- Can be viewed
            client = {
                export = 'cad-system.viewPhotoItem'
            },
        },
        
        -- Press photo (news)
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
    },
    Photos = {
        Photos = {},              -- All photos by ID
        Staging = {},            -- Per-officer staging
        ReviewQueue = {},        -- News → Police submissions
        ReleasedPhotos = {},     -- Police → News released
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
