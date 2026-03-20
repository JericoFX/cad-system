# EMS Module

Emergency Medical Services management with alerts, units, and blood requests.

## Overview

- **Medical alerts** with configurable TTL (default 30 min)
- **Unit status** tracking (AVAILABLE, EN_ROUTE, ON_SCENE, TRANSPORTING, AT_HOSPITAL, BUSY)
- **Blood requests** for forensic analysis
- **Dashboard** with active alerts and unit overview

## Unit Statuses

| Status | Description |
|--------|-------------|
| AVAILABLE | Ready for assignment |
| EN_ROUTE | Traveling to scene |
| ON_SCENE | At the scene |
| TRANSPORTING | Transporting patient |
| AT_HOSPITAL | At hospital |
| BUSY | Unavailable |

## EMS Dashboard

The EMSDashboard modal provides:
- Active medical alerts with location
- Unit status overview
- Blood request management
- Patient information display

## Configuration

```lua
CAD.Config.EMS = {
    AlertTTLSeconds = 1800,       -- 30 minutes
    UnitStatuses = {
        AVAILABLE = true,
        EN_ROUTE = true,
        ON_SCENE = true,
        TRANSPORTING = true,
        AT_HOSPITAL = true,
        BUSY = true,
    },
}
```

## Dispatch Integration

When `CAD.Config.Dispatch.AllowEMSControl = true`, EMS units can:
- View and respond to medical dispatch calls
- Update their unit status through the dispatch system
- Receive auto-assignment for medical priority calls
