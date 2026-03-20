# Architecture

The CAD system follows a three-tier architecture standard for FiveM resources.

## Data Flow

```
User Action (NUI)
    |
    v
SolidJS Component --> Store Action --> fetchNui('cad:callback')
    |
    v
Client Lua (NUI Callback) --> lib.callback.await('cad:server:action')
    |
    v
Server Lua (Auth Guard) --> Business Logic --> MySQL (oxmysql)
    |
    v
Broadcast Event --> TriggerClientEvent --> NUI Message Handler --> Store Update
```

## Layer Responsibilities

### Server (Lua)

| Directory | Purpose |
|-----------|---------|
| `server/infra/database.lua` | Schema creation, migrations, scheduled cleanup |
| `server/infra/functions.lua` | Utilities: ID generation, sanitization, logging |
| `server/infra/exports.lua` | Public API (40+ exports) |
| `server/infra/main.lua` | Bootstrap, state initialization, disconnect cleanup |
| `server/auth/auth.lua` | Authentication guards, rate limiting, caching |
| `server/auth/officers.lua` | Officer data lookup via QBCore |
| `server/actions/*` | Business logic for each module |

### Client (Lua)

| Directory | Purpose |
|-----------|---------|
| `client/core/init.lua` | Client initialization, terminal detection |
| `client/core/qb.lua` | QBCore integration |
| `client/app/main.lua` | App lifecycle (open/close/visibility) |
| `client/app/nui.lua` | NUI callback bridge (~50 wrappers) |
| `client/actions/*` | Player-facing actions (forensics, evidence, photos) |

### NUI / Frontend (TypeScript + SolidJS)

| Directory | Purpose |
|-----------|---------|
| `source/stores/` | 27 reactive stores (state management) |
| `source/handlers/` | 12 NUI message handler groups |
| `source/commands/` | 31 terminal command builder files |
| `source/components/` | UI components and 29+ modals |
| `source/hooks/` | Custom hooks (useNui, useSearch, useFilter) |
| `source/mocks/` | Browser-mode mock system for development |
| `source/styles/` | SCSS modular architecture |

## State Management

The frontend uses SolidJS stores with a centralized pattern:

- **`cadStore`** — Cases, dispatch calls, evidence, fines (main state)
- **`userStore`** — Current officer data, permissions, callsign
- **`terminalStore`** — Terminal output, command history, UI state
- **`appStore`** — App visibility, mode (terminal/vehicle dock)
- **`dispatchStore`** — Extended dispatch state (inherits from cadStore)
- **`emsStore`** — EMS alerts, units, blood requests
- **`sessionStore`** — Session context (terminal ID, access point)

## Authentication

```
Client Request --> Auth Guard (CAD.Auth.WithGuard)
    |
    +--> Check officer cache (TTL-based)
    +--> Rate limit check (per-source bucket)
    +--> Job validation (AllowedJobs)
    +--> Execute handler with officer context
```

## Database

MySQL via oxmysql with:
- Parameterized queries (SQL injection safe)
- Auto-schema creation (`CREATE TABLE IF NOT EXISTS`)
- Scheduled cleanup events for stale data
- Foreign key constraints with CASCADE delete
