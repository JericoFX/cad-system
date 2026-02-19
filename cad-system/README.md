# CAD System

CAD pensado para servidores FiveM con rol policial, EMS y forense desde una terminal fija en juego.

Created by **JericoFX**  
GitHub: https://github.com/JericoFX  
License: **GNU GPL v3**

## En pocas palabras

Este CAD te ayuda a manejar el trabajo diario del servidor sin salir del flujo de rol:

- Recibir y organizar llamadas de dispatch.
- Abrir casos, agregar notas y dar seguimiento.
- Buscar personas y vehiculos rapidamente.
- Guardar evidencia (fotos, video, audio y pruebas forenses).
- Apoyar trabajo conjunto entre policia, EMS y forense.
- Gestionar multas y otros registros operativos.

Todo esta pensado para que la operacion sea mas clara, rapida y ordenada dentro del servidor.

## What is included

- Case management (create/search/update/close)
- Dispatch board (calls, assignments, unit status, map flow)
- Person and vehicle search (records, warrants, notes)
- Evidence staging + case attachment + evidence document viewer
- Forensics (lab callbacks + world trace bagging by proximity)
- EMS dashboard + blood request/analysis transfer
- Toxicology window tracking from `ox_inventory` item use (stored in QBCore metadata)
- Fines and ticket payment flow
- Police dashboard tools + jail transfer log hook
- News module
- NUI mock mode for browser development

## Dependencies

Required:

- `ox_lib`
- `oxmysql`
- `ox_inventory`

Optional:

- `ox_target` (for target-based terminal interaction)

## Install

1. Put `cad-system` in your server resources folder.
2. Ensure dependencies are started before this resource.
3. Add `ensure cad-system` in your server config.
4. Restart server.

## Build (NUI)

NUI uses Bun + Vite.

```bash
cd cad-system/nui
bun install
bun run typecheck
bun run build
```

Build output is generated in `cad-system/build` (single stable output, no hashed names).

## Basic configuration

Main file: `config.lua`

### Framework adapter

```lua
Framework = {
    Preferred = 'qb-core'
}
```

Only QBCore is supported.

### CAD access

```lua
UI = {
    Command = 'cad',
    Keybind = 'F6',
    AccessMode = 'auto' -- auto | zone | target
}
```

Use `UI.AccessPoints` to define fixed terminal positions, allowed jobs, ID reader, and evidence container.

### Callsign policy

```lua
Security = {
    Callsign = {
        RequireWhenEmpty = true,
        RequireWhenPrefix = { 'B-' }
    }
}
```

`RequireWhenPrefix` controls which callsign prefixes force the callsign modal.

### Feature toggles

```lua
Features = {
    Dispatch = { Enabled = true, ShowInUI = true },
    Forensics = { Enabled = true, ShowInUI = true },
    News = { Enabled = true, ShowInUI = true }
}
```

### Media upload (single server config)

Define this in your `server.cfg`:

```cfg
set CAD_MEDIA_SERVICE fivemanage
set CAD_MEDIA_API_KEY your_api_key_here
set CAD_MEDIA_UPLOAD_URL ""
```

- `CAD_MEDIA_SERVICE`: `fivemanage` | `medal` | `discord` | `custom`
- `CAD_MEDIA_API_KEY`: shared API key used by the selected service (when required)
- `CAD_MEDIA_UPLOAD_URL`: required for `medal` and `custom` services

Notes:

- `screenshot-basic` is still the base capture layer for image grabs.
- `fivemanage` works out of the box with default CAD endpoints.
- `medal` needs an upload endpoint URL (your Medal-compatible pipeline).

### Dispatch quick setup

```lua
Dispatch = {
    AllowEMSControl = true,
    Easy = {
        Preset = 'standard' -- relaxed | standard | strict
    }
}
```

### Blood workflow setup

```lua
Forensics = {
    BloodAnalysisDurationMs = 45000,
    BloodPostAnalysis = {
        mode = 'reminder', -- disabled | reminder | auto_send
        timeoutMs = 120000,
        reminderIntervalMs = 120000,
    }
}
```

### Toxicology tracking (QBCore metadata)

```lua
Forensics = {
    Toxicology = {
        Enabled = true,
        MetadataKey = 'cad_toxicology',
        StateBagKey = 'cad_toxicology',
        DefaultWindowMs = 1800000,
        TrackedItems = {
            weed_joint = { substance = 'THC', windowMs = 1800000, severity = 'LOW' },
            cocaine_baggy = { substance = 'COCAINE', windowMs = 2700000, severity = 'HIGH' },
        }
    }
}
```

How it works:

- When a tracked item is used, CAD updates active toxicology windows in QBCore player metadata.
- Current summary is also replicated to player statebag (`StateBagKey`) for real-time consumers.
- During blood sample creation, CAD injects a frozen `toxicologySnapshot` into sample metadata.
- When EMS transfers blood evidence to a case, that snapshot is stored in `evidence.data.analysis.toxicology`.
- No extra CAD toxicology table is required.

### Forensic world trace setup

```lua
Forensics = {
    WorldTraceTTLSeconds = 1800,
    WorldTraceDetectRadius = 18.0,
    WorldTraceInteractRadius = 1.8,
    WorldTraceVisibleJobs = {
        police = true,
        sheriff = true,
        csi = true,
    },
    AllowAllIngestResources = true,
    AllowedIngestResources = {},
}
```

## ox_inventory items

Add these to `ox_inventory/data/items.lua`:

```lua
['cad_ticket'] = {
    label = 'CAD Fine Ticket',
    weight = 1,
    stack = false,
    close = true,
    consume = 0,
    client = {
        export = 'cad-system.useCadTicket'
    }
}

['cad_blood_sample'] = {
    label = 'CAD Blood Sample',
    weight = 1,
    stack = false,
    close = true,
    consume = 0,
    description = 'Sealed forensic blood sample for EMS lab processing'
}

['security_camera'] = {
    label = 'Security Camera',
    weight = 350,
    stack = false,
    close = true,
    consume = 0,
    description = 'Deployable CCTV camera for dispatch live grid',
    client = {
        export = 'cad-system.useSecurityCamera'
    }
}
```

If your resource name is different, replace `cad-system` in the export string.

### Security camera item (copy/paste block)

If you only need the CCTV item, this is the exact block:

```lua
['security_camera'] = {
    label = 'Security Camera',
    weight = 350,
    stack = false,
    close = true,
    consume = 0,
    description = 'Deployable CCTV camera for dispatch live grid',
    client = {
        export = 'cad-system.useSecurityCamera'
    }
}
```

In Dispatch, each camera appears in the CCTV grid with:

- `[VER]` to open feed
- `[ENABLE]` / `[DISABLE]` to toggle status
- `[REMOVE]` to delete camera

## ID Reader (terminal stash flow)

ID reader reads document item metadata from terminal stash slots.

Example access point block:

```lua
idReader = {
    enabled = true,
    stashId = 'cad_id_reader_mrpd_frontdesk',
    label = 'MRPD ID Reader',
    slots = 5,
    weight = 2000,
    readSlot = 1,
    allowedItems = { 'id_card', 'driver_license', 'passport', 'weaponlicense' },
}
```

Supports metadata normalizing for QB-style, ESX-style, and generic keys.

## Dispatch flow (recommended RP loop)

1. Create call in Dispatch board.
2. Assign one or more units.
3. Send notice directly from Dispatch (no need to leave to another UI).
4. Open map and return to Dispatch with one click.
5. Link/create case and close call when done.

## Forensics flow (world collection)

Normal gameplay flow is proximity based (not command driven):

1. Trace is created by external system/resource.
2. Officer gets close to trace.
3. Prompt appears to bag evidence.
4. Bagged evidence goes to staging.
5. Attach staging evidence to case.
6. Open evidence to inspect forensic metadata.

Debug command (`collectevidence`) is only available when `Debug = true`.

## Hooks and exports

### Forensic trace ingestion

- Event: `cad:forensic:ingestWorldTrace`
- Export: `exports['cad-system']:IngestWorldTrace(payload)`

Payload example:

```lua
exports['cad-system']:IngestWorldTrace({
    coords = vector3(x, y, z),
    evidenceType = 'DNA',
    description = 'Door handle touch DNA',
    ttlSeconds = 1800,
    metadata = {
        source = 'my-resource'
    }
})
```

### Jail transfer log hook

- Callback: `cad:police:logJailTransfer`
- Callback: `cad:police:getJailTransfers`
- Export: `LogJailTransfer`
- Export: `GetJailTransfers`
- Event: `cad:hook:jailTransferLogged`
- Event: `cad:server:jailTransferLogged`

Use this to notify jail/prison resources without forcing a hard dependency.

## Database

Schema auto-created by `server/database.lua`:

- `cad_cases`
- `cad_case_notes`
- `cad_case_tasks`
- `cad_evidence`
- `cad_dispatch_calls`
- `cad_fines`
- `cad_ems_alerts`
- `cad_ems_blood_requests`

Note: toxicology windows use QBCore metadata and blood evidence payload (no dedicated SQL table).

## Localization

NUI supports JSON-based strings.

- Locale file: `nui/source/locales/en.json`
- Resolver: `nui/source/utils/i18n.ts`

Current setup is English-first with fallback.

## Browser mock mode

Mock handlers live in `nui/source/mocks/mockNUI.ts`.

Includes simulated responses for:

- cases
- dispatch
- forensic collect/analyze/compare
- EMS blood request flow
- police jail transfer log

## Related docs

- `DOC.md` - module-by-module behavior and flow notes

## Media capture options

The CAD system supports integration with media capture services for screenshots, videos, and audio.

### Screenshot Basic (base)

CAD image capture is built around `screenshot-basic` exports.

- Resource: https://github.com/citizenfx/screenshot-basic
- Used by CAD for direct upload and server-side proxy capture flows

### FiveManage

FiveManage is fully supported for image uploads.

- Docs (images): https://docs.fivemanage.com/guides/uploading-files/images
- Main endpoint: `https://api.fivemanage.com/api/v3/file`
- Base64 endpoint: `https://api.fivemanage.com/api/v3/file/base64`
- Auth: `Authorization` header (or `?apiKey=` query)

### MedalTV

Medal can be integrated as the media upload target and also provides a drop-in replacement layer compatible with `screenshot-basic` style flows.

- Resource: https://github.com/get-wrecked/fivem
- Release thread: https://forum.cfx.re/t/free-medal-lagless-screenshots-event-auto-clipping/5355630
- For CAD, set `CAD_MEDIA_SERVICE=medal` and configure `CAD_MEDIA_UPLOAD_URL` (+ key if needed)

## Vehicle Integration Testing Guide

### Debug Commands for Vehicle CAD Testing

| Command | Action |
|---------|--------|
| Press `F10` | Toggle vehicle CAD context |
| `/vehiclecad` | Same as F10 (toggle on/off) |

When activated:
- Automatically opens Vehicle CAD interface
- Simulates driving at 35 MPH
- Radar system becomes active

### License Scan Simulation
| Command | Action |
|---------|--------|
| `/scanplate` | Simulate license plate scan |

Example output:
```
> /scanplate
✓ License scan complete: CAD-789
```

### Mock Radar Data
When in vehicle CAD mode, radar automatically shows:
- 1-2 vehicles within 100m range
- 25% chance of a **WANTED** vehicle (shown in red)
- Random distances and positions

### UI Behavior Testing
| Scenario | Expected Behavior |
|----------|-------------------|
| Speed > 40 MPH | UI switches to COMPACT MODE |
| Speed < 10 MPH | UI returns to NORMAL MODE |
| Not in vehicle CAD | Standard CAD interface shows |
| Press X near vehicle | License scan animation plays |

### Troubleshooting

1. **Commands not working?**
   - Verify `CAD.Config.Debug = true`
   - Restart the resource after making config changes

2. **No radar data showing?**
   - Ensure you've activated vehicle CAD with F10
   - Check browser console for NUI errors

3. **UI not switching?**
   - Confirm `terminalState.isInPoliceVehicle` is being updated
   - Check vehicle_cad.lua for proper context detection

> **Note**: These debug tools are automatically disabled in production (when `Debug = false`)

## Quick troubleshooting

- CAD does not open:
  - check job permissions in `Security.AllowedJobs`
  - verify terminal access setup in `UI.AccessPoints`
- NUI not updating:
  - rebuild NUI (`bun run build`)
  - make sure `build/index.html` exists
- Blood transfer issues:
  - verify `cad_blood_sample` exists in `ox_inventory`
  - check `Forensics.BloodPostAnalysis` config
- Toxicology not appearing in blood evidence:
  - verify `Forensics.Toxicology.Enabled = true`
  - verify used item names match `Forensics.Toxicology.TrackedItems`
  - confirm your framework is QBCore and metadata updates are available
- Forensic traces not visible:
  - verify job is allowed in `Forensics.WorldTraceVisibleJobs`
  - verify ingest source is allowed when `AllowAllIngestResources = false`
