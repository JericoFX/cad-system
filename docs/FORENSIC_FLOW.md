# Forensic Evidence Flow Documentation

## Roleplay (RP) Flow

### Crime Occurrence
1. **Violent Incident**
   - Player takes damage >5 (assault/shooting)
   - Blood evidence spawns at victim's location (visible via UV light)
   - If crime context detected (active dispatch call/wanted player):
     - Fingerprint evidence left on vehicle doors when entering/exiting
     - Bullet casings spawn near shooter after gunfire

2. **Evidence Discovery**
   - Responding officers use **UV Flashlight** (`uv_flashlight` item):
     - Reveals hidden blood evidence (cyan glow)
     - Progress bar shows while scanning area
   - For vehicles involved in crime:
     - Use **Fingerprint Powder** (`fingerprint_powder`):
       - Reveals latent prints on doors/seats
       - Progress bar with dusting animation

3. **Evidence Collection**
   - **Blood Samples**:
     - Target blood evidence → Use **Forensic Kit** (`forensic_kit`)
     - 5-second progress bar for collection
   - **Fingerprints**:
     - Target revealed prints → Use **Fingerprint Tape** (`fingerprint_tape`)
     - 8-second lifting process
   - **Bullet Casings**:
     - Target casing → Use **Forensic Kit**
     - 3-second collection

4. **Photographic Documentation**
   - Use **Evidence Camera** (`police_camera`):
     - Activate with `/camera` command
     - Adjust FOV (20°-90°) via scroll wheel
     - Focus distance adjustment with Ctrl+Scroll
     - Nighttime flash automatically activates (creates point light)
     - Press E to capture with metadata:
       - GPS coordinates
       - Timestamp
       - Officer ID

5. **Evidence Destruction** (Optional)
   - Criminals can use **Hydrogen Peroxide** (`hydrogen_peroxide`):
     - 3-second cleaning process for blood evidence
     - Progress bar with broom animation

---

## CAD System Flow

### 1. Evidence Staging
- Collected evidence appears in **Evidence Manager**:
  - Access via `/evidence` command
  - Staged items visible under "STAGING" tab
  - Right panel shows:
    - Evidence type
    - Collection timestamp
    - URL preview (for photos)
    - Collection notes

### 2. Case Attachment
- Select target case from dropdown
- Click evidence → **[ATTACH TO CASE]** button
- Evidence moves to case's evidence tab
- Automatic chain of custody entry created:
  ```
  [TRANSFERRED] From: OFFICER-123 → To: CURRENT_OFFICER
  Location: Mission Row PD
  ```

### 3. Analysis Workflow
- **Blood Analysis**:
  - Submit to forensic lab (Mission Row/Pillbox)
  - 45-second processing time
  - Results include:
    - Blood type (A+, O-, etc.)
    - DNA hash (32-character code)
    - Quality percentage (decays over time)

- **Fingerprint Analysis**:
  - Compare against database
  - Results show pattern type (loop/whorl/arch)
  - Confidence percentage based on quality

### 4. Case Integration
- Analyzed evidence appears in case notes:
  ```
  [EVIDENCE ANALYSIS COMPLETE]
  Blood Type: O+
  DNA Match: 92% confidence to CITIZEN-789
  ```
- Photo evidence embedded in case timeline
- Chain of custody fully tracked for court admissibility

### 5. Quality Decay System
- **Visibility Decay**:
  - Blood becomes harder to detect after 30 minutes
  - Fingerprints fade after 2 hours
- **Data Quality Decay**:
  - DNA match confidence decreases after 1 hour
  - Fingerprint pattern clarity degrades after 4 hours
- **Rain Effects**:
  - Blood evidence destroyed after 1 minute in rain

---

## Key Commands & Shortcuts
| Action | Command/Key | Notes |
|--------|-------------|-------|
| Open Evidence Manager | `/evidence` | Requires police/sheriff job |
| Activate Camera | `/camera` | FOV adjustment via scroll |
| UV Flashlight Scan | Use `uv_flashlight` item | Reveals blood evidence |
| Fingerprint Dusting | Use `fingerprint_powder` | Reveals latent prints |

> **Note**: All evidence has 30-minute TTL by default (configurable in `config.lua` under `Forensics.WorldTraceTTLSeconds`)