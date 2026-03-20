# Radio & Map

## Radio System

Channel-based radio management for coordinating units.

### Features

- **Channel management** — Join/leave radio channels
- **Radio markers** — Place markers visible to channel members
- **PTT sounds** — Audio cues for push-to-talk start/end

### Components

| Component | Description |
|-----------|-------------|
| RadioPanel | Channel list, join/leave, active users |
| RadioMarkers | Map markers shared across radio channel |

### Sound Exports

```lua
exports['cad-system']:PlayPTTStart()          -- PTT key pressed
exports['cad-system']:PlayPTTEnd()            -- PTT key released
exports['cad-system']:PlayDispatchIncoming()  -- Incoming dispatch
exports['cad-system']:PlayEmergencyAlert()    -- Emergency alert
exports['cad-system']:PlaySuccess()           -- Success sound
exports['cad-system']:PlayError()             -- Error sound
```

## Map

Interactive map powered by Leaflet.js showing:

- **Unit positions** — Real-time GPS of active units
- **Dispatch calls** — Call locations with priority indicators
- **Radio markers** — Markers placed by radio channel members
- **Blips** — Configurable map markers

### Configuration

```lua
CAD.Config.Features.Map = {
    Enabled = true,
    ShowInUI = true,
}
```

The map component uses the GTA V map tile overlay with Leaflet.js for interactivity.
