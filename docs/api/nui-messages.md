# NUI Messages

The frontend communicates with the client Lua via the NUI message system.

## Message Format

All NUI messages follow this pattern:

```typescript
// Frontend -> Client (via fetchNui)
const result = await fetchNui('cad:action:name', {
    key: 'value',
})

// Client -> Frontend (via SendNUIMessage)
SendNUIMessage({
    type = 'cad:event:name',
    payload = { ... },
})
```

## Handler Groups

NUI message handlers are organized by module in `source/handlers/`:

| Handler File | Handles |
|-------------|---------|
| `cadHandlers.ts` | Core state sync, visibility, app lifecycle |
| `caseHandlers.ts` | Case CRUD responses |
| `dispatchHandlers.ts` | Dispatch call and unit updates |
| `evidenceHandlers.ts` | Evidence staging and attachment |
| `emsHandlers.ts` | EMS alerts and unit updates |
| `fineHandlers.ts` | Fine creation and updates |
| `forensicsHandlers.ts` | Forensic analysis results |
| `securityCameraHandlers.ts` | Camera install/remove/view |
| `photoHandlers.ts` | Photo capture and staging |
| `vehicleHandlers.ts` | Vehicle tablet data |

## Store Updates

Each handler updates its corresponding SolidJS store, which triggers reactive UI updates:

```typescript
// Example: cadHandlers.ts
registerHandler('cad:state:sync', (payload) => {
    setCadStore('cases', payload.cases)
    setCadStore('calls', payload.calls)
    setCadStore('fines', payload.fines)
})
```

## Browser Mode

In browser development mode (`VITE_USE_MOCK_DATA=true`), the mock system intercepts `fetchNui()` calls and returns simulated responses. Scenarios can be loaded from `source/mocks/scenarios/`.
