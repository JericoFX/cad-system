# Getting Started

CAD System is a **Computer Aided Dispatch** resource for FiveM built on **QBCore**, **ox_lib**, and **oxmysql**. The frontend uses **SolidJS** with a hacker-terminal aesthetic.

## Requirements

| Dependency | Version | Required |
|-----------|---------|----------|
| [QBCore](https://github.com/qbcore-framework) | v1.0+ | Yes |
| [ox_lib](https://github.com/overextended/ox_lib) | Latest | Yes |
| [oxmysql](https://github.com/overextended/oxmysql) | Latest | Yes |
| [ox_inventory](https://github.com/overextended/ox_inventory) | Latest | Optional (forensics, ID reader) |
| [ox_target](https://github.com/overextended/ox_target) | Latest | Optional (world interactions) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Lua 5.4 (FiveM Cerulean) |
| Database | MySQL (via oxmysql) |
| Frontend (NUI) | SolidJS + TypeScript + Vite |
| Styling | SCSS modular architecture |
| Maps | Leaflet.js |
| Package Manager | Bun |

## Quick Start

1. Clone the resource into your `resources/` folder
2. Install NUI dependencies and build:
   ```bash
   cd "source NUI"
   bun install
   bun run build
   ```
3. Add to your `server.cfg`:
   ```ini
   ensure ox_lib
   ensure oxmysql
   ensure cad-system
   ```
4. Configure convars (see [Configuration](/guide/configuration))
5. Restart the server — database tables are created automatically

## Project Structure

```
cad-system/
  config.lua              # Main configuration
  fxmanifest.lua          # Resource manifest
  client/                 # Client-side Lua scripts
    app/                  # NUI lifecycle & communication
    actions/              # Player actions (evidence, photos, forensics)
    core/                 # Framework integration (QBCore)
  server/                 # Server-side Lua scripts
    actions/              # Business logic (cases, dispatch, police, EMS)
    auth/                 # Authentication & authorization
    infra/                # Database, utilities, exports
  shared/                 # Shared catalogs and type definitions
  source NUI/             # Frontend source (SolidJS + TypeScript)
    source/               # TypeScript source code
      components/         # UI components & modals
      stores/             # Reactive stores (state management)
      handlers/           # NUI event handlers
      commands/           # Terminal command builders
  nui/build/              # Built NUI output (generated)
  addons/                 # Framework integrations (GCPhone)
  items/                  # Item definitions for ox_inventory
  docs/                   # This documentation (VitePress)
```
