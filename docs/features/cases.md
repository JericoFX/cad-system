# Cases

The case management system tracks investigations from creation to closure.

## Overview

- **Create** cases with title, description, type, and priority
- **Attach** evidence, notes, and tasks to cases
- **Assign** cases to officers
- **Link** cases to dispatch calls
- **Close** cases when resolved

## Case Types

Configurable in `config.lua`:

| Type | Description |
|------|-------------|
| GENERAL | General investigation |
| THEFT | Theft/burglary |
| ASSAULT | Assault cases |
| HOMICIDE | Homicide investigation |
| ACCIDENT | Traffic/other accidents |
| DRUGS | Drug-related |
| TRAFFIC | Traffic violations |
| DISTURBANCE | Public disturbance |
| SUSPICIOUS | Suspicious activity |
| MEDICAL | Medical incidents |

## Terminal Commands

```
> case create "Title" --type THEFT --priority 1
> case list
> case view CASE-a1b2c3d4
> case update CASE-a1b2c3d4 --status CLOSED
> case note CASE-a1b2c3d4 "Witness interviewed"
> case assign CASE-a1b2c3d4 --officer "John Smith"
```

## Case Lifecycle

```
OPEN --> (investigation) --> CLOSED
  |                           ^
  +-- Notes added             |
  +-- Evidence attached       |
  +-- Tasks completed --------+
```

## Data Model

| Field | Type | Description |
|-------|------|-------------|
| `caseId` | string | Unique ID (e.g., `CASE-a1b2c3d4`) |
| `caseType` | string | Case type from configured list |
| `title` | string | Case title (max 255 chars) |
| `description` | string | Description (max 2000 chars) |
| `status` | string | `OPEN` or `CLOSED` |
| `priority` | number | 1-5 (1 = highest) |
| `createdBy` | string | Officer identifier |
| `assignedTo` | string | Assigned officer |
| `linkedCallId` | string | Linked dispatch call ID |
| `notes` | array | Case notes |
| `evidence` | array | Attached evidence |
| `tasks` | array | Case tasks |
