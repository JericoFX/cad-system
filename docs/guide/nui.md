# NUI (Frontend)

The NUI is built with **SolidJS** + **TypeScript** + **Vite** and uses a hacker-terminal aesthetic.

## Building

```bash
cd "source NUI"
bun install
bun run build      # Production build -> nui/build/
bun run dev        # Dev server with hot-reload (browser mode)
bun run typecheck  # TypeScript validation
bun run lint       # ESLint check
```

## UI Modes

### Terminal Mode
The main interface — a full-screen terminal with command palette, modals, and system components.

### Vehicle Dock Mode
A compact floating overlay for in-vehicle use. Activated when using the vehicle tablet feature. Shows quick actions and search.

### Boot Screen
An animated system boot sequence shown on first open. Displays system initialization steps.

## Command System

The terminal supports commands entered via an input prompt. Commands are registered through the command builder system:

```
> case create "Robbery at Fleeca" --type THEFT --priority 1
> dispatch assign CALL-001 UNIT-A1
> search person "John Doe"
> evidence list CASE-001
```

Commands are defined in `source/commands/` with categories: case, dispatch, evidence, ems, police, search, radio, news, notes, and more.

## Communication with FiveM

The NUI communicates with the client Lua via `fetchNui()`:

```typescript
// source/utils/fetchNui.ts
const result = await fetchNui('cad:action:name', { payload })
```

This maps to a NUI callback registered in `client/app/nui.lua`.

## Browser Development Mode

Set `VITE_USE_MOCK_DATA=true` in `.env` to enable browser-based development with mock data. The mock system in `source/mocks/` simulates all server responses.

::: warning
Ensure `VITE_MOCK_BYPASS_ROLE_GUARDS=false` in production builds.
:::

## Key Components

| Component | File | Description |
|-----------|------|-------------|
| Terminal | `Terminal.tsx` | Main terminal UI with command input |
| DockLauncher | `DockLauncher.tsx` | Minimizable quick-action panel |
| BootScreen | `BootScreen.tsx` | Animated boot sequence |
| Map | `Map.tsx` | Leaflet.js map with markers |
| ModalHost | `modals/ModalHost.tsx` | Modal rendering system |
| SessionContextBar | `SessionContextBar.tsx` | Current session info display |

## Modals

29+ modals handle specific workflows:

- **CaseManager / CaseCreator** — Case CRUD
- **DispatchTable** — Dispatch call management
- **EvidenceManager / EvidenceUploader** — Evidence workflows
- **ArrestForm / ArrestWizard** — Arrest processing
- **ForensicCollection** — Forensic sample collection
- **PersonSearch / VehicleSearch** — Database lookups
- **PoliceDashboard / EMSDashboard** — Department dashboards
- **FineManager** — Citation management
- **RadioPanel / RadioMarkers** — Radio system
- **MapModal** — Full map view
- **ImageViewer / MediaPlayer** — Media preview
