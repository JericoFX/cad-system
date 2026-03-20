# Profiles

The CAD system supports three profiles to control which features are active. Set via the `CAD_PROFILE` convar.

## Simple Profile

```ini
set CAD_PROFILE "simple"
```

Designed for basic police departments. Disables advanced modules:

| Feature | Status |
|---------|--------|
| Cases | Enabled |
| EMS | Enabled |
| News | Enabled |
| Map | Enabled |
| Dispatch | **Disabled** |
| Security Cameras | **Disabled** |
| Forensics | **Disabled** |
| Radio | **Disabled** |

Additional changes:
- Evidence storage forced to `state` mode
- Virtual containers enabled
- News publishes without confirmation

## Full Profile

```ini
set CAD_PROFILE "full"
```

Enables **all** features with their default configuration. Intended for servers that want the complete CAD experience.

## Custom Profile

```ini
set CAD_PROFILE "custom"
```

Uses whatever values you set in `config.lua` without any overrides. Full control over each feature flag.

## Profile Matrix

| Feature | Simple | Full | Custom |
|---------|--------|------|--------|
| Cases | Yes | Yes | Configurable |
| Dispatch | No | Yes | Configurable |
| EMS | Yes | Yes | Configurable |
| Forensics | No | Yes | Configurable |
| Security Cameras | No | Yes | Configurable |
| News | Yes | Yes | Configurable |
| Map | Yes | Yes | Configurable |
| Radio | No | Yes | Configurable |
| Evidence Virtual Containers | Yes | Yes | Configurable |
