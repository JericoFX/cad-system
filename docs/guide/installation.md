# Installation

## 1. Download & Place

Place the `cad-system` folder in your server's `resources/` directory (or a subfolder like `resources/[police]/`).

## 2. Build the NUI

The frontend must be compiled before use:

```bash
cd "source NUI"
bun install
bun run build
```

This outputs production-ready files to `nui/build/`.

::: tip
You can also use `bun run dev` during development for hot-reload in browser mode.
:::

## 3. Server Configuration

Add to your `server.cfg`:

```ini
# Required dependencies
ensure ox_lib
ensure oxmysql

# Optional
ensure ox_inventory    # For forensic items and ID reader stash
ensure ox_target       # For world trace interactions

# CAD System
ensure cad-system

# Convars (set BEFORE ensure)
set CAD_PROFILE "full"
set CAD_MEDIA_SERVICE "fivemanage"
set CAD_MEDIA_API_KEY "your-api-key-here"
```

## 4. Database

Tables are created **automatically** on first start via `CREATE TABLE IF NOT EXISTS`. No manual SQL is needed.

Tables created:
- `cad_cases` — Investigation cases
- `cad_case_notes` — Case notes and updates
- `cad_case_tasks` — Case task tracking
- `cad_evidence` — Evidence records with chain of custody
- `cad_evidence_custody` — Custody transfer log
- `cad_dispatch_calls` — Dispatch call history
- `cad_fines` — Fines and citations
- `cad_jail_transfers` — Jail transfer records
- `cad_forensics` — Forensic analysis data
- `cad_security_cameras` — Camera positions
- `cad_photos` — Photo metadata
- `cad_news` — News articles
- `cad_ems_alerts` — EMS medical alerts
- `cad_audit_log` — Audit trail
- `cad_virtual_containers` — Virtual evidence containers

## 5. Item Setup (Optional)

If using `ox_inventory`, add forensic items from `items/forensic_items.lua` to your inventory configuration. Camera items are defined in `config.lua` under `PhotoItems`.

## 6. Verify

1. Start the server and check for `[CAD:SUCCESS] Bootstrap loaded` in console
2. Join and use `/cad` or press `F6` (default keybind)
3. Ensure your job is in the `AllowedJobs` list in `config.lua`
