# Security Cameras

Deployable CCTV camera system with configurable field of view and job-based access.

## Overview

Officers can install, view, and manage security cameras at locations around the map.

## Configuration

```lua
CAD.Config.SecurityCameras = {
    Enabled = true,
    MaxInstallDistance = 12.0,        -- Max placement distance
    MinFov = 20.0,                   -- Minimum field of view
    MaxFov = 90.0,                   -- Maximum field of view
    DefaultFov = 55.0,               -- Default FOV
    RotationSpeed = 45.0,            -- Degrees per second
    PitchMin = -80.0,                -- Min pitch angle
    PitchMax = 25.0,                 -- Max pitch angle
    PlacementModel = 'prop_cctv_cam_01a',
    AllowedJobs = {
        police = true,
        sheriff = true,
        dispatch = true,
        admin = true,
    },
}
```

## Features

- **Install** cameras at any location within range
- **View** live camera feed with pan/tilt controls
- **Adjust** FOV dynamically
- **Remove** cameras when no longer needed
- **Persist** camera positions across server restarts
- **Job-restricted** access per camera or globally
