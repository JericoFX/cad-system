# CAD System Audit Findings

## Security

### 1) Unguarded news callbacks bypass shared guard protections

- **Location:** `server/news.lua` callback registrations for `cad:news:getArticles`, `cad:news:published`, `cad:news:updated`, `cad:news:expired`, `cad:news:deleted`.
- **Problem:** These callbacks are registered directly instead of using `CAD.Auth.WithGuard`, unlike most other server callbacks.
- **Impact:** They do not receive centralized rate limiting and panic shielding from `CAD.Auth.WithGuard`, increasing abuse/DoS risk and creating inconsistent auth hardening.
- **Minimal fix recommendation:** Wrap all news callbacks with `CAD.Auth.WithGuard` using `default` or `heavy` buckets as appropriate.
- **Verification status:** **Verified** against in-repo callback patterns and guard implementation.

### 2) Photo retrieval endpoint lacks authorization checks

- **Location:** `server/photos.lua` callback `cad:photos:getPhoto`.
- **Problem:** Endpoint returns full photo object by `photoId` without checking caller authorization/job/ownership.
- **Impact:** Any caller able to invoke the callback can enumerate/read sensitive photo metadata (evidence context, URLs, location/timestamps).
- **Minimal fix recommendation:** Require officer identity and enforce access policy (owner, assigned role, or admin) before returning photo payload.
- **Verification status:** **Verified** by direct code path inspection.

## Correctness

### 3) Active-crime detection iterates dispatch call map with `ipairs`

- **Location:** `server/forensic/sync.lua` in `cad:forensic:sync` active-crime check loop.
- **Problem:** Code uses `ipairs(CAD.State.Dispatch.Calls or {})`, but dispatch calls are stored as key-value map by `callId`; `ipairs` only traverses integer array indexes.
- **Impact:** `inActiveCrime` can remain false even when active calls exist, incorrectly suppressing forensic evidence generation when `requireCrimeContext` is true.
- **Minimal fix recommendation:** Replace `ipairs` with `pairs` for map traversal.
- **Verification status:** **Verified** against dispatch storage shape in bootstrap/load and dispatch modules.

### 4) Client-controlled article timestamps are accepted during upsert

- **Location:** `server/news.lua` in `sanitizeArticle`.
- **Problem:** `createdAt` and `updatedAt` are accepted from payload if present, instead of being server-authoritative.
- **Impact:** Clients can backdate/forward-date article ordering and audit metadata, producing inconsistent timeline integrity.
- **Minimal fix recommendation:** Always set `updatedAt` on server; only allow `createdAt` from server for new records.
- **Verification status:** **Verified** by function logic inspection.

## Performance

### 5) Periodic forensic sync thread runs every second regardless of state changes

- **Location:** `server/forensic/sync.lua` top-level `CreateThread` loop.
- **Problem:** Loop executes `ensureEvidenceState()` every 1000ms permanently even though state initialization is usually static.
- **Impact:** Continuous overhead on server tick for low-value work; unnecessary frequent GlobalState reads/checks.
- **Minimal fix recommendation:** Initialize once at startup and on-demand before writes, or increase interval significantly.
- **Verification status:** **Verified** by loop body inspection.

## Maintainability

### 6) Inconsistent callback protection model across modules

- **Location:** `server/news.lua`, `server/photos.lua`, `server/main.lua` compared to guarded modules (`server/cases.lua`, `server/evidence.lua`, `server/dispatch.lua`).
- **Problem:** Some modules rely on ad-hoc auth checks while others use centralized guard wrappers.
- **Impact:** Higher chance of future security/correctness drift and uneven behavior (rate limits, standardized error handling).
- **Minimal fix recommendation:** Standardize callback registration through `CAD.Auth.WithGuard` (or module-specific wrappers) and reserve inline checks for role-specific logic only.
- **Verification status:** **Verified** by callback registration survey.
