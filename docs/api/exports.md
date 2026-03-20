# Exports Reference

The CAD system exposes 40+ exports for integration with other resources. All exports are available both client-side and server-side unless noted.

## Case Management

### CreateCase

Creates a new investigation case.

```lua
-- Server-side
local case = exports['cad-system']:CreateCase(source, {
    title = 'Robbery at Fleeca Bank',        -- Required (max 255 chars)
    description = 'Armed robbery reported',   -- Optional (max 2000 chars)
    caseType = 'THEFT',                       -- Optional (default: 'GENERAL')
    priority = 1,                             -- Optional 1-5 (default: 2)
    assignedTo = 'officer_id',                -- Optional
    linkedCallId = 'CALL-001',                -- Optional
    personId = 'citizenid',                   -- Optional
    personName = 'John Doe',                  -- Optional
})

-- Returns: case object or nil
```

### GetCase

```lua
local case = exports['cad-system']:GetCase(source, caseId)
-- Returns: case object or nil
```

### UpdateCase

```lua
local updated = exports['cad-system']:UpdateCase(source, caseId, {
    title = 'Updated title',
    description = 'Updated description',
    status = 'CLOSED',
    priority = 3,
})
-- Returns: updated case object or nil
```

### CloseCase

```lua
local success = exports['cad-system']:CloseCase(source, caseId)
-- Returns: true/false
```

### SearchCases

```lua
local results = exports['cad-system']:SearchCases(source, 'search query')
-- Returns: array of matching case objects
```

## Evidence

### CreateEvidenceBag

Creates a staging evidence bag for the calling officer.

```lua
local stagingId = exports['cad-system']:CreateEvidenceBag(source, {
    evidenceType = 'PHOTO',     -- PHOTO, VIDEO, DOCUMENT, PHYSICAL, FORENSIC, DIGITAL
    data = { url = '...' },     -- Evidence-specific data
})
-- Returns: staging ID string or nil
```

### GetEvidenceById

```lua
local evidence = exports['cad-system']:GetEvidenceById(source, evidenceId)
-- Returns: evidence object or nil
```

### AttachEvidenceToCase

Moves staged evidence to a case.

```lua
local evidence = exports['cad-system']:AttachEvidenceToCase(source, stagingId, caseId)
-- Returns: evidence object with chain of custody or nil
```

## Forensics

### GetForensicData

```lua
local data = exports['cad-system']:GetForensicData(source, forensicId)
-- Returns: forensic analysis data or nil
```

### AnalyzeEvidence

```lua
local result = exports['cad-system']:AnalyzeEvidence(source, evidenceId)
-- Returns: analysis result object or nil
```

### IsPlayerInLab

Checks if a player is within a forensic lab radius.

```lua
local inLab = exports['cad-system']:IsPlayerInLab(source)
-- Returns: true/false
```

### GetLabLocations

```lua
local labs = exports['cad-system']:GetLabLocations(source)
-- Returns: array of lab location objects
```

## Dispatch

### CreateDispatchCall

```lua
local call = exports['cad-system']:CreateDispatchCall(source, {
    type = '10-50',                           -- Call type
    priority = 1,                              -- 1-3
    title = 'Traffic accident on Route 68',
    description = 'Multi-vehicle collision',
    location = 'Route 68 & Joshua Road',
    coordinates = vector3(100.0, 200.0, 30.0), -- Optional
})
-- Returns: call object or nil (nil if dispatch disabled)
```

### GetActiveCalls

```lua
local calls = exports['cad-system']:GetActiveCalls(source)
-- Returns: table of active call objects
```

### AssignUnit

```lua
local success = exports['cad-system']:AssignUnit(source, callId, unitId)
-- Returns: true/false
```

### GetUnitStatus

```lua
local unit = exports['cad-system']:GetUnitStatus(source, unitId)
-- Returns: unit object or nil
```

### SetUnitStatus

```lua
local success = exports['cad-system']:SetUnitStatus(source, unitId, 'AVAILABLE')
-- Returns: true/false
```

## Auth & Officers

### CheckPermission

```lua
local hasAccess = exports['cad-system']:CheckPermission(source, 'admin')
-- Returns: true/false
```

### GetOfficerData

```lua
local officer = exports['cad-system']:GetOfficerData(source)
-- Returns: officer data object or nil
```

### LogJailTransfer (server only)

```lua
exports['cad-system']:LogJailTransfer(source, {
    personId = 'citizenid',
    personName = 'John Doe',
    jailMonths = 12,
    charges = { 'Armed Robbery' },
    caseId = 'CASE-001',
})
```

### GetJailTransfers (server only)

```lua
local transfers = exports['cad-system']:GetJailTransfers(source)
-- Returns: array of jail transfer records
```

## Audio (client only)

```lua
exports['cad-system']:PlayPTTStart()
exports['cad-system']:PlayPTTEnd()
exports['cad-system']:PlayDispatchIncoming()
exports['cad-system']:PlayEmergencyAlert()
exports['cad-system']:PlaySuccess()
exports['cad-system']:PlayError()
```
