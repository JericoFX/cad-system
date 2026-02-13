# FORENSIC TODO - Single Core + Extensible API

## Objective

Eliminate split approaches and keep one forensic core only. No `forensic_new.lua` track.

Canonical files:

- `server/forensic.lua`
- `client/forensic.lua`

Canonical callback namespace:

- `cad:forensic:*`

## Phase 1 - Unify Current Surface

- [ ] Rename remaining non-namespaced callbacks to `cad:forensic:*`.
- [ ] Keep temporary aliases (`cad:checkInLab`, etc.) for migration only.
- [ ] Update `client/nui.lua` to call only `cad:forensic:*`.
- [ ] Update `client/forensic.lua` command flow to use namespaced callbacks.
- [ ] Document deprecation date for aliases.

## Phase 1.5 - Framework Identity (ESX/QBox/QB/Fallback)

- [ ] Add QBox framework provider in core detection.
- [ ] ESX identity: prefer `xPlayer.getIdentifier()`.
- [ ] Preserve multichar prefix (`char#:...`) when present.
- [ ] Fallback identifier order for unsupported frameworks: `license2:` -> `license:` -> first available.
- [ ] Ensure forensic records use one canonical `personIdentifier` field.

## Phase 2 - Lab Management with ox_lib Zones

- [ ] Replace ad-hoc lab checks in client with zone bootstrap from config.
- [ ] Support zone types: `sphere`, `box`, `poly`.
- [ ] Add per-lab job/grade/evidence permissions in config.
- [ ] Add server-side lab validator that rechecks position + permission.
- [ ] Add cooldown/rate-limit for lab actions.

## Phase 3 - Evidence Registry (Customization Core)

- [ ] Create registry table for evidence definitions (schema + handlers).
- [ ] Replace hardcoded evidence `if/elseif` generation with registry dispatch.
- [ ] Add export `RegisterEvidenceType(typeName, def)`.
- [ ] Add validation for type fields (`required`, `type`, `enum`, `min/max`).
- [ ] Add fallback behavior when an external type handler errors.

## Phase 4 - External Hooks and Providers

- [ ] Add export `RegisterForensicHook(hookName, handler)`.
- [ ] Add hooks: `beforeCollect`, `afterCollect`, `beforeAnalyze`, `afterAnalyze`.
- [ ] Add export `RegisterLabProvider(name, providerDef)` for third-party lab UIs.
- [ ] Ensure hook execution is isolated (pcall + timeout guard).
- [ ] Log hook failures without breaking core forensic actions.

## Phase 5 - Character Biometrics

- [ ] Use character-stable fingerprint source.
- [ ] QB-Core path: `Player.PlayerData.metadata.fingerprint`.
- [ ] On missing fingerprint, generate once and persist in metadata/profile.
- [ ] Prevent new random fingerprint generation during collection.
- [ ] Add profile read/export for external resources.
- [ ] QBox/QB source: `metadata.fingerprint` and `metadata.bloodtype`.
- [ ] ESX/fallback source: `cad_forensic_profiles` persistence.

## Phase 6 - Warrant for Declaration and Fingerprints

- [ ] Create warrant entity with states:
  - `DRAFT`, `ISSUED`, `SERVED`, `COMPLIED`, `NO_SHOW`, `CANCELLED`
- [ ] Add warrant types:
  - `SUMMONS_DECLARATION`
  - `SUMMONS_BIOMETRIC_FINGERPRINT`
  - `SUMMONS_BIOMETRIC_DNA`
- [ ] Add callbacks for issue/serve/comply/cancel.
- [ ] Link warrant actions to case timeline and chain-of-custody events.
- [ ] Add permission gates by role/rank.

## Phase 7 - Database

- [ ] Add `cad_forensic_profiles` table.
- [ ] Add `cad_forensic_warrants` table.
- [ ] Add indexes for `person_id`, `case_id`, `status`.
- [ ] Add migration script from existing metadata/evidence where possible.
- [ ] Add rollback-safe schema checks.

## Phase 8 - Compatibility and Rollout

- [ ] Publish integration guide for external resources.
- [ ] Keep compatibility aliases for one release cycle.
- [ ] Add server startup warning when old callbacks are used.
- [ ] Remove aliases after migration window.
- [ ] Tag release notes with breaking change section.

## Phase 9 - World Traces (Low-Level Events)

- [ ] Add client listener for `gameEventTriggered`.
- [ ] Capture `CEventGunShot`, `CEventGunShotBulletImpact`, `CEventNetworkEntityDamage` traces.
- [ ] Build trace payload with coords, timestamp, and weapon hash.
- [ ] Convert weapon hash to hex signature (example: `0x1B06D571`).
- [ ] Send normalized traces to server ingest endpoint with rate limits.
- [ ] Expire uncollected traces with TTL.

## Phase 10 - Client Customization + Frontend Flow

- [ ] Add client customization hooks (`onTraceDetected`, `decorateTrace`, `createWorldInteraction`, `beforeCollect`).
- [ ] Prefill forensic modal from world trace context.
- [ ] Add frontend status badges for trace lifecycle (`DETECTED`, `COLLECTED`, `EXPIRED`).
- [ ] Add analysis result flow with compare/warrant quick actions.
- [ ] Add warrant intake flow UI for biometric summons compliance.

## Phase 11 - Evidence Bags (UI + Domain)

- [ ] Add bag lifecycle states: `OPEN`, `SEALED`, `BOOKED`, `ARCHIVED`.
- [ ] Require `bagLabel` input when creating bag.
- [ ] Allow `linkedCaseId = null` while collecting in scene.
- [ ] Add callbacks: `createBag`, `addTraceToBag`, `linkBagToCase`, `sealBag`, `bookBagToCase`.
- [ ] Add custody events for bag transitions and case linkage.

## Phase 12 - Optional Photo Providers

- [ ] Add provider registry: `RegisterPhotoProvider(providerName, handler)`.
- [ ] Support `sourceType = url | item` in normalized attachment model.
- [ ] Add callback `capturePhoto` to route through selected provider.
- [ ] Add callback `attachPhotoToCase` with canonical attachment schema.
- [ ] Add URL allowlist + payload validation for photo attachments.

## Test Matrix

- [ ] Lab entry/exit for each zone type.
- [ ] Evidence collection for built-in and external registered types.
- [ ] Hook execution order and failure isolation.
- [ ] Fingerprint stability across relog/restart.
- [ ] Warrant state machine and permission checks.
- [ ] SQL persistence and bootstrap reload.

## Done Criteria

- One forensic core and one callback namespace.
- Evidence extensibility via exports, without editing CAD files.
- Stable per-character biometrics.
- Warrant workflow integrated with audit trail.

## Appended UI Fixes (Latest Requests)

- [ ] Vehicle owner action must open owner data directly (no empty screen).
- [ ] BOLO "Search Person" and "Search Vehicle" must prefill and auto-resolve target records.
- [ ] DOCUMENT evidence must open in a readable notepad-style modal.
- [ ] Keep new ad-hoc requests appended at the end of this list.
- [ ] News featured/gallery images must render reliably in preview/editor.
- [ ] Editing and publishing a news article must update existing record (no duplicate publish flow).
- [ ] Add police -> EMS blood sample request messaging workflow with status tracking.
- [ ] Add ID reader stash flow with [READ FROM ID] in Person Search and metadata normalization (QB/ESX/generic).
