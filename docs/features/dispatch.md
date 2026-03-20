# Dispatch

Real-time dispatch system with SLA tracking, auto-assignment, and unit management.

## Overview

- **Create** dispatch calls with type, priority, and location
- **Assign** units to calls manually or via auto-assignment
- **Track** SLA timers with warning and breach thresholds
- **Monitor** unit positions in real-time (grid-based)
- **Manage** unit statuses (AVAILABLE, EN_ROUTE, ON_SCENE, BUSY)

## SLA (Service Level Agreement)

Each call has timed escalation based on priority:

| Stage | P1 Warning | P1 Breach | P2 Warning | P2 Breach | P3 Warning | P3 Breach |
|-------|-----------|-----------|-----------|-----------|-----------|-----------|
| Pending | 2 min | 4 min | 4 min | 8 min | 6 min | 12 min |
| Active | 8 min | 15 min | 10 min | 20 min | 12 min | 25 min |

## Auto-Assignment Algorithm

When enabled, the system scores available units based on:

1. **Distance** to call location (70 meters per penalty point)
2. **Service match** (EMS needed but unit is police = +40 penalty)
3. **Unknown position** penalty (unit with no GPS = +15 penalty)

Lowest score wins the assignment.

## Easy Mode Presets

| Preset | Refresh | Clock Tick | Pending Warn | Pending Breach |
|--------|---------|-----------|--------------|----------------|
| Relaxed | 10s | 20s | 6 min | 12 min |
| Standard | 8s | 15s | 4 min | 8 min |
| Strict | 6s | 10s | 2 min | 5 min |

## Call Types

Default types (configurable): `GENERAL`, `10-31`, `10-50`, `10-71`, `MEDICAL`

## Terminal Commands

```
> dispatch list
> dispatch create "10-50 at Legion Square" --type 10-50 --priority 1
> dispatch assign CALL-001 UNIT-A1
> dispatch close CALL-001
> status set AVAILABLE
```

## Unit Status Flow

```
AVAILABLE --> EN_ROUTE --> ON_SCENE --> BUSY --> AVAILABLE
                                  |
                                  +--> (call closed) --> AVAILABLE
```
