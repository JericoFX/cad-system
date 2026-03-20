# Events

## Server → Client Events

These events are triggered by the server and received by clients.

| Event | Payload | Description |
|-------|---------|-------------|
| `cad:state:sync` | `{ cases, calls, fines, ... }` | Full state sync on connect |
| `cad:case:created` | `{ case }` | New case created |
| `cad:case:updated` | `{ case }` | Case updated |
| `cad:case:closed` | `{ caseId }` | Case closed |
| `cad:dispatch:call:created` | `{ call }` | New dispatch call |
| `cad:dispatch:call:updated` | `{ call }` | Call status changed |
| `cad:dispatch:unit:updated` | `{ unit }` | Unit status changed |
| `cad:evidence:attached` | `{ evidence, caseId }` | Evidence attached to case |
| `cad:ems:alert` | `{ alert }` | New EMS alert |
| `cad:ems:unit:updated` | `{ unit }` | EMS unit status changed |
| `cad:fine:created` | `{ fine }` | Fine issued |
| `cad:news:published` | `{ article }` | News article published |
| `cad:camera:installed` | `{ camera }` | Camera installed |
| `cad:camera:removed` | `{ cameraId }` | Camera removed |
| `cad:forensic:result` | `{ forensicId, result }` | Forensic analysis complete |
| `cad:photo:captured` | `{ photo }` | Photo captured |

## NUI Callbacks

These are registered in `client/app/nui.lua` and called from the frontend via `fetchNui()`.

| Callback | Direction | Description |
|----------|-----------|-------------|
| `cad:case:create` | NUI → Server | Create case |
| `cad:case:update` | NUI → Server | Update case |
| `cad:case:close` | NUI → Server | Close case |
| `cad:dispatch:create` | NUI → Server | Create dispatch call |
| `cad:dispatch:assign` | NUI → Server | Assign unit to call |
| `cad:evidence:stage` | NUI → Server | Stage evidence |
| `cad:evidence:attach` | NUI → Server | Attach evidence to case |
| `cad:search:person` | NUI → Server | Search person database |
| `cad:search:vehicle` | NUI → Server | Search vehicle database |
| `cad:vehicle:scanFront` | NUI → Client | Scan front plate |
| `cad:vehicle:scanRear` | NUI → Client | Scan rear plate |
| `cad:fine:issue` | NUI → Server | Issue fine/citation |
| `cad:police:arrest` | NUI → Server | Process arrest |
| `cad:police:jailTransfer` | NUI → Server | Log jail transfer |

## Integration Events

For addon resources to listen to:

```lua
-- Listen for case creation
AddEventHandler('cad:api:case:created', function(caseObj)
    -- Your integration code
end)

-- Listen for dispatch calls
AddEventHandler('cad:api:dispatch:created', function(call)
    -- Your integration code
end)
```
