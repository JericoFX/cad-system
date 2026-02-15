# CAD System - Manual Testing Checklist

Documento de testing manual para verificar todos los endpoints, eventos y comandos del sistema CAD.

---

## Instrucciones de Testing

### Método 1: Desde NUI (Browser Console)
```javascript
// Ejecutar en la consola del navegador (F12)
window.fetchNui('cad:createCase', {
  caseType: 'CRIMINAL',
  title: 'Test Case 001',
  description: 'Caso de prueba',
  priority: 2
}).then(console.log)
```

### Método 2: Desde Lua (Server Console)
```lua
-- Ejecutar en server console
TriggerEvent('cad:test:createCase')
```

### Método 3: Desde Cliente (in-game)
```lua
-- Ejecutar con un comando de admin
/cadtest createCase
```

### Leyenda de Status
- ⬜ Pendiente
- ✅ OK
- ❌ Error
- ⚠️ Parcial

---

## 1. CORE CALLBACKS

### `cad:getConfig`
**Descripción:** Obtener configuración del sistema

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
{
  "Debug": false,
  "Framework": { "Preferred": "auto" },
  "Features": { "Dispatch": {...}, "Forensics": {...}, "News": {...} },
  "UI": { "Command": "cad", "Keybind": "F6", "AccessMode": "auto" },
  "Security": { "AllowedJobs": [...], "RateLimitPerMinute": {...} }
}
```

**Verificar:**
- [ ] Retorna objeto de configuración completo
- [ ] Incluye `Features.Dispatch`
- [ ] Incluye `Features.Forensics`
- [ ] Incluye `Security.AllowedJobs`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getPlayerData`
**Descripción:** Obtener datos del jugador actual

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
{
  "citizenid": "string",
  "name": "string",
  "job": "police",
  "grade": 4,
  "permissions": ["police", "dispatch"]
}
```

**Verificar:**
- [ ] Retorna `citizenid` válido
- [ ] Retorna `name` del personaje
- [ ] Retorna `job` correcto
- [ ] Retorna `permissions` array

**Status:** ⬜ | **Notas:** ________________________________

---

## 2. CASES

### `cad:createCase`
**Descripción:** Crear un nuevo caso

**Payload:**
```json
{
  "caseType": "CRIMINAL",
  "title": "Test Case 001",
  "description": "Caso de prueba automatizado",
  "priority": 2
}
```

**Tipos válidos:** `CRIMINAL`, `CIVIL`, `TRAFFIC`, `GENERAL`, `NARCOTICS`, `HOMICIDE`
**Prioridades:** 1 (Crítica), 2 (Alta), 3 (Normal), 4 (Baja)

**Respuesta esperada:**
```json
{
  "caseId": "CASE_XXXXXX",
  "caseType": "CRIMINAL",
  "title": "Test Case 001",
  "description": "Caso de prueba automatizado",
  "priority": 2,
  "status": "OPEN",
  "createdAt": "2024-01-15T10:30:00Z",
  "createdBy": "char_001"
}
```

**Verificar:**
- [ ] Retorna `caseId` string único
- [ ] `status` es "OPEN"
- [ ] `createdAt` tiene timestamp válido
- [ ] Case aparece en DB tabla `cad_cases`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getCase`
**Descripción:** Obtener detalles de un caso específico

**Payload:**
```json
{
  "caseId": "CASE_XXXXXX"
}
```

**Respuesta esperada:**
```json
{
  "caseId": "CASE_XXXXXX",
  "caseType": "CRIMINAL",
  "title": "Test Case 001",
  "description": "...",
  "priority": 2,
  "status": "OPEN",
  "notes": [],
  "evidence": [],
  "tasks": [],
  "createdAt": "...",
  "createdBy": "...",
  "updatedAt": "..."
}
```

**Verificar:**
- [ ] Retorna objeto case completo
- [ ] Incluye `notes` array (vacío o con items)
- [ ] Incluye `evidence` array
- [ ] Incluye `tasks` array
- [ ] Retorna `null` si caseId no existe

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:searchCases`
**Descripción:** Buscar casos por query

**Payload:**
```json
{
  "query": "Test"
}
```

**Respuesta esperada:**
```json
[
  {
    "caseId": "CASE_001",
    "title": "Test Case 001",
    "caseType": "CRIMINAL",
    "status": "OPEN",
    "priority": 2
  }
]
```

**Verificar:**
- [ ] Retorna array de casos
- [ ] Busca en `title`
- [ ] Busca en `caseId`
- [ ] Retorna array vacío si no hay matches

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:updateCase`
**Descripción:** Actualizar datos de un caso

**Payload:**
```json
{
  "caseId": "CASE_XXXXXX",
  "updates": {
    "title": "Test Case 001 - Actualizado",
    "priority": 1,
    "description": "Descripción actualizada"
  }
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "case": { ... }
}
```

**Verificar:**
- [ ] Retorna caso actualizado
- [ ] `updatedAt` cambió
- [ ] Cambios persisten en DB
- [ ] Error si caseId no existe

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:closeCase`
**Descripción:** Cerrar un caso

**Payload:**
```json
{
  "caseId": "CASE_XXXXXX"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "status": "CLOSED"
}
```

**Verificar:**
- [ ] `status` cambia a "CLOSED"
- [ ] `closedAt` se setea
- [ ] `closedBy` tiene el citizenid
- [ ] No se puede cerrar un caso ya cerrado

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:case:printReport`
**Descripción:** Generar reporte imprimible de un caso

**Payload:**
```json
{
  "caseId": "CASE_XXXXXX"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "reportUrl": "string o null"
}
```

**Verificar:**
- [ ] Retorna success true
- [ ] Genera reporte (si está configurado)

**Status:** ⬜ | **Notas:** ________________________________

---

## 3. EVIDENCE

### `cad:addEvidenceToStaging`
**Descripción:** Agregar evidencia al área de staging

**Payload:**
```json
{
  "evidenceType": "PHOTO",
  "data": {
    "url": "https://example.com/photo.jpg",
    "description": "Foto de evidencia de prueba"
  },
  "metadata": {
    "location": { "x": 100, "y": 200, "z": 30 },
    "collectedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Tipos válidos:** `PHOTO`, `DOCUMENT`, `PHYSICAL`, `DIGITAL`, `VIDEO`, `AUDIO`, `BLOOD`, `FINGERPRINT`, `WEAPON`, `DRUG`

**Respuesta esperada:**
```json
{
  "stagingId": "STG_XXXXXX",
  "evidenceType": "PHOTO",
  "data": { ... },
  "stagedAt": "2024-01-15T10:30:00Z",
  "stagedBy": "char_001"
}
```

**Verificar:**
- [ ] Retorna `stagingId` único
- [ ] `stagedBy` tiene el citizenid correcto
- [ ] Aparece en tabla `cad_evidence_staging`
- [ ] Respeta límite `MaxStagingPerOfficer`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getStagingEvidence`
**Descripción:** Obtener evidencia en staging del oficial

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
[
  {
    "stagingId": "STG_001",
    "evidenceType": "PHOTO",
    "data": { ... },
    "stagedAt": "...",
    "stagedBy": "char_001"
  }
]
```

**Verificar:**
- [ ] Retorna solo evidencia del oficial actual
- [ ] Array vacío si no hay nada en staging

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:removeFromStaging`
**Descripción:** Remover evidencia del staging

**Payload:**
```json
{
  "stagingId": "STG_XXXXXX"
}
```

**Respuesta esperada:**
```json
{
  "success": true
}
```

**Verificar:**
- [ ] Evidencia removida de staging
- [ ] Error si stagingId no existe o no pertenece al oficial

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:attachEvidence`
**Descripción:** Adjuntar evidencia a un caso

**Payload:**
```json
{
  "stagingId": "STG_XXXXXX",
  "caseId": "CASE_XXXXXX"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "evidence": {
    "evidenceId": "EV_XXXXXX",
    "caseId": "CASE_XXXXXX",
    "attachedAt": "...",
    "attachedBy": "char_001"
  }
}
```

**Verificar:**
- [ ] Evidencia movida de staging a caso
- [ ] Se crea `evidenceId` único
- [ ] Aparece en tabla `cad_evidence`
- [ ] Se crea evento en `custodyChain`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getCaseEvidence`
**Descripción:** Obtener evidencia de un caso

**Payload:**
```json
{
  "caseId": "CASE_XXXXXX"
}
```

**Respuesta esperada:**
```json
[
  {
    "evidenceId": "EV_001",
    "caseId": "CASE_001",
    "evidenceType": "PHOTO",
    "data": { ... },
    "attachedAt": "...",
    "attachedBy": "...",
    "custodyChain": [...]
  }
]
```

**Verificar:**
- [ ] Retorna array de evidencia
- [ ] Cada item tiene `custodyChain`
- [ ] Array vacío si no hay evidencia

**Status:** ⬜ | **Notas:** ________________________________

---

## 4. DISPATCH

### `cad:registerDispatchUnit`
**Descripción:** Registrar una unidad de dispatch

**Payload:**
```json
{
  "unitId": "1-ADAM-1",
  "unitName": "Oficial Pérez",
  "unitType": "PATROL",
  "job": "police",
  "status": "AVAILABLE"
}
```

**Tipos de unidad:** `PATROL`, `MOTORCYCLE`, `HELI`, `BOAT`, `K9`, `SWAT`, `DETECTIVE`, `EMS`, `FIRE`
**Status válidos:** `AVAILABLE`, `BUSY`, `EN_ROUTE`, `ON_SCENE`, `OFF_DUTY`

**Respuesta esperada:**
```json
{
  "success": true,
  "unit": {
    "unitId": "1-ADAM-1",
    "unitName": "Oficial Pérez",
    "status": "AVAILABLE",
    "registeredAt": "..."
  }
}
```

**Verificar:**
- [ ] Unidad registrada correctamente
- [ ] Aparece en `cad_dispatch_units`
- [ ] Si ya existe, actualiza datos

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getDispatchUnits`
**Descripción:** Obtener todas las unidades de dispatch

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
[
  {
    "unitId": "1-ADAM-1",
    "unitName": "Oficial Pérez",
    "unitType": "PATROL",
    "job": "police",
    "status": "AVAILABLE",
    "position": { "x": 100, "y": 200, "z": 30 },
    "assignedCalls": []
  }
]
```

**Verificar:**
- [ ] Retorna array de unidades
- [ ] Incluye posición actualizada
- [ ] Incluye calls asignadas

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:updateUnitStatus`
**Descripción:** Actualizar estado de una unidad

**Payload:**
```json
{
  "unitId": "1-ADAM-1",
  "status": "BUSY",
  "notes": "En persecución"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "unit": { ... }
}
```

**Verificar:**
- [ ] Status actualizado
- [ ] `updatedAt` cambió
- [ ] Se dispara evento `dispatch:unitStatusChanged`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:createDispatchCall`
**Descripción:** Crear una llamada de dispatch

**Payload:**
```json
{
  "title": "Robo en progreso",
  "description": "Robo a mano armada en convenience store",
  "priority": 1,
  "location": {
    "address": "123 Main St",
    "coords": { "x": 100, "y": 200, "z": 30 }
  },
  "source": "CITIZEN",
  "codes": ["10-31", "10-32"]
}
```

**Prioridades:** 1 (Emergencia), 2 (Urgente), 3 (Normal), 4 (Bajo)
**Source:** `CITIZEN`, `OFFICER`, `RADIO`, `ALARM`

**Respuesta esperada:**
```json
{
  "callId": "CALL_XXXXXX",
  "title": "Robo en progreso",
  "status": "PENDING",
  "priority": 1,
  "createdAt": "...",
  "createdBy": "char_001"
}
```

**Verificar:**
- [ ] `callId` único generado
- [ ] Status inicial es "PENDING"
- [ ] Aparece en `cad_dispatch_calls`
- [ ] Se dispara evento `dispatch:callCreated`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getDispatchCalls`
**Descripción:** Obtener llamadas activas

**Payload:**
```json
{
  "status": "all"
}
```

**Filtros de status:** `all`, `PENDING`, `ACTIVE`, `CLOSED`

**Respuesta esperada:**
```json
[
  {
    "callId": "CALL_001",
    "title": "Robo en progreso",
    "status": "ACTIVE",
    "priority": 1,
    "assignedUnits": ["1-ADAM-1"],
    "createdAt": "..."
  }
]
```

**Verificar:**
- [ ] Retorna array de llamadas
- [ ] Incluye `assignedUnits`
- [ ] Filtra por status correctamente

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:assignUnitToCall`
**Descripción:** Asignar unidad a una llamada

**Payload:**
```json
{
  "callId": "CALL_XXXXXX",
  "unitId": "1-ADAM-1"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "call": {
    "callId": "CALL_001",
    "assignedUnits": ["1-ADAM-1"],
    "status": "ACTIVE"
  }
}
```

**Verificar:**
- [ ] Unidad agregada a `assignedUnits`
- [ ] Status cambia a "ACTIVE" si era "PENDING"
- [ ] Unidad cambia a status "BUSY"
- [ ] Se dispara evento `dispatch:callAssigned`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:unassignUnitFromCall`
**Descripción:** Desasignar unidad de una llamada

**Payload:**
```json
{
  "callId": "CALL_XXXXXX",
  "unitId": "1-ADAM-1"
}
```

**Respuesta esperada:**
```json
{
  "success": true
}
```

**Verificar:**
- [ ] Unidad removida de `assignedUnits`
- [ ] Unidad cambia a status "AVAILABLE"

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:closeDispatchCall`
**Descripción:** Cerrar una llamada

**Payload:**
```json
{
  "callId": "CALL_XXXXXX",
  "resolution": "SOLVED",
  "notes": "Sospechoso aprehendido"
}
```

**Resoluciones:** `SOLVED`, `UNFOUNDED`, `DUPLICATE`, `NO_ACTION`

**Respuesta esperada:**
```json
{
  "success": true,
  "status": "CLOSED"
}
```

**Verificar:**
- [ ] Status cambia a "CLOSED"
- [ ] `closedAt` se setea
- [ ] Todas las unidades desasignadas
- [ ] Se dispara evento `dispatch:callClosed`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:closeCall`
**Descripción:** Alias de closeDispatchCall

**Payload:**
```json
{
  "callId": "CALL_XXXXXX"
}
```

**Verificar:**
- [ ] Funciona igual que `closeDispatchCall`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getNearestUnit`
**Descripción:** Obtener unidad más cercana a unas coordenadas

**Payload:**
```json
{
  "coords": { "x": 100, "y": 200, "z": 30 },
  "job": "police"
}
```

**Respuesta esperada:**
```json
{
  "unitId": "1-ADAM-1",
  "distance": 150.5,
  "unit": { ... }
}
```

**Verificar:**
- [ ] Retorna unidad más cercana
- [ ] `distance` es correcto
- [ ] Filtra por job si se especifica
- [ ] Retorna null si no hay unidades disponibles

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:setOfficerStatus`
**Descripción:** Setear status de oficial (más simple que updateUnitStatus)

**Payload:**
```json
{
  "status": "10-8"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "status": "10-8"
}
```

**Verificar:**
- [ ] Status del oficial actualizado
- [ ] Actualiza unidad de dispatch asociada

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getOfficerStatus`
**Descripción:** Obtener status del oficial actual

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
{
  "status": "10-8",
  "unitId": "1-ADAM-1",
  "assignedCalls": []
}
```

**Verificar:**
- [ ] Retorna status actual
- [ ] Incluye unitId si está registrado
- [ ] Incluye calls asignadas

**Status:** ⬜ | **Notas:** ________________________________

---

## 5. FINES

### `cad:getFineCatalog`
**Descripción:** Obtener catálogo de multas disponibles

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
[
  {
    "id": "speeding_1",
    "category": "TRAFFIC",
    "label": "Exceso de velocidad leve",
    "amount": 150,
    "points": 1
  }
]
```

**Verificar:**
- [ ] Retorna array de multas
- [ ] Cada multa tiene `id`, `label`, `amount`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:createFine`
**Descripción:** Crear una multa

**Payload:**
```json
{
  "targetId": "char_002",
  "targetName": "Juan Pérez",
  "fineType": "speeding_1",
  "amount": 150,
  "reason": "Exceso de velocidad en zona escolar",
  "caseId": "CASE_001"
}
```

**Respuesta esperada:**
```json
{
  "fineId": "FINE_XXXXXX",
  "targetId": "char_002",
  "amount": 150,
  "status": "UNPAID",
  "createdAt": "..."
}
```

**Verificar:**
- [ ] `fineId` único generado
- [ ] Status inicial "UNPAID"
- [ ] Aparece en `cad_fines`
- [ ] Se dispara evento `fine:created`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:getFines`
**Descripción:** Obtener multas

**Payload:**
```json
{
  "targetId": "char_002"
}
```

**Respuesta esperada:**
```json
[
  {
    "fineId": "FINE_001",
    "targetId": "char_002",
    "targetName": "Juan Pérez",
    "amount": 150,
    "status": "UNPAID",
    "createdAt": "..."
  }
]
```

**Verificar:**
- [ ] Retorna multas del target
- [ ] Si no hay targetId, retorna todas

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:payFine`
**Descripción:** Pagar una multa

**Payload:**
```json
{
  "fineId": "FINE_XXXXXX"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "status": "PAID",
  "paidAt": "..."
}
```

**Verificar:**
- [ ] Status cambia a "PAID"
- [ ] Se descuenta dinero del jugador
- [ ] Se dispara evento `fine:paid`
- [ ] Error si no tiene dinero

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:payFineByTicket`
**Descripción:** Pagar multa usando item ticket

**Payload:**
```json
{
  "ticketId": "TICKET_001"
}
```

**Verificar:**
- [ ] Funciona igual que payFine pero usando item
- [ ] Remueve item del inventario

**Status:** ⬜ | **Notas:** ________________________________

---

## 6. POLICE

### `cad:police:getJailTransfers`
**Descripción:** Obtener transferencias a cárcel

**Payload:**
```json
{
  "caseId": "CASE_001"
}
```

**Respuesta esperada:**
```json
[
  {
    "transferId": "JAIL_001",
    "prisonerId": "char_002",
    "prisonerName": "Juan Pérez",
    "caseId": "CASE_001",
    "transferredAt": "...",
    "transferredBy": "char_001"
  }
]
```

**Verificar:**
- [ ] Retorna transferencias
- [ ] Filtra por caseId si se proporciona

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:police:logJailTransfer`
**Descripción:** Registrar transferencia a cárcel

**Payload:**
```json
{
  "prisonerId": "char_002",
  "prisonerName": "Juan Pérez",
  "caseId": "CASE_001",
  "sentence": 30,
  "charges": ["Robo", "Resistencia a la autoridad"]
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "transferId": "JAIL_XXXXXX"
}
```

**Verificar:**
- [ ] Transferencia registrada
- [ ] `transferId` generado
- [ ] Aparece en DB

**Status:** ⬜ | **Notas:** ________________________________

---

## 7. EMS

### `cad:ems:getUnits`
**Descripción:** Obtener unidades EMS

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
[
  {
    "unitId": "EMS-1",
    "unitName": "Ambulancia 1",
    "status": "AVAILABLE",
    "position": { "x": 100, "y": 200, "z": 30 }
  }
]
```

**Verificar:**
- [ ] Retorna unidades EMS
- [ ] Incluye posición

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:getAlerts`
**Descripción:** Obtener alertas EMS activas

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
[
  {
    "alertId": "ALERT_001",
    "type": "CRITICAL",
    "patientId": "char_002",
    "location": { ... },
    "createdAt": "..."
  }
]
```

**Verificar:**
- [ ] Retorna alertas activas
- [ ] Ordenado por prioridad/fecha

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:createAlert`
**Descripción:** Crear alerta EMS

**Payload:**
```json
{
  "type": "CRITICAL",
  "patientId": "char_002",
  "patientName": "Juan Pérez",
  "condition": "Herida de bala",
  "location": {
    "address": "123 Main St",
    "coords": { "x": 100, "y": 200, "z": 30 }
  },
  "priority": 1
}
```

**Tipos:** `CRITICAL`, `SERIOUS`, `STABLE`, `TRAUMA`, `MEDICAL`

**Respuesta esperada:**
```json
{
  "alertId": "ALERT_XXXXXX",
  "status": "ACTIVE",
  "createdAt": "..."
}
```

**Verificar:**
- [ ] Alerta creada
- [ ] Se dispara evento `ems:alertCreated`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:updateUnit`
**Descripción:** Actualizar unidad EMS

**Payload:**
```json
{
  "unitId": "EMS-1",
  "status": "BUSY",
  "notes": "Transportando paciente"
}
```

**Verificar:**
- [ ] Unidad actualizada
- [ ] Status cambia

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:critical_patient`
**Descripción:** Reportar paciente crítico

**Payload:**
```json
{
  "patientId": "char_002",
  "alertId": "ALERT_001",
  "vitals": {
    "heartRate": 40,
    "bloodPressure": "60/40"
  }
}
```

**Verificar:**
- [ ] Alerta marcada como crítica
- [ ] Se dispara evento `ems:criticalPatient`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:low_stock`
**Descripción:** Reportar stock bajo

**Payload:**
```json
{
  "itemId": "bandages",
  "itemName": "Vendas",
  "currentStock": 5,
  "unitId": "EMS-1"
}
```

**Verificar:**
- [ ] Alerta de stock creada
- [ ] Se dispara evento `ems:lowStock`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:handoff_complete`
**Descripción:** Completar handoff de paciente

**Payload:**
```json
{
  "alertId": "ALERT_001",
  "receivingUnit": "HOSPITAL_LS",
  "notes": "Paciente estable"
}
```

**Verificar:**
- [ ] Alerta cerrada
- [ ] Se dispara evento `ems:handoffComplete`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:createBloodRequest`
**Descripción:** Crear solicitud de sangre

**Payload:**
```json
{
  "bloodType": "O+",
  "units": 2,
  "urgency": "HIGH",
  "hospital": "Pillbox",
  "patientId": "char_002"
}
```

**Respuesta esperada:**
```json
{
  "requestId": "BLOOD_XXXXXX",
  "status": "PENDING",
  "createdAt": "..."
}
```

**Verificar:**
- [ ] Solicitud creada
- [ ] Se dispara evento `ems:bloodRequestCreated`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:getBloodRequests`
**Descripción:** Obtener solicitudes de sangre

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
[
  {
    "requestId": "BLOOD_001",
    "bloodType": "O+",
    "units": 2,
    "status": "PENDING",
    "createdAt": "..."
  }
]
```

**Verificar:**
- [ ] Retorna solicitudes activas

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:ems:updateBloodRequest`
**Descripción:** Actualizar solicitud de sangre

**Payload:**
```json
{
  "requestId": "BLOOD_XXXXXX",
  "status": "FULFILLED"
}
```

**Verificar:**
- [ ] Status actualizado
- [ ] Se dispara evento `ems:bloodRequestFulfilled`

**Status:** ⬜ | **Notas:** ________________________________

---

## 8. FORENSICS

### `cad:forensic:checkInLab`
**Descripción:** Verificar si el jugador está en un laboratorio forense

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
{
  "inLab": true,
  "labId": "LSPD_LAB",
  "labName": "Laboratorio LSPD"
}
```

**Verificar:**
- [ ] Detecta correctamente si está en lab
- [ ] Retorna info del lab

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:getPendingEvidence`
**Descripción:** Obtener evidencia pendiente de análisis

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
[
  {
    "evidenceId": "EV_001",
    "evidenceType": "BLOOD",
    "status": "PENDING_ANALYSIS",
    "submittedAt": "..."
  }
]
```

**Verificar:**
- [ ] Retorna evidencia pendiente

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:analyzeEvidence`
**Descripción:** Iniciar análisis de evidencia

**Payload:**
```json
{
  "evidenceId": "EV_XXXXXX",
  "analysisType": "DNA",
  "notes": "Análisis de ADN"
}
```

**Tipos de análisis:** `DNA`, `FINGERPRINT`, `BALLISTIC`, `DRUG`, `DOCUMENT`

**Respuesta esperada:**
```json
{
  "analysisId": "ANAL_XXXXXX",
  "status": "IN_PROGRESS",
  "estimatedCompletion": "..."
}
```

**Verificar:**
- [ ] Análisis iniciado
- [ ] Status cambia a "IN_PROGRESS"
- [ ] Timer de análisis inicia
- [ ] Se dispara evento `forensics:analysisStarted`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:completeAnalysis`
**Descripción:** Completar análisis de evidencia

**Payload:**
```json
{
  "analysisId": "ANAL_XXXXXX",
  "results": {
    "match": true,
    "matchId": "char_002",
    "confidence": 0.95
  }
}
```

**Verificar:**
- [ ] Análisis completado
- [ ] Resultados guardados
- [ ] Se dispara evento `forensics:analysisCompleted`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:getAnalysisResults`
**Descripción:** Obtener resultados de análisis

**Payload:**
```json
{
  "evidenceId": "EV_XXXXXX"
}
```

**Respuesta esperada:**
```json
{
  "analysisId": "ANAL_001",
  "evidenceId": "EV_001",
  "analysisType": "DNA",
  "results": { ... },
  "completedAt": "..."
}
```

**Verificar:**
- [ ] Retorna resultados completos

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:compareEvidence`
**Descripción:** Comparar dos evidencias

**Payload:**
```json
{
  "evidenceId1": "EV_001",
  "evidenceId2": "EV_002",
  "comparisonType": "DNA"
}
```

**Respuesta esperada:**
```json
{
  "match": true,
  "confidence": 0.87,
  "details": "Coincidencia parcial de ADN"
}
```

**Verificar:**
- [ ] Retorna comparación
- [ ] Confidence entre 0 y 1

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:collectEvidence`
**Descripción:** Colectar evidencia del mundo

**Payload:**
```json
{
  "traceId": "TRACE_001",
  "collectionMethod": "SWAB"
}
```

**Verificar:**
- [ ] Evidencia colectada
- [ ] Removida del mundo

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:getNearbyWorldTraces`
**Descripción:** Obtener trazas forenses cercanas

**Payload:**
```json
{
  "coords": { "x": 100, "y": 200, "z": 30 },
  "radius": 18.0
}
```

**Respuesta esperada:**
```json
[
  {
    "traceId": "TRACE_001",
    "traceType": "BLOOD",
    "coords": { "x": 102, "y": 198, "z": 30 },
    "createdAt": "..."
  }
]
```

**Verificar:**
- [ ] Retorna trazas en radio
- [ ] Respeta TTL de trazas

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:bagWorldTrace`
**Descripción:** Embolsar traza del mundo

**Payload:**
```json
{
  "traceId": "TRACE_001"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "stagingId": "STG_XXXXXX"
}
```

**Verificar:**
- [ ] Traza movida a staging
- [ ] Removida del mundo
- [ ] Se dispara evento `forensics:traceBagged`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:forensic:debugCreateTrace`
**Descripción:** Crear traza forense (debug)

**Payload:**
```json
{
  "traceType": "BLOOD",
  "coords": { "x": 100, "y": 200, "z": 30 },
  "metadata": {
    "bloodType": "O+"
  }
}
```

**Verificar:**
- [ ] Traza creada en el mundo
- [ ] Solo funciona si Debug = true

**Status:** ⬜ | **Notas:** ________________________________

---

## 9. PHOTOS

### `cad:photos:capturePolicePhoto`
**Descripción:** Capturar foto de evidencia policial

**Payload:**
```json
{
  "location": { "x": 100, "y": 200, "z": 30 },
  "fov": 60,
  "description": "Foto de evidencia"
}
```

**Respuesta esperada:**
```json
{
  "photoId": "PHOTO_XXXXXX",
  "url": "https://...",
  "stagingId": "STG_XXXXXX"
}
```

**Verificar:**
- [ ] Foto capturada
- [ ] URL válida generada
- [ ] Agregada a staging
- [ ] Se dispara evento `photo:captured`

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:captureNewsPhoto`
**Descripción:** Capturar foto para noticias

**Payload:**
```json
{
  "location": { "x": 100, "y": 200, "z": 30 },
  "fov": 60,
  "description": "Foto para noticia"
}
```

**Verificar:**
- [ ] Foto capturada
- [ ] Solo accesible para jobs de noticias

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:getInventoryPhotos`
**Descripción:** Obtener fotos del inventario

**Payload:**
```json
{}
```

**Respuesta esperada:**
```json
[
  {
    "photoId": "PHOTO_001",
    "url": "https://...",
    "takenAt": "...",
    "description": "..."
  }
]
```

**Verificar:**
- [ ] Retorna fotos del jugador

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:getStagingPhotos`
**Descripción:** Obtener fotos en staging

**Payload:**
```json
{}
```

**Verificar:**
- [ ] Retorna fotos pendientes de procesar

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:releaseToPress`
**Descripción:** Liberar foto a prensa

**Payload:**
```json
{
  "photoId": "PHOTO_XXXXXX",
  "caption": "Incidente en Downtown",
  "credits": "Oficial Pérez"
}
```

**Verificar:**
- [ ] Foto liberada
- [ ] Aparece en feed de noticias

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:getReleasedPhotos`
**Descripción:** Obtener fotos liberadas a prensa

**Payload:**
```json
{}
```

**Verificar:**
- [ ] Retorna fotos públicas

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:submitToPolice`
**Descripción:** Enviar foto a policía (desde prensa)

**Payload:**
```json
{
  "photoId": "PHOTO_XXXXXX",
  "caseId": "CASE_001",
  "notes": "Posible evidencia"
}
```

**Verificar:**
- [ ] Foto enviada a cola de revisión

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:reviewSubmission`
**Descripción:** Revisar envío de foto

**Payload:**
```json
{
  "submissionId": "SUB_001",
  "approved": true,
  "notes": "Evidencia válida"
}
```

**Verificar:**
- [ ] Si approved, se adjunta al caso
- [ ] Si no approved, se rechaza

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:getReviewQueue`
**Descripción:** Obtener cola de revisión

**Payload:**
```json
{}
```

**Verificar:**
- [ ] Retorna envíos pendientes de revisar

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:attachToCase`
**Descripción:** Adjuntar foto a caso

**Payload:**
```json
{
  "photoId": "PHOTO_XXXXXX",
  "caseId": "CASE_001"
}
```

**Verificar:**
- [ ] Foto adjuntada como evidencia

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:photos:getPhoto`
**Descripción:** Obtener foto por ID

**Payload:**
```json
{
  "photoId": "PHOTO_XXXXXX"
}
```

**Verificar:**
- [ ] Retorna datos completos de la foto

**Status:** ⬜ | **Notas:** ________________________________

---

## 10. ID READER

### `cad:idreader:read`
**Descripción:** Leer documento de ID

**Payload:**
```json
{
  "targetId": "char_002"
}
```

**Respuesta esperada:**
```json
{
  "citizenid": "char_002",
  "firstName": "Juan",
  "lastName": "Pérez",
  "dateOfBirth": "1990-05-15",
  "gender": "M",
  "licenses": ["driver", "weapon"],
  "warrants": []
}
```

**Verificar:**
- [ ] Retorna datos del ciudadano
- [ ] Incluye licencias
- [ ] Incluye warrants activos

**Status:** ⬜ | **Notas:** ________________________________

---

## 11. NUI EVENTS (Server → Client)

Estos eventos son enviados automáticamente desde el servidor. Para probarlos, ejecutar las acciones correspondientes en el servidor.

### `cad:opened`
**Trigger:** Abrir el CAD (comando/zona)

**Data:**
```json
{
  "terminalId": "terminal_1",
  "location": { "x": 100, "y": 200, "z": 30 },
  "hasContainer": true,
  "hasReader": false
}
```

**Verificar:**
- [ ] NUI muestra el CAD
- [ ] `appState.isVisible` = true
- [ ] BackgroundTerminal visible

**Status:** ⬜ | **Notas:** ________________________________

---

### `cad:closed`
**Trigger:** Cerrar el CAD

**Data:**
```json
{
  "timestamp": 1705312400000
}
```

**Verificar:**
- [ ] NUI oculta el CAD
- [ ] `appState.isVisible` = false

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch:callCreated`
**Trigger:** `cad:createDispatchCall` exitoso

**Data:**
```json
{
  "callId": "CALL_001",
  "title": "Robo en progreso",
  "priority": 1,
  "status": "PENDING"
}
```

**Verificar:**
- [ ] NUI recibe el evento
- [ ] Llamada aparece en dispatch panel
- [ ] Notificación mostrada (si aplica)

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch:callUpdated`
**Trigger:** Cambios en llamada

**Verificar:**
- [ ] UI actualizada

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch:callClosed`
**Trigger:** `cad:closeDispatchCall` exitoso

**Verificar:**
- [ ] Llamada removida de lista activa
- [ ] Movida a historial

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch:callAssigned`
**Trigger:** `cad:assignUnitToCall` exitoso

**Verificar:**
- [ ] Unidad aparece en `assignedUnits`
- [ ] Notificación a la unidad

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch:unitStatusChanged`
**Trigger:** `cad:updateUnitStatus` exitoso

**Verificar:**
- [ ] Status de unidad actualizado en UI

**Status:** ⬜ | **Notas:** ________________________________

---

### `case:created`
**Trigger:** `cad:createCase` exitoso

**Verificar:**
- [ ] Caso aparece en lista
- [ ] Notificación mostrada

**Status:** ⬜ | **Notas:** ________________________________

---

### `case:updated`
**Trigger:** `cad:updateCase` exitoso

**Verificar:**
- [ ] Datos actualizados en UI

**Status:** ⬜ | **Notas:** ________________________________

---

### `case:closed`
**Trigger:** `cad:closeCase` exitoso

**Verificar:**
- [ ] Status cambiado a CLOSED

**Status:** ⬜ | **Notas:** ________________________________

---

### `case:noteAdded`
**Trigger:** Nota agregada a caso

**Verificar:**
- [ ] Nota aparece en lista

**Status:** ⬜ | **Notas:** ________________________________

---

### `evidence:staged`
**Trigger:** `cad:addEvidenceToStaging` exitoso

**Verificar:**
- [ ] Evidencia en staging panel

**Status:** ⬜ | **Notas:** ________________________________

---

### `evidence:analyzed`
**Trigger:** Análisis forense completado

**Verificar:**
- [ ] Resultados disponibles

**Status:** ⬜ | **Notas:** ________________________________

---

### `ems:alertCreated`
**Trigger:** `cad:ems:createAlert` exitoso

**Verificar:**
- [ ] Alerta en EMS dashboard

**Status:** ⬜ | **Notas:** ________________________________

---

### `ems:alertUpdated`
**Trigger:** Actualización de alerta EMS

**Verificar:**
- [ ] Datos actualizados

**Status:** ⬜ | **Notas:** ________________________________

---

### `ems:criticalPatient`
**Trigger:** `cad:ems:critical_patient` ejecutado

**Verificar:**
- [ ] Alerta marcada como crítica
- [ ] Notificación de emergencia

**Status:** ⬜ | **Notas:** ________________________________

---

### `ems:lowStock`
**Trigger:** `cad:ems:low_stock` ejecutado

**Verificar:**
- [ ] Alerta de stock bajo

**Status:** ⬜ | **Notas:** ________________________________

---

### `ems:bloodRequestCreated`
**Trigger:** `cad:ems:createBloodRequest` exitoso

**Verificar:**
- [ ] Solicitud en lista

**Status:** ⬜ | **Notas:** ________________________________

---

### `forensics:analysisStarted`
**Trigger:** `cad:forensic:analyzeEvidence` ejecutado

**Verificar:**
- [ ] Progress bar/timer visible

**Status:** ⬜ | **Notas:** ________________________________

---

### `forensics:analysisCompleted`
**Trigger:** Análisis terminado

**Verificar:**
- [ ] Resultados disponibles
- [ ] Notificación

**Status:** ⬜ | **Notas:** ________________________________

---

### `photo:captured`
**Trigger:** Foto capturada

**Verificar:**
- [ ] Foto en inventario/staging

**Status:** ⬜ | **Notas:** ________________________________

---

### `fine:created`
**Trigger:** `cad:createFine` exitoso

**Verificar:**
- [ ] Multa en lista

**Status:** ⬜ | **Notas:** ________________________________

---

### `fine:paid`
**Trigger:** `cad:payFine` exitoso

**Verificar:**
- [ ] Status cambiado a PAID

**Status:** ⬜ | **Notas:** ________________________________

---

## 12. TERMINAL COMMANDS

Probar cada comando en la terminal del CAD.

### `case gui`
**Descripción:** Abrir creador de casos GUI

**Verificar:**
- [ ] Modal se abre
- [ ] Formulario funcional
- [ ] Puede crear caso

**Status:** ⬜ | **Notas:** ________________________________

---

### `case create`
**Descripción:** Crear caso vía CLI interactivo

**Verificar:**
- [ ] Prompts aparecen
- [ ] Selección de tipo funciona
- [ ] Caso creado al final

**Status:** ⬜ | **Notas:** ________________________________

---

### `case view <caseId>`
**Descripción:** Ver detalles de caso

**Verificar:**
- [ ] Muestra info del caso
- [ ] Muestra notas
- [ ] Muestra evidencia

**Status:** ⬜ | **Notas:** ________________________________

---

### `case search <query>`
**Descripción:** Buscar casos

**Verificar:**
- [ ] Retorna resultados
- [ ] Busca en título y ID

**Status:** ⬜ | **Notas:** ________________________________

---

### `case notes`
**Descripción:** Ver notas del caso actual

**Verificar:**
- [ ] Lista notas
- [ ] Puede agregar notas

**Status:** ⬜ | **Notas:** ________________________________

---

### `case evidence`
**Descripción:** Ver evidencia del caso

**Verificar:**
- [ ] Lista evidencia
- [ ] Puede ver detalles

**Status:** ⬜ | **Notas:** ________________________________

---

### `case close <caseId>`
**Descripción:** Cerrar caso

**Verificar:**
- [ ] Pide confirmación
- [ ] Cierra caso

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch gui`
**Descripción:** Abrir panel de dispatch

**Verificar:**
- [ ] Modal se abre
- [ ] Muestra unidades
- [ ] Muestra llamadas

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch view <callId>`
**Descripción:** Ver detalles de llamada

**Verificar:**
- [ ] Muestra info completa

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch units`
**Descripción:** Listar unidades

**Verificar:**
- [ ] Lista todas las unidades
- [ ] Muestra status

**Status:** ⬜ | **Notas:** ________________________________

---

### `dispatch calls`
**Descripción:** Listar llamadas activas

**Verificar:**
- [ ] Lista llamadas
- [ ] Muestra prioridad

**Status:** ⬜ | **Notas:** ________________________________

---

### `search-person <query>` / `person <query>`
**Descripción:** Buscar persona

**Verificar:**
- [ ] Busca en DB
- [ ] Retorna resultados
- [ ] Muestra detalles si un resultado

**Status:** ⬜ | **Notas:** ________________________________

---

### `search-vehicle <plate>` / `vehicle <plate>`
**Descripción:** Buscar vehículo

**Verificar:**
- [ ] Busca por placa
- [ ] Retorna info del vehículo
- [ ] Muestra owner

**Status:** ⬜ | **Notas:** ________________________________

---

### `arrest` / `a`
**Descripción:** Proceso de arresto

**Verificar:**
- [ ] Wizard inicia
- [ ] Solicita datos
- [ ] Crea registro

**Status:** ⬜ | **Notas:** ________________________________

---

### `warrant` / `w`
**Descripción:** Gestión de órdenes de arresto

**Verificar:**
- [ ] Permite crear orden
- [ ] Lista órdenes activas

**Status:** ⬜ | **Notas:** ________________________________

---

### `bolo`
**Descripción:** Be On Lookout

**Verificar:**
- [ ] Permite crear BOLO
- [ ] Lista BOLOs activos

**Status:** ⬜ | **Notas:** ________________________________

---

### `fine`
**Descripción:** Gestión de multas

**Verificar:**
- [ ] Muestra catálogo
- [ ] Permite crear multa

**Status:** ⬜ | **Notas:** ________________________________

---

### `ems-dashboard` / `emsd`
**Descripción:** Dashboard EMS

**Verificar:**
- [ ] Modal se abre
- [ ] Muestra pacientes
- [ ] Muestra unidades

**Status:** ⬜ | **Notas:** ________________________________

---

### `radio`
**Descripción:** Panel de radio

**Verificar:**
- [ ] Modal se abre
- [ ] Canales funcionan

**Status:** ⬜ | **Notas:** ________________________________

---

### `help`
**Descripción:** Ayuda del sistema

**Verificar:**
- [ ] Muestra lista de comandos
- [ ] Muestra categorías

**Status:** ⬜ | **Notas:** ________________________________

---

### `status`
**Descripción:** Status de oficiales

**Verificar:**
- [ ] Muestra status actual
- [ ] Permite cambiar status

**Status:** ⬜ | **Notas:** ________________________________

---

## 13. UI COMPONENTS

### Acceso al CAD
- [ ] Comando `cad` funciona
- [ ] Keybind (F6) funciona
- [ ] Zona de acceso funciona (si AccessMode = zone)
- [ ] ox_target funciona (si AccessMode = target)
- [ ] Verifica job permitido
- [ ] Mensaje de error si no tiene acceso

### Terminal Principal
- [ ] Input responde
- [ ] Historial de comandos (arriba/abajo)
- [ ] Autocompletado (Tab)
- [ ] Scroll funciona
- [ ] Copy/paste funciona

### Modales
- [ ] Se abren correctamente
- [ ] Se cierran con ESC
- [ ] Se cierran con botón X
- [ ] Overlay oscuro visible
- [ ] Contenido scrolleable

### Background Terminal (Hacker Effect)
- [ ] Visible cuando CAD abierto
- [ ] No visible cuando CAD cerrado
- [ ] Comandos aparecen al ejecutar acciones
- [ ] Efecto scanlines visible

### Notificaciones
- [ ] Aparecen en esquina
- [ ] Se cierran automáticamente
- [ ] Se pueden descartar manualmente

---

## 14. DATABASE INTEGRATION

### Tablas
- [ ] `cad_cases` - Casos creados
- [ ] `cad_evidence` - Evidencia adjunta
- [ ] `cad_evidence_staging` - Evidencia en staging
- [ ] `cad_dispatch_units` - Unidades registradas
- [ ] `cad_dispatch_calls` - Llamadas
- [ ] `cad_fines` - Multas

### Cleanup Events
- [ ] Staging antiguo se limpia
- [ ] Llamadas cerradas antiguas se limpian
- [ ] Trazas forenses expiradas se limpian

---

## 15. SECURITY

### Rate Limiting
- [ ] Límite default (80/min) funciona
- [ ] Límite heavy (30/min) funciona
- [ ] Bloqueo temporal al exceder

### Permisos
- [ ] Jobs no permitidos no pueden acceder
- [ ] Admins pueden acceder a todo
- [ ] Permisos por categoría funcionan

### Validación
- [ ] Payloads vacíos manejados
- [ ] Tipos incorrectos rechazados
- [ ] SQL injection prevenido

---

## 16. FRAMEWORK INTEGRATION

### QBCore
- [ ] Detección automática funciona
- [ ] Player data correcto
- [ ] Job/grade correcto
- [ ] Money handling funciona

### QBox
- [ ] Detección automática funciona
- [ ] Player data correcto
- [ ] Job/grade correcto

### ESX
- [ ] Detección automática funciona
- [ ] Player data correcto
- [ ] Job/grade correcto

### Standalone
- [ ] Funciona sin framework
- [ ] Usa identifiers por defecto

---

## 17. EXTERNAL INTEGRATIONS

### ox_inventory
- [ ] Contenedor de evidencia funciona
- [ ] Items de fotos se crean
- [ ] Items de tickets se crean
- [ ] Lectura de items funciona

### screenshot-basic
- [ ] Captura de fotos funciona
- [ ] Upload funciona
- [ ] URLs válidas generadas

### ox_target
- [ ] Zonas de target se crean
- [ ] Interacción funciona
- [ ] Zonas se limpian al detener resource

---

## Resumen de Testing

| Categoría | Total | Testeados | OK | Error | Pendiente |
|-----------|-------|-----------|-----|-------|-----------|
| Core Callbacks | 2 | 0 | 0 | 0 | 2 |
| Cases | 6 | 0 | 0 | 0 | 6 |
| Evidence | 5 | 0 | 0 | 0 | 5 |
| Dispatch | 12 | 0 | 0 | 0 | 12 |
| Fines | 5 | 0 | 0 | 0 | 5 |
| Police | 2 | 0 | 0 | 0 | 2 |
| EMS | 10 | 0 | 0 | 0 | 10 |
| Forensics | 10 | 0 | 0 | 0 | 10 |
| Photos | 11 | 0 | 0 | 0 | 11 |
| ID Reader | 1 | 0 | 0 | 0 | 1 |
| NUI Events | 20 | 0 | 0 | 0 | 20 |
| Terminal Commands | 20 | 0 | 0 | 0 | 20 |
| **TOTAL** | **104** | **0** | **0** | **0** | **104** |

---

## Notas Generales

### Bugs Encontrados
1. ________________________________
2. ________________________________
3. ________________________________

### Mejoras Sugeridas
1. ________________________________
2. ________________________________
3. ________________________________

### Configuración de Testing
- Framework: _______________
- Base de datos: _______________
- ox_lib versión: _______________
- oxmysql versión: _______________

---

*Documento generado automáticamente - Actualizar según progreso de testing*
