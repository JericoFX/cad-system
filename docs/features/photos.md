# Photo System

Evidence and news photography with multi-provider upload support.

## Camera Types

| Item | Label | Jobs | Purpose |
|------|-------|------|---------|
| `police_camera` | Evidence Camera | police, sheriff, admin | Evidence photography with GPS/FOV metadata |
| `news_camera` | Press Camera | reporter, weazelnews, admin | News photography |

## Photo Capture

1. Use camera item from inventory
2. Enter first-person camera mode with FOV indicator
3. Capture photo — records:
   - Image data (uploaded to configured provider)
   - GPS coordinates
   - FOV information
   - Nearby entity info (if `RecordEntityInfo = true`)
4. Photo enters staging for review

## Upload Providers

| Provider | Config Key | Supports |
|----------|-----------|----------|
| FiveManage | `fivemanage` | Images, audio |
| Medal | `medal` | Video |
| Discord | `discord` | Images |
| Custom | `custom` | Any (bring your own endpoint) |

Upload method per media type is configurable:

```lua
Upload = {
    MethodByType = {
        image = 'server_proxy',    -- Upload via server
        video = 'medal',           -- Direct client upload
        audio = 'fivemanage',      -- Upload via server
    },
}
```

## Photo Release

Photos captured with the evidence camera require rank-based approval before release:

```lua
CAD.Config.PhotoSystem.ReleaseRanks = {
    police = 3,   -- Rank 3+ can release photos
    sheriff = 3,
}
```

## Configuration

```lua
CAD.Config.PhotoSystem = {
    MaxPhotosPerPlayer = 100,
    AutoDeleteLocal = true,
    RetentionDays = 30,
    FOV = {
        MaxDistance = 50.0,
        ShowMarker = true,
        RecordEntityInfo = true,
    },
    Animations = {
        Scenario = 'WORLD_HUMAN_PAPARAZZI',
        Duration = 2000,
    },
}
```
