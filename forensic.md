# CAD Forensics - Single Architecture

## Goal

Use one forensic system only (`server/forensic.lua` and `client/forensic.lua`) with a stable API that
other resources can extend without forking CAD core.

This document replaces mixed/duplicated approaches (`cad:*` + `cad:forensic:*`, and any `forensic_new`
path) with one contract.

## 1) Single Module Layout

```
cad-system/
  server/
    forensic.lua            -- core orchestration and validation
    forensic_registry.lua   -- evidence type registry and external hooks
    forensic_warrants.lua   -- warrants and biometric summons flow
  client/
    forensic.lua            -- ox_lib zones and interactions
```

Only one namespace is valid for forensic callbacks/events:

```
cad:forensic:*
```

## 2) Public Contract for Other Resources

Other resources should be able to register evidence logic without editing CAD files.

### 2.1 Server exports

```lua
exports('RegisterEvidenceType', function(typeName, def) end)
exports('RegisterLabProvider', function(providerName, providerDef) end)
exports('RegisterForensicHook', function(hookName, handler) end)
exports('CreateWarrant', function(payload) end)
exports('GetPersonBiometrics', function(citizenId) end)
```

### 2.2 Client events

```lua
TriggerEvent('cad:forensic:client:registerInteraction', interactionDef)
```

### 2.3 Hook points

```lua
-- hookName values
-- beforeCollect, afterCollect, beforeAnalyze, afterAnalyze,
-- beforeWarrantIssue, afterWarrantComply
```

## 3) Lab Management with ox_lib Zones

Use `ox_lib` zones only for UX/entry points. Keep final permission and position checks on server.

### 3.1 Config shape

```lua
CAD.Config.Forensics = {
    Enabled = true,

    Labs = {
        Enabled = true,
        RequireLab = true,
        Zones = {
            {
                id = 'mission_row',
                label = 'Mission Row Forensics',
                type = 'box', -- sphere | box | poly
                coords = vec3(483.2, -988.3, 24.9),
                size = vec3(3.0, 3.0, 2.5),
                rotation = 90.0,
                radius = 2.0,
                points = nil,
                thickness = 3.0,
                jobs = { 'police', 'sheriff', 'csi' },
                minGrade = 0,
                allowEvidenceTypes = { 'FINGERPRINT', 'DNA', 'CASING', 'BLOOD' },
            },
        },
    },
}
```

### 3.2 Zone runtime rules

- Client builds zones from config (`lib.zones.sphere`, `lib.zones.box`, `lib.zones.poly`).
- `onEnter` shows context UI, `inside` handles keybind/interaction.
- Server callback revalidates:
  - player position in lab bounds
  - job/grade permission
  - cooldown and spam limits
  - evidence ownership/case access

## 4) Evidence Types as Registry (No Hardcoded if-else Tree)

Each evidence type is defined by data schema + handlers.

```lua
CAD.Config.Forensics.EvidenceTypes = {
    FINGERPRINT = {
        label = 'Fingerprint',
        requiresLab = true,
        collect = {
            requiredItems = { 'fingerprint_kit', 'evidence_bag' },
            fields = {
                { key = 'surface', type = 'string', required = true },
                { key = 'quality', type = 'number', min = 1, max = 100, required = true },
            },
        },
        analysis = {
            durationMs = 60000,
            matcher = 'fingerprint_afis',
        },
    },
    CASING = {
        label = 'Casing',
        requiresLab = false,
        collect = {
            requiredItems = { 'evidence_bag' },
            fields = {
                { key = 'caliber', type = 'string', required = true },
                { key = 'weaponClass', type = 'string', required = false },
            },
        },
        analysis = {
            durationMs = 45000,
            matcher = 'ballistics_ibis',
        },
    },
}
```

Third-party resources can register additional types at runtime:

```lua
exports['cad-system']:RegisterEvidenceType('GSR', {
    label = 'Gunshot Residue',
    requiresLab = true,
    collect = { requiredItems = { 'gsr_swab' }, fields = {} },
    analysis = { durationMs = 30000, matcher = 'gsr_matcher' },
})
```

## 5) Character Biometrics (Fingerprint per Character)

Fingerprint identity must be stable per character.

### 5.1 Source of truth

- QB-Core: `Player.PlayerData.metadata.fingerprint`.
- If missing at login, generate once and persist.
- Do not generate a new person fingerprint during evidence collection.

### 5.2 Recommended fallback for non-QB frameworks

- `cad_forensic_profiles` table with `citizen_id`, `fingerprint_id`, `dna_profile_id`.
- Generate once per character and reuse forever unless explicitly reset by admin process.

## 6) Warrant + Biometric Summons

Add a dedicated warrant flow for declaration + fingerprint capture.

### 6.1 Warrant states

`DRAFT -> ISSUED -> SERVED -> COMPLIED | NO_SHOW | CANCELLED`

### 6.2 Warrant types

- `SUMMONS_DECLARATION`
- `SUMMONS_BIOMETRIC_FINGERPRINT`
- `SUMMONS_BIOMETRIC_DNA`

### 6.3 Flow

1. Authorized role issues warrant linked to case/person.
2. Warrant is served (timestamp + officer).
3. Person appears in configured intake zone.
4. Officer captures biometrics.
5. Profile is updated and chain-of-custody entry is created.
6. Case timeline receives immutable audit event.

## 7) Data Model (Minimum)

```sql
CREATE TABLE IF NOT EXISTS cad_forensic_profiles (
    citizen_id VARCHAR(64) PRIMARY KEY,
    fingerprint_id VARCHAR(64) NOT NULL,
    dna_profile_id VARCHAR(64) NULL,
    blood_type VARCHAR(8) NULL,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    UNIQUE KEY uq_fingerprint_id (fingerprint_id)
);

CREATE TABLE IF NOT EXISTS cad_forensic_warrants (
    warrant_id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL,
    person_id VARCHAR(64) NOT NULL,
    warrant_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    reason TEXT,
    issued_by VARCHAR(128) NOT NULL,
    issued_at VARCHAR(32) NOT NULL,
    served_by VARCHAR(128) NULL,
    served_at VARCHAR(32) NULL,
    complied_at VARCHAR(32) NULL,
    cancelled_at VARCHAR(32) NULL,
    metadata LONGTEXT NULL,
    INDEX idx_warrants_case (case_id),
    INDEX idx_warrants_person (person_id),
    INDEX idx_warrants_status (status)
);
```

## 8) Security Baseline

- Validate all payload fields by type and allowed values.
- Validate officer permission from server auth, never client.
- Recheck distance and lab bounds server-side.
- Apply per-callback rate limit.
- Chain-of-custody events are append-only.
- Any external hook failure must not crash core callbacks.

## 9) Migration Notes

- Keep old callback names only as temporary aliases.
- New canonical callbacks must be `cad:forensic:*`.
- Remove aliases after all dependent resources migrate.

## 10) Framework Identity Strategy (ESX/QBox/QB/Standalone)

Use one canonical `personIdentifier` in forensic records.

- QBox: `exports['qbx_core']:GetPlayer(source)` -> `PlayerData.citizenid`.
- QB-Core: `QBCore.Functions.GetPlayer(source)` -> `PlayerData.citizenid`.
- ESX: `xPlayer.getIdentifier()` (or `xPlayer.identifier`).
- Standalone/unsupported: fallback to server identifier (`license2:` then `license:` then next available id).

For ESX multicharacter, keep the full identifier value (for example `char#:license`), do not strip
the `char` prefix. `esx_multicharacter` uses `Config.Prefix = "char"`, so this preserves per-character
uniqueness.

## 11) Biometrics Generation Rules

### 11.1 Blood type

- Preferred source:
  - QB/QBox: `PlayerData.metadata.bloodtype`.
  - ESX/custom: persisted value in `cad_forensic_profiles.blood_type`.
- If missing, generate once from `A+, A-, B+, B-, AB+, AB-, O+, O-`, persist, and reuse.

### 11.2 Fingerprint

- Preferred source:
  - QB/QBox: `PlayerData.metadata.fingerprint` (already unique per character in both frameworks).
  - ESX/standalone: derive deterministic id from character identifier and server salt, then persist.
- Never generate a new character fingerprint during evidence collection.

### 11.3 DNA profile

- If framework has a custom DNA field, use it.
- Otherwise generate deterministic profile id from `personIdentifier + serverSalt` and persist.
- Scene sample != person profile:
  - Scene sample stores collected trace + quality.
  - Match engine compares sample against profile database.

## 12) World Evidence from Low-Level Shot Events

Use `gameEventTriggered` for low-level traces and normalize into forensic objects.

### 12.1 Capture pipeline

1. Client listens to `gameEventTriggered`.
2. Filter events like `CEventGunShot`, `CEventGunShotBulletImpact`, `CEventNetworkEntityDamage`.
3. Resolve shooter ped, position, street, timestamp.
4. Read weapon hash with current weapon native.
5. Convert to hex string for readable forensic signature:

```lua
local weaponHash = GetSelectedPedWeapon(shooterPed)
local weaponHex = string.format('0x%08X', weaponHash & 0xFFFFFFFF)
```

6. Emit server event `cad:forensic:ingestWorldTrace` with normalized payload.

### 12.2 Server normalization

- Validate sender distance and event rate.
- Build trace id and confidence score.
- Optionally spawn one or more CASING candidates near shooter coords.
- Store in short-lived world-trace cache (TTL) until collected or expired.

### 12.3 Rendering in world

- Primary interaction: `ox_lib` zones around trace points.
- Optional debug visuals: `DrawMarker`/`DrawSphere` for development mode.
- Evidence only becomes permanent when collected by authorized officer.

## 13) Client Customization Surface

Expose client-side extension points so other resources can own visuals/interaction style.

```lua
CAD.Config.Forensics.Client = {
    onTraceDetected = nil,        -- function(trace)
    decorateTrace = nil,          -- function(trace) -> ui label/color/icon
    createWorldInteraction = nil, -- function(trace, defaultCollect)
    beforeCollect = nil,          -- function(trace, payload) -> payload
}
```

If these handlers are `nil`, CAD uses built-in defaults.

## 14) Frontend (NUI) Flow

### 14.1 World trace to evidence

1. `ForensicCollection` opens with prefilled `traceId`, `weaponHex`, `coords`, `suggestedType`.
2. Officer confirms evidence type and notes.
3. NUI calls `cad:forensic:collectEvidence`.
4. Server validates, persists, and returns `evidenceId`.
5. UI updates case evidence list and custody timeline.

### 14.2 Lab analysis

1. User selects evidence in `EvidenceAnalysis`.
2. NUI calls `cad:forensic:analyzeEvidence`.
3. Poll `cad:forensic:getAnalysisResults`.
4. Render findings (match score, probable source, linked cases).
5. Option to open compare view and warrant draft.

### 14.3 Warrant + biometric intake

1. Officer drafts `SUMMONS_BIOMETRIC_FINGERPRINT` from case screen.
2. On compliance, intake view opens and captures/links profile.
3. Result is appended to chain-of-custody and case timeline.
4. Frontend shows status transition (`ISSUED` -> `SERVED` -> `COMPLIED`).

## 15) Evidence Bag Workflow (Case Assignment Without Friction)

Support two modes:

- Early case assignment (officer already has case).
- Deferred case assignment (scene first, case later).

### 15.1 Bag states

`OPEN -> SEALED -> BOOKED -> ARCHIVED`

### 15.2 Case linkage rules

- `linkedCaseId` is optional while bag is `OPEN`.
- Once bag is `SEALED`, linking a case creates custody event `LINKED_CASE`.
- Import into case (`BOOKED`) requires final `linkedCaseId`.
- Every trace inside bag inherits final case linkage at booking time.

### 15.3 Bag metadata (minimum)

```json
{
  "bagId": "BAG_20260212_1020_0012",
  "bagLabel": "Depto 12 - Cocina",
  "sceneTag": "SCN-ROBBERY-DEL_PERRO",
  "createdBy": "char2:license:abcd...",
  "sealedBy": null,
  "linkedCaseId": null,
  "status": "OPEN",
  "itemCount": 0
}
```

`bagLabel` is a user input in frontend and should be required for operator clarity.

### 15.4 Frontend -> backend sequence

1. `createBag({ bagLabel, sceneTag, caseId? })`
2. `addTraceToBag({ bagId, traceId, evidenceType, payload })`
3. Optional: `linkBagToCase({ bagId, caseId })`
4. `sealBag({ bagId })`
5. `bookBagToCase({ bagId, caseId })` (if not linked before)

## 16) Optional Photo Pipeline (Provider-Based)

Photo capture/storage must be pluggable to support different resources and APIs.

### 16.1 Provider interface

```lua
exports('RegisterPhotoProvider', function(providerName, handler) end)
```

`handler(context)` returns normalized object:

```json
{
  "ok": true,
  "provider": "screenshot-basic",
  "sourceType": "url",
  "url": "https://cdn.example/evidence/abc.jpg",
  "mime": "image/jpeg",
  "hash": "sha256:...",
  "capturedAt": "2026-02-12T21:12:01Z",
  "metadata": {
    "itemRef": null,
    "apiMethod": "signed-upload-v1"
  }
}
```

If a resource outputs an inventory item instead of URL, keep `sourceType = "item"` and store `itemRef`
until resolver converts it to URL (or keep item-only mode permanently if server prefers).

### 16.2 Case attachment format

All photo methods end in one canonical evidence attachment schema:

```json
{
  "attachmentId": "ATT_...",
  "type": "PHOTO",
  "provider": "screenshot-basic",
  "sourceType": "url",
  "url": "https://...",
  "capturedBy": "char2:license:...",
  "capturedAt": "2026-02-12T21:12:01Z",
  "hash": "sha256:...",
  "notes": "Muzzle flash residue near backdoor"
}
```

### 16.3 Frontend flow for photos

1. Officer opens `Add Photo Evidence` in case or bag context.
2. Select provider (`default`, `resource-x`, `item-import`).
3. Capture/import preview.
4. Add notes/tags.
5. Submit -> backend normalizes and stores in canonical attachment format.
6. UI updates evidence timeline and gallery.

## 17) Suggested Callback Contract Additions

```lua
cad:forensic:createBag
cad:forensic:addTraceToBag
cad:forensic:linkBagToCase
cad:forensic:sealBag
cad:forensic:bookBagToCase
cad:forensic:capturePhoto
cad:forensic:attachPhotoToCase
```

These callbacks keep the frontend simple and allow third-party resources to override internals via
providers/hooks while preserving one CAD forensic contract.
