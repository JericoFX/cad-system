# Evidence & Forensics

Comprehensive evidence management with chain of custody, forensic analysis, and toxicology.

## Evidence System

### Staging Workflow

1. **Create** evidence bag (staged per officer)
2. **Collect** evidence data (photos, descriptions, metadata)
3. **Attach** to a case (moves from staging to case evidence)
4. **Track** chain of custody (every transfer logged)

### Virtual Containers

Physical evidence lockers at terminal locations. Configurable per access point:

```lua
evidenceContainer = {
    enabled = true,
    stashId = 'cad_evidence_mrpd_frontdesk',
    slots = 200,
    weight = 500000,
    shared = true,
}
```

### Evidence Types

| Type | Description |
|------|-------------|
| PHOTO | Photographic evidence |
| VIDEO | Video evidence |
| AUDIO | Audio recording |
| DOCUMENT | Written documents |
| PHYSICAL | Physical items |
| FORENSIC | Forensic samples |
| DIGITAL | Digital evidence |

## Forensics

### Blood Analysis

1. Collect blood sample at scene (creates world trace)
2. Bring sample to forensic lab
3. Run analysis (configurable duration, default 45s)
4. Results include toxicology data if present

### Toxicology

Tracks substance use via item consumption:

```lua
CAD.Config.Forensics.Toxicology.TrackedItems = {
    weed_joint = { substance = 'THC', windowMs = 1800000, severity = 'LOW' },
    cocaine_baggy = { substance = 'COCAINE', windowMs = 2700000, severity = 'HIGH' },
    meth_baggy = { substance = 'METHAMPHETAMINE', windowMs = 3600000, severity = 'HIGH' },
}
```

Each substance has a detection window. Blood analysis during that window reveals the substance.

### World Traces

Evidence left at crime scenes (blood, fingerprints, casings):

| Trace Type | Created By | Visible To |
|-----------|-----------|-----------|
| Blood | Player damage events | police, sheriff, csi |
| Fingerprint | Player interactions | police, sheriff, csi |
| Casing | Weapon discharge | police, sheriff, csi |

Traces decay after `WorldTraceTTLSeconds` (default: 1800s / 30 min).

### Forensic Labs

Physical locations where analysis is performed:

```lua
CAD.Config.ForensicLabs.Locations = {
    { name = 'Mission Row Lab', coords = vector3(483.2, -988.3, 24.9), jobs = { 'police', 'sheriff', 'csi' } },
    { name = 'Pillbox Lab', coords = vector3(343.4, -1398.7, 32.5), jobs = { 'ambulance', 'ems' } },
}
```

## Terminal Commands

```
> evidence list CASE-001
> evidence attach STAGE-001 CASE-001
> evidence view EVID-001
> forensic analyze BLOOD-001
> forensic lab status
```
