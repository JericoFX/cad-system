# CAD System - Functional Notes

In case you want to modify something here is a document for it.

This document explains what each module does, where to use it, and the expected flow.

## 1) Core usage

- Open CAD with command/key from `config.lua` (`UI.Command`, `UI.Keybind`).
- Access can be command-only or terminal-based (`UI.AccessMode` and `UI.AccessPoints`).
- Features can be enabled/disabled in `Features` (Dispatch, Forensics, News).

## 2) Cases

Main files: `server/cases.lua`, `nui/source/components/modals/CaseManager.tsx`, `CaseCreator.tsx`.

What it does:

- Create, search, update, and close cases.
- Store notes, evidence references, and tasks.

How to use:

- Create a case from Case Creator or from related modules (Dispatch/Person flow).
- Manage notes/tasks/evidence in Case Manager.

## 3) Dispatch

Main files: `server/dispatch.lua`, `nui/source/components/modals/DispatchTable.tsx`.

What it does:

- Manage live calls and unit assignment.
- Shows KPIs, queue, and unit board.
- Supports map jump and return flow.
- Sends unit notifications directly from Dispatch flow.

How to use:

- Create call -> assign units -> notify units -> close call.
- If needed, open map from Dispatch and return back with one click.

Config:

- `Dispatch.Easy.Preset` for simple setup (`relaxed`, `standard`, `strict`).
- Advanced tuning in `Dispatch.SLA` and `Dispatch.AutoAssignment`.

## 4) EMS and blood workflow

Main files: `server/ems.lua`, `nui/source/components/modals/EMSDashboard.tsx`.

What it does:

- Blood request from police to EMS.
- Analysis timer/progress in NUI.
- Transfer evidence result to police case.

How to use:

- Police requests blood sample from person profile.
- EMS starts analysis, waits progress, then sends result.
- Request updates are tracked and notified.

Config:

- `Forensics.BloodAnalysisDurationMs`
- `Forensics.BloodPostAnalysis.mode` (`disabled`, `reminder`, `auto_send`)

## 5) Forensics and world traces

Main files: `server/forensic.lua`, `client/forensic.lua`.

What it does:

- Forensic analysis callbacks.
- World trace ingestion and nearby detection.
- Evidence bagging by proximity.

How to use (RP flow):

1. Trace is created by another system/resource via hook/export.
2. Officer approaches trace location.
3. Prompt appears to bag evidence.
4. Bagged item goes to staging; can be attached to case.

Ingestion hook:

- Export: `exports['cad-system']:IngestWorldTrace(payload)`
- Event: `TriggerEvent('cad:forensic:ingestWorldTrace', payload)`

Payload example:

```lua
{
  coords = vector3(x, y, z),
  evidenceType = 'DNA',
  description = 'Door handle touch DNA',
  ttlSeconds = 1800,
  metadata = { source = 'my-resource' }
}
```

## 6) Evidence

Main files: `server/evidence.lua`, `nui/source/components/modals/EvidenceManager.tsx`, `EvidenceDocumentViewer.tsx`.

What it does:

- Officer staging area.
- Attach staged evidence to case.
- Custody chain support.
- Document/forensic viewer on evidence open.

How to use:

- Collect/bag -> stage -> attach to case.
- Open evidence in case view to inspect details.

## 7) Person and vehicle records

Main files: `PersonSearch.tsx`, `VehicleSearch.tsx`.

What it does:

- Search person/vehicle records.
- Open related records and actions.
- Notes tabs for person and vehicle profiles.

Where notes are visible:

- Person notes: `Person Search` -> `[NOTES]` tab.
- Vehicle notes: `Vehicle Search` -> `[NOTES]` tab.

## 8) BOLO and warrants

Main files: `BoloManager.tsx`, `PoliceDashboard.tsx`.

What it does:

- Create and manage BOLO entries.
- Issue/cancel warrants.
- Open linked person/vehicle search directly from BOLO and owner actions.

## 9) Police dashboard and jail log hook

Main files: `server/police.lua`, `PoliceDashboard.tsx`.

What it does:

- Arrest/warrant/impound management.
- Jail transfer log (record-only workflow).
- Hook/event for external jail systems.

Available integrations:

- Callback: `cad:police:logJailTransfer`
- Callback: `cad:police:getJailTransfers`
- Export: `LogJailTransfer`
- Export: `GetJailTransfers`
- Event hook: `cad:hook:jailTransferLogged`
- Event hook: `cad:server:jailTransferLogged`

## 10) Localization

Main files: `nui/source/locales/en.json`, `nui/source/utils/i18n.ts`.

What it does:

- English-first string loading from JSON.
- `t('path.to.key')` resolver with fallback.

How to use:

- Add keys to `en.json`.
- Replace hardcoded UI text with `t(...)` in components.

## 11) Build output

Main file: `nui/vite.config.ts`.

Current behavior:

- Single, stable output in `build/`.
- Non-hashed asset names.
- `fxmanifest.lua` points to `build/index.html`.

## 12) Mock mode (browser dev)

Main file: `nui/source/mocks/mockNUI.ts`.

What it does:

- Simulates NUI callbacks in browser.
- Includes mock handlers for cases, dispatch, forensics, EMS blood, and jail log.

How to use:

- Start NUI in browser dev mode.
- Use mock data to test screens and flow without FiveM runtime.

GOOD LUCK!
