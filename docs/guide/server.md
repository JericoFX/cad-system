# Server & Database

## Server Architecture

The server runs as Lua scripts within FiveM's Cerulean runtime (Lua 5.4). All server files are loaded in order via `fxmanifest.lua`.

### Bootstrap Sequence

1. **Framework Init** (`server/core/init.lua`) — Connects to QBCore
2. **Utilities** (`server/infra/functions.lua`) — Registers helper functions
3. **Database** (`server/infra/database.lua`) — Creates/migrates tables
4. **Auth** (`server/auth/`) — Initializes officer cache and auth guards
5. **Actions** (`server/actions/`) — Registers all business logic callbacks
6. **Exports** (`server/infra/exports.lua`) — Registers public API
7. **Main** (`server/infra/main.lua`) — Loads persisted state, starts timers

### State Management

The server maintains in-memory state in `CAD.State` (defined in `config.lua`):

```lua
CAD.State = {
    Cases = {},           -- Active cases
    Dispatch = {
        Units = {},       -- Active units
        Calls = {},       -- Active calls
    },
    Evidence = {
        Staging = {},     -- Per-officer staging buckets
    },
    Fines = {},
    EMS = { Alerts = {}, Units = {}, BloodRequests = {} },
    -- ... and more
}
```

State is synced to the database periodically and on key operations.

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `cad_cases` | Investigation cases with status, priority, type |
| `cad_case_notes` | Notes attached to cases |
| `cad_case_tasks` | Task tracking within cases |
| `cad_evidence` | Evidence records with chain of custody (JSON) |
| `cad_evidence_custody` | Custody transfer audit trail |

### Operational Tables

| Table | Purpose |
|-------|---------|
| `cad_dispatch_calls` | Dispatch call history |
| `cad_fines` | Fines/citations issued |
| `cad_jail_transfers` | Jail transfer records |
| `cad_ems_alerts` | EMS medical alerts |

### Module Tables

| Table | Purpose |
|-------|---------|
| `cad_forensics` | Forensic analysis results |
| `cad_security_cameras` | Camera positions and config |
| `cad_photos` | Photo metadata |
| `cad_news` | News articles |
| `cad_virtual_containers` | Virtual evidence containers |
| `cad_audit_log` | System audit trail |

### Automatic Maintenance

The database runs scheduled MySQL events for cleanup:
- Closed cases older than retention period
- Expired EMS alerts
- Stale dispatch calls

## Utilities

### ID Generation

```lua
CAD.Server.GenerateId('CASE')  -- Returns: "CASE-a1b2c3d4"
```

### Sanitization

```lua
CAD.Server.SanitizeString(input, maxLength)
-- Removes HTML tags, normalizes whitespace, trims, enforces length
```

### Logging

```lua
CAD.Log('error', 'Failed to create case: %s', tostring(err))
CAD.Log('success', 'Bootstrap loaded: %d cases', count)
CAD.Log('debug', 'Cache hit for officer %s', identifier)
```

Levels: `error` (red), `warn` (yellow), `success` (green), `debug` (purple), `info` (white).
