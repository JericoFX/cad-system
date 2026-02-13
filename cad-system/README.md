# CAD System

Simple CAD/MDT resource for FiveM.

## What it does

- Cases: create, update, close, and search.
- Dispatch: calls, unit assignment, status tracking, and live updates.
- EMS: units, alerts, blood request workflow.
- Evidence: stage evidence and attach it to cases.
- Person/vehicle lookup and warrants/records views.
- Fines and ticket payment flow.
- News module with draft/publish flow.

## Requirements

- `ox_lib`
- `oxmysql`
- `ox_inventory`

Optional:

- `ox_target` (for target-based terminal access)

## Install

1. Place the resource folder in your server resources.
2. Ensure dependencies are started first.
3. Add this resource to your server start list.
4. Restart the server.

## Basic configuration

Main config file: `config.lua`

### Framework

Set framework adapter:

```lua
Framework = {
    Preferred = 'auto' -- auto | qbox | qb-core | esx | standalone
}
```

### CAD access

```lua
UI = {
    Command = 'cad',
    Keybind = 'F6',
    AccessMode = 'auto' -- auto | zone | target
}
```

Use `AccessPoints` to define in-world terminals and job access.

### Dispatch quick setup

Use the easy preset:

```lua
Dispatch = {
    Easy = {
        Preset = 'standard' -- relaxed | standard | strict
    }
}
```

### Blood workflow behavior

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
```

If your resource name is not `cad-system`, replace it in the export string.

## ID Reader setup

ID Reader is terminal-based and reads document metadata from stash items.

Example inside one access point:

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

## Database tables

Created automatically by `server/database.lua`:

- `cad_cases`
- `cad_case_notes`
- `cad_case_tasks`
- `cad_evidence`
- `cad_dispatch_calls`
- `cad_fines`
- `cad_ems_alerts`
- `cad_ems_blood_requests`

## Notes

- Dispatch can be enabled for EMS with `Dispatch.AllowEMSControl`.
- Feature visibility can be controlled in `Features` section.
- For custom images/docs in README, add your screenshots later.
