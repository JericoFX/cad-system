# Plan Forense - CAD System

## Referencias
- **noobsystems/evidences**: Arquitectura moderna con state bags
- **lsn-evidence**: Arquitectura legacy (referencia)

## Arquitectura Base
- **State Bags**: Sincronización server-client sin tablas globales
- **lib.onCache**: Detección de cambios sin `while true`
- **ox_target**: Interacciones contextuales (player, vehicle_door, seat, entity)
- **AddDecal**: Visualización de sangre con decals nativos
- **Registry Pattern**: Tipos de evidencia configurables

---

## Tipos de Evidencia

### 1. SANGRE (blood)
- **Generación**: `CEventNetworkEntityDamage` cuando damage > 5
- **Ubicación**: 
  - Suelo (GetGroundZFor_3dCoord)
  - Asiento de vehículo (si está dentro)
  - Arma del atacante (si es melee)
- **Datos**: citizenid, bloodtype, DNA hash
- **Visualización**: `AddDecal()` con textura de sangre
- **Destrucción**: Lluvia automática o `hydrogen_peroxide` item

### 2. HUELLAS DACTILARES (fingerprint)
- **Generación**: 
  - Entrar/salir vehículos (`lib.onCache("seat")`)
  - Usar armas (`ox_inventory:usedItem`)
- **Ubicación**: Manija de puerta, asiento, arma
- **Check**: Verificar guantes antes de generar
- **Visualización**: Solo visible con ox_target (no marker 3D)

### 3. CASQUILLOS (magazine)
- **Generación**: `CEventGunShot` (implementar)
- **Ubicación**: Cerca del tirador
- **Visualización**: Objeto 3D en el suelo

---

## State Bags (Sincronización)

```lua
-- Jugador herido
Player(serverId).state["evidences:blood"] = {
    [citizenId] = {
        bloodType = "O+",
        dnaHash = "414243...",
        createdAt = timestamp
    }
}

-- Vehículo
Entity(vehicleNetId).state["evidences:fingerprint"] = {
    [citizenId] = {
        doorIds = { [0] = true },
        fingerprintHash = "abc123..."
    }
}
```

---

## Flujo de Generación

### Sangre
```
CEventNetworkEntityDamage
    ↓
if damage > 5 then
    ↓
TriggerServerEvent("cad:forensic:sync", "blood", victimId, "atCoords", coords)
    ↓
Server: Player(victimId).state["evidences:blood"][citizenId] = data
    ↓
Client: Crea EvidenceAtCoords con AddDecal
```

### Huellas
```
lib.onCache("seat") cambia
    ↓
if not config.isPedWearingGloves() then
    ↓
TriggerServerEvent("cad:forensic:sync", "fingerprint", playerId, "atVehicleDoor", vehicleNetId, doorId)
    ↓
Server: Entity(vehicle).state["evidences:fingerprint"][citizenId] = data
```

---

## ox_target Targets

### 1. atPlayer
Target en jugadores con evidencias en su state bag.

### 2. atVehicleDoor  
Target en puertas de vehículo con evidencias.
Bones: `door_dside_f`, `door_pside_f`, `door_dside_r`, `door_pside_r`

### 3. atVehicleSeat
Target desde dentro del vehículo (asiento actual).

### 4. atEntity
Target en entidad genérica.

### 5. atCoords
Evidencias en coordenadas (sangre en suelo).
Usar `lib.points` para zona de interacción.

---

## Creación de Items

### Items base (ox_inventory)
```lua
['forensic_kit'] = {
    label = 'Forensic Kit',
    weight = 200,
    stack = true,
    consume = 1,
    description = 'Collects blood, fingerprints',
    client = { export = 'cad-system.useForensicKit' }
},

['hydrogen_peroxide'] = {
    label = 'Hydrogen Peroxide',
    weight = 100,
    stack = true,
    consume = 1,
    description = 'Destroys evidence',
    client = { export = 'cad-system.useHydrogenPeroxide' }
}
```

### Items recolectados (creados dinámicamente)
Cuando se recolecta evidencia, se crea item con metadata:

```lua
-- Server crea item con metadata
exports.ox_inventory:AddItem(source, 'collected_blood', 1, {
    dnaHash = evidence.data.dnaHash,
    bloodType = evidence.data.bloodType,
    crimeScene = streetName,
    collectedAt = timestamp
})
```

**Nota**: Items con metadata diferente NO se pueden stackear (comportamiento de ox_inventory).

---

## Configuración de Tipos (Registry)

```lua
-- common/evidence_types.lua
return {
    blood = {
        target = {
            collect = {
                label = "Collect Blood",
                icon = "fa-solid fa-droplet",
                requiredItem = "forensic_kit",
                collectedItem = "collected_blood",
                createMetadata = function(evidenceType, data, coords)
                    return {
                        crimeScene = getStreetName(coords),
                        bloodType = data.bloodType,
                        dnaHash = data.dnaHash
                    }
                end
            },
            destroy = {
                label = "Clean Blood",
                icon = "fa-solid fa-broom",
                requiredItem = "hydrogen_peroxide"
            }
        },
        visualize = {
            show = function(point)
                -- AddDecal
                point.decal = AddDecal(1010, point.coords.x, point.coords.y, point.coords.z, ...)
            end,
            hide = function(point)
                if point.decal then RemoveDecal(point.decal) end
            end
        }
    },
    
    fingerprint = {
        target = {
            collect = {
                label = "Collect Fingerprint",
                icon = "fa-solid fa-fingerprint",
                requiredItem = "forensic_kit",
                collectedItem = "collected_fingerprint"
            }
        },
        visualize = {} -- Sin visualización 3D, solo ox_target
    }
}
```

---

## Funciones Clave

### Generar evidencia (Server)
```lua
RegisterNetEvent('cad:forensic:sync')
AddEventHandler('cad:forensic:sync', function(evidenceType, ownerId, action, ...)
    -- Guardar en state bag apropiado
    -- Broadcast a clientes cercanos
end)
```

### Cleanup automático
```lua
CreateThread(function()
    while true do
        for _, evidence in ipairs(EvidencesAtCoords) do
            if evidence.evidenceType == "blood" and evidence:isExposedToRain() then
                evidence:destroy()
            end
        end
        Wait(30000)
    end
end)
```

---

## DNA Database

```sql
CREATE TABLE cad_dna_registry (
    citizen_id VARCHAR(50) PRIMARY KEY,
    dna_hash VARCHAR(128) NOT NULL,
    fingerprint_hash VARCHAR(128),
    blood_type VARCHAR(5)
);
```

---

## Estructura de Archivos Propuesta

```
cad-system/
├── client/
│   ├── forensic/
│   │   ├── blood.lua          -- CEventNetworkEntityDamage
│   │   ├── fingerprint.lua    -- lib.onCache + ox_inventory
│   │   ├── casing.lua         -- CEventGunShot
│   │   └── utils.lua          -- Helpers
│   ├── forensic_init.lua      -- Entry point
│   └── forensic_items.lua     -- Item exports
├── server/
│   ├── forensic_sync.lua      -- State bag management
│   └── forensic_db.lua        -- DNA registry
└── common/
    └── evidence_types.lua     -- Registry config
```

---

## Prioridad

1. State bags + sync server-client
2. Sangre (CEventNetworkEntityDamage + AddDecal)
3. Huellas (lib.onCache + ox_target)
4. Items forenses
5. Casquillos (CEventGunShot)
6. DNA comparison
