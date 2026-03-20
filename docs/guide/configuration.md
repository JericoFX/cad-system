# Configuration

All configuration is in `config.lua`. Runtime values use FiveM convars set in `server.cfg`.

## Convars

| Convar | Default | Description |
|--------|---------|-------------|
| `CAD_PROFILE` | `simple` | Feature profile: `simple`, `full`, or `custom` |
| `CAD_MEDIA_SERVICE` | `fivemanage` | Upload provider: `fivemanage`, `medal`, `discord`, `custom` |
| `CAD_MEDIA_API_KEY` | `""` | API key for the selected media service |
| `CAD_MEDIA_UPLOAD_URL` | `""` | Custom upload endpoint (for `medal` or `custom`) |

## UI Access

```lua
CAD.Config.UI = {
    Command = 'cad',          -- Chat command to open
    Keybind = 'F6',           -- Default keybind
    AccessMode = 'auto',      -- 'auto' | 'fixed' | 'free'
}
```

**Access Modes:**
- `auto` — Opens at configured terminal locations or via command if job matches
- `fixed` — Only opens when near a configured `AccessPoint`
- `free` — Opens anywhere if job matches

## Access Points

Each access point defines a physical terminal location:

```lua
CAD.Config.UI.AccessPoints = {
    {
        id = 'mrpd_frontdesk',
        label = 'MRPD Front Desk PC',
        coords = vector3(441.88, -981.92, 30.69),
        radius = 1.25,
        jobs = { 'police', 'sheriff', 'csi', 'dispatch', 'admin' },
        idReader = {
            enabled = true,
            stashId = 'cad_id_reader_mrpd_frontdesk',
            slots = 5,
            allowedItems = { 'id_card', 'driver_license', 'passport' },
        },
        evidenceContainer = {
            enabled = true,
            stashId = 'cad_evidence_mrpd_frontdesk',
            slots = 200,
            weight = 500000,
            shared = true,
        },
    },
}
```

## Security

```lua
CAD.Config.Security = {
    AllowedJobs = {
        police = true,
        sheriff = true,
        csi = true,
        ambulance = true,
        ems = true,
        dispatch = true,
        reporter = true,
        weazelnews = true,
        admin = true,
    },
    AdminJobs = {
        admin = true,
        policechief = true,
    },
    RateLimitPerMinute = {
        default = 80,
        heavy = 30,
    },
}
```

## Feature Toggles

Each module can be enabled/disabled independently:

```lua
CAD.Config.Features = {
    Dispatch       = { Enabled = true, ShowInUI = true },
    EMS            = { Enabled = true, ShowInUI = true },
    SecurityCameras = { Enabled = true, ShowInUI = true },
    Forensics      = { Enabled = true, ShowInUI = true },
    News           = { Enabled = true, ShowInUI = true },
    Map            = { Enabled = true, ShowInUI = true },
    Radio          = { Enabled = true, ShowInUI = true },
}
```

## Cases

```lua
CAD.Config.Cases = {
    DefaultStatus = 'OPEN',
    PublicState = {
        ClosedRetentionMinutes = 10,
        MaxCases = 300,
    },
    Types = { 'GENERAL', 'THEFT', 'ASSAULT', 'HOMICIDE', 'ACCIDENT',
              'DRUGS', 'TRAFFIC', 'DISTURBANCE', 'SUSPICIOUS', 'MEDICAL' },
}
```

## Dispatch

```lua
CAD.Config.Dispatch = {
    PositionBroadcastMs = 5000,     -- Unit position update interval
    UnitStaleSeconds = 300,          -- Mark unit stale after N seconds

    -- SLA timers (per priority)
    SLA = {
        Pending = {
            WarningMinutes = { p1 = 2, p2 = 4, p3 = 6 },
            BreachMinutes  = { p1 = 4, p2 = 8, p3 = 12 },
        },
        Active = {
            WarningMinutes = { p1 = 8, p2 = 10, p3 = 12 },
            BreachMinutes  = { p1 = 15, p2 = 20, p3 = 25 },
        },
    },

    -- Auto-assignment algorithm
    AutoAssignment = {
        Enabled = true,
        DistanceMetersPerPenaltyPoint = 70,
        UnknownDistancePenalty = 15,
    },

    -- Easy mode presets
    Easy = {
        Preset = 'standard',     -- 'relaxed' | 'standard' | 'strict'
    },
}
```

## Media Upload

Supports multiple providers for photo/video/audio uploads:

```lua
CAD.Config.PhotoSystem = {
    Provider = 'screenshot-basic',
    Upload = {
        MethodByType = {
            image = 'server_proxy',
            video = 'medal',
            audio = 'fivemanage',
        },
        Service = 'fivemanage',    -- Set via CAD_MEDIA_SERVICE convar
    },
}
```

See the full `config.lua` for all available options.
