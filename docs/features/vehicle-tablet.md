# Vehicle Tablet

In-vehicle computer for plate lookups, person searches, and quick CAD access.

## Overview

The vehicle tablet provides a compact CAD interface accessible from the driver/passenger seat of police vehicles.

## Features

- **Plate lookup** — Scan front/rear plates of nearby vehicles
- **Person search** — Quick person database search
- **ID reader** — Read ID cards inserted into the vehicle reader slot
- **Quick Dock** — Minimized floating panel with common actions

## Configuration

```lua
CAD.Config.Forensics.IdReader.VehicleTablet = {
    Enabled = true,
    RequireFrontSeat = true,          -- Must be in front seat
    Slots = 2,                        -- ID reader slots
    ReadSlot = 1,                     -- Which slot to read
    QuickDockEnabled = true,
    QuickDockLockKey = 'K',           -- Lock dock position
    QuickDockToggleKey = 'U',         -- Toggle dock visibility
    StrictAllowedItems = false,
    AllowedJobs = { 'police', 'sheriff' },
    PoliceModels = {},                -- Empty = all vehicles
    AllowedItems = {
        'id_card', 'driver_license', 'passport',
        'vehicle_registration', 'vehicle_registration_card',
    },
}
```

## Data Source

Vehicle and person lookups query the QBCore database:

```lua
DataSource = {
    PlayersTable = 'players',
    PlayersCitizenColumn = 'citizenid',
    PlayersCharinfoColumn = 'charinfo',
    PlayersMetadataColumn = 'metadata',
    PlayerVehiclesTable = 'player_vehicles',
    PlayerVehiclesPlateColumn = 'plate',
    PlayerVehiclesOwnerColumn = 'citizenid',
}
```

## UI Modes

- **VehicleCAD** modal — Full vehicle computer interface
- **VehicleQuickDock** — Floating compact panel
- **VehicleSearch** modal — Detailed search results
