# CAD System – JericoFX Version

First of all, "¿Why this code looks old? or ¿Why is a mix of a lot of stuff?. simple, i was developing this from a looooong time ago.
A CAD for FiveM servers that actually roleplay serious.

Police, EMS, Forensics.  
From a fixed terminal in game. Not from magic floating menu in space.

Created by JericoFX  
License: GPL v3 (if you touch it, share it)

---

## What is this?

This is the operational brain of the server.

It let you:

- Manage dispatch without opening 20 random menus.
- Create cases and not forget them in the void.
- Search persons and vehicles fast.
- Store real evidence (photo, video, audio).
- Do forensic work without `/command simulator` vibe.
- Handle EMS blood workflow.
- Track toxicology windows from item use.
- Manage fines.
- Jail transfer logs.
- News module.
- Mock mode so you can develop without server running.

It is made for real RP flow.  
Not for Excel simulator.

---

## What is included (no marketing talk)

- Case management (create, search, update, close)
- Dispatch board with unit assign and status
- Person / vehicle search
- Evidence staging system
- World forensic traces (proximity based)
- EMS dashboard + blood analysis
- Toxicology tracking using QBCore metadata
- CCTV deployable cameras
- Fines system
- Jail transfer hook
- News module
- NUI mock system

If you dont need a module, disable it. Simple.

---

## Dependencies

Required:

- ox_lib
- oxmysql

Recommended (feature-dependent):

- ox_inventory

Optional:

- ox_target

Framework supported: QBCore only

No ESX "yet".  

---

## Install

1. Put cad-system inside resources.
2. Ensure dependencies before it.
3. Add ensure cad-system
4. Restart server.
5. If broken, check what you did.

---

## NUI Build

Uses Bun + Vite.

cd cad-system/nui  
bun install  
bun run typecheck  
bun run build  

Build output is clean. No random hashed names.

---

## Basic Config

Main file: config.lua

Framework:

Framework = {
    Preferred = 'qb-core'
}

Yes, qb-core.

---

## Profiles (`CAD_PROFILE`)

You can switch behavior by profile from `server.cfg`:

set CAD_PROFILE simple

Available values:

- `simple`
- `full`
- `custom`

What each one means:

- `simple`: Cases + Evidence + Map + EMS + News. Dispatch/Radio/Forensics/CCTV off.
- `full`: all modules enabled.
- `custom`: manual control from `CAD.Config.Features`.

Simple profile also enforces:

- `CAD.Config.Evidence.StorageMode = 'state'`
- `CAD.Config.Evidence.UseVirtualContainer = true`
- `CAD.Config.News.PublishWithoutConfirm = true`

---

## Feature Matrix by Profile

`ON` = enabled, `OFF` = disabled.

| Feature | simple | full | custom |
|---|---|---|---|
| Cases | ON | ON | configurable |
| Evidence | ON | ON | configurable |
| Map | ON | ON | configurable |
| EMS | ON | ON | configurable |
| News | ON | ON | configurable |
| Dispatch | OFF | ON | configurable |
| Radio | OFF | ON | configurable |
| Forensics | OFF | ON | configurable |
| Security Cameras | OFF | ON | configurable |

Notes:

- In `simple`, evidence core flow is internal (`state` + virtual container), so it is not hard-coupled to external inventory.
- Some item-based integrations (camera items, ID cards, etc.) can still use `ox_inventory` depending on your setup.

---

Access:

UI = {
    Command = 'cad',
    Keybind = 'F6',
    AccessMode = 'auto'
}

You can use:

- Fixed terminals
- Job restrictions
- ID reader
- Evidence stash

Its not magic, configure it.

---

## Toxicology system

When a tracked item is used:

- It create a toxicology window
- It store inside QBCore metadata
- It replicate to statebag
- When blood sample is created, snapshot is frozen

No extra SQL table for that.  
Clean and simple.

---

## Forensic world traces

Normal gameplay flow:

1. Another resource create trace.
2. Officer walk near it.
3. Prompt appear.
4. Evidence bagged.
5. Goes to staging.
6. Attached to case.

There is debug command but thats only for testing.

---

## CCTV item

security_camera item allow you deploy camera.

In dispatch grid you get:

- VIEW
- ENABLE
- DISABLE
- REMOVE

Its not decorative. It works.

---

## Jail transfer hook

You can connect prison resource without hard dependency.

Exports and events included.

No forced coupling.

---

## Database

Auto created.

Main tables:

- cad_cases
- cad_case_notes
- cad_evidence
- cad_dispatch_calls
- cad_fines
- cad_ems_alerts
- cad_ems_blood_requests

Toxicology use metadata. Not SQL.

---

## Media capture

Supports:

- screenshot-basic
- FiveManage
- Medal
- Custom endpoint

Config inside server.cfg:

set CAD_MEDIA_SERVICE fivemanage
set CAD_MEDIA_API_KEY your_key
set CAD_MEDIA_UPLOAD_URL ""

If upload not working, check your API.  
Dont blame the CAD first.

---

## If something not working

Before writing “doesnt work”:

- Check job permissions
- Check AccessPoints
- Rebuild NUI
- Verify ox_inventory items
- Confirm you are using QBCore

Most issues are config.

---

## Philosophy

This is not a pretty menu.

Its a tool for servers that want:

- Clean operational flow
- Real integration
- Modular design
- No useless tables
- No hidden dependencies

### If you modify it, respect GPL.  

## If your PD still chaos after this… problem is not the code.
