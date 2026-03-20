# Feature Overview

The CAD system is modular — each feature can be enabled or disabled independently via `config.lua` or profiles.

## Module Map

| Module | Server Files | NUI Stores | NUI Modals | Description |
|--------|-------------|------------|------------|-------------|
| **Cases** | `cases.lua` | `cadStore` | CaseManager, CaseCreator | Investigation case lifecycle |
| **Dispatch** | `dispatch.lua` | `cadStore`, `dispatchStore` | DispatchTable | Real-time unit & call management |
| **Evidence** | `evidence.lua`, `virtual_container.lua` | `cadStore` | EvidenceManager, EvidenceUploader | Evidence staging, attachment, chain of custody |
| **Forensics** | `forensics/*` (4 files) | `cadStore` | ForensicCollection | Blood, fingerprints, casings, toxicology |
| **EMS** | `ems.lua` | `emsStore` | EMSDashboard | Medical alerts, blood requests |
| **Police** | `police.lua`, `fines.lua` | `cadStore` | PoliceDashboard, ArrestWizard, FineManager | Arrests, jail transfers, citations |
| **Cameras** | `security_cameras.lua` | `cadStore` | — | Deployable CCTV cameras |
| **News** | `news.lua` | `newsStore` | NewsManager, NewsFeed | Press articles, photo imports |
| **Photos** | `photos.lua` | `photoStore` | PhotoCapturePreview | Evidence & news photography |
| **Vehicle Tablet** | `vehicle_tablet.lua`, `id_reader.lua` | `cadStore` | VehicleCAD, VehicleSearch | In-vehicle plate/person lookup |
| **Radio** | — (NUI only) | `radioStore` | RadioPanel, RadioMarkers | Radio channel management |
| **Map** | — (NUI only) | `cadStore` | MapModal | Leaflet.js map with markers |

## Interaction Model

All modules follow the same pattern:

1. **NUI command** or **modal action** triggers `fetchNui()`
2. **Client callback** in `nui.lua` forwards to server via `lib.callback`
3. **Server handler** validates auth, processes business logic, updates state
4. **Broadcast event** pushes updated data back to all connected CAD clients
5. **Handler** in `handlers/*.ts` receives the event and updates the store
6. **SolidJS reactivity** automatically re-renders affected UI components
