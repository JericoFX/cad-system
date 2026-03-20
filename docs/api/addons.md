# Addons

The CAD system supports addon integrations for external resources.

## GCPhone Integration

Built-in addon at `addons/gcphone.lua`:

- **Phone lookup** — Search phone records from within CAD
- Requires GCPhone resource to be running

## Creating Addons

Addons integrate via exports and events.

### Using Exports

```lua
-- In your resource
local case = exports['cad-system']:CreateCase(source, {
    title = 'Auto-generated case',
    caseType = 'GENERAL',
    priority = 2,
})

if case then
    print('Created case: ' .. case.caseId)
end
```

### Listening to Events

```lua
-- In your resource's server script
AddEventHandler('cad:api:case:created', function(caseObj)
    print('New case created: ' .. caseObj.title)
end)

AddEventHandler('cad:api:dispatch:created', function(call)
    -- Auto-notify Discord, etc.
end)
```

### Dispatch Integration Example

```lua
-- Create a dispatch call from another resource
RegisterNetEvent('myresource:robbery', function()
    local source = source
    local coords = GetEntityCoords(GetPlayerPed(source))

    exports['cad-system']:CreateDispatchCall(source, {
        type = '10-31',
        priority = 1,
        title = 'Bank Robbery in Progress',
        description = 'Silent alarm triggered',
        location = 'Fleeca Bank, Route 68',
        coordinates = coords,
    })
end)
```

### Evidence Ingestion

External resources can create evidence:

```lua
-- Ingest evidence from another forensics resource
local stagingId = exports['cad-system']:CreateEvidenceBag(source, {
    evidenceType = 'FORENSIC',
    data = {
        type = 'DNA',
        result = 'Match found',
        confidence = 0.95,
    },
})

-- Attach to a case
exports['cad-system']:AttachEvidenceToCase(source, stagingId, 'CASE-001')
```

### Permissions Check

```lua
-- Check if a player has CAD access
local hasAccess = exports['cad-system']:CheckPermission(source, 'default')

-- Check for admin access
local isAdmin = exports['cad-system']:CheckPermission(source, 'admin')
```

## Frontend Integration

See `addons/INTEGRACION_FRONTEND.md` for details on integrating custom NUI components.
