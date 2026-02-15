# C.A.D. System - Computer Aided Dispatch

Sistema CAD/MDT completo para FiveM con interfaz terminal estilo DOS y modales GUI profesionales.

**Versión:** 1.0.0  
**Estado:** ✅ Producción Ready

## 🚀 Características Principales

### Core System
- **Terminal Interactivo** - Prompts inteligentes con autocompletado
- **Gestión de Casos** - Ciclo completo: create → notes → evidence → close
- **Sistema de Usuario** - Contexto real con permisos por rol
- **Dispatch Integrado** - Mapa, unidades, llamadas y radio

### Quick Wins (Nuevas v1.0)
- ✅ **Case Tasks** - Follow-up tasks dentro de casos
- ✅ **BOLO System** - Be On The Look Out para personas/vehículos
- ✅ **Dispatch-to-Case** - Crear caso directo desde llamada
- ✅ **EMS Handoff** - Transferencia médica a casos policiales

### High Impact Features (Nuevas v1.0)
- ✅ **Arrest Booking Wizard** - Proceso profesional de 6 pasos
- ✅ **Evidence Chain Timeline** - Cadena de custodia completa
- ✅ **Person Snapshot** - Vista unificada de persona (5 tabs)
- ✅ **Radio Markers** - Marcar mensajes importantes del radio

## 📦 Instalación

### Requisitos
- Node.js 18+ o Bun
- FiveM Server (para producción)
- ox_lib y oxmysql (para FiveM)

### Desarrollo
```bash
cd nui
bun install
bun run dev
```
Abrir: http://localhost:5173

### Producción (FiveM)
```bash
# 1. Configurar producción
edit source/config.ts
USE_MOCK_DATA: false

# 2. Build
bun run build

# 3. Build output para FiveM
# (se genera automaticamente en ../backend/nui/build)

# 4. server.cfg
ensure cad-system
```

## 🎮 Guía Rápida

### Flujo Básico de Caso
```bash
# 1. Crear caso
case create
# o con argumentos:
case create theft "Robbery at 24/7" --priority=1

# 2. Agregar nota
addnote observation "Suspect fled in black sedan"

# 3. Agregar evidencia
addevidence https://imgur.com/photo.jpg

# 4. Ver caso
case view
```

### Arresto Profesional
```bash
# Abrir wizard de booking
arrest

# El wizard guía por 6 pasos:
# 1. Datos del sospechoso
# 2. Cargos (24 códigos penales disponibles)
# 3. Items confiscados
# 4. Lectura de derechos (Miranda)
# 5. Transporte
# 6. Review y confirmación
```

### BOLO (Be On The Look Out)
```bash
# Crear BOLO
bolo add person CIT_123 "Armed and dangerous"
bolo add vehicle ABC123 "Stolen vehicle"

# Ver BOLOs activos
bolo list

# Verificar persona
bolo check person CIT_123
```

### Person Snapshot
```bash
# Buscar persona
search person "John Smith"
# Click en resultado abre Person Snapshot

# O directamente desde comandos:
# snapshot <citizenId> (si implementas el comando)
```

### Tareas de Caso
```bash
# Agregar tarea
addtask "Contactar testigo principal"

# Listar tareas
task list

# Completar tarea
task complete TASK_xxx
```

## 📚 Referencia Completa de Comandos

### Casos
| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `case` | Abrir GUI de creación | `case` |
| `case create` | Crear caso interactivo | `case create theft "Title"` |
| `case view [id]` | Ver caso | `case view CASE_001` |
| `case select` | Listar y seleccionar | `case select` |
| `case close <id>` | Cerrar caso | `case close CASE_001` |
| `case search <query>` | Buscar casos | `case search robbery` |

### Tareas
| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `task add <title>` | Agregar tarea | `task add "Llamar testigo"` |
| `task list` | Listar tareas | `task list` |
| `task complete <id>` | Completar | `task complete TASK_123` |
| `addtask <title>` | Shortcut | `addtask "Urgent"` |

### Notas
| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `addnote <type> <content>` | Agregar nota | `addnote observation "Text"` |
| `notes [case_id]` | Ver notas | `notes` |
| `notegui` | Editor GUI | `notegui` |

**Tipos de nota:** `general`, `observation`, `interview`, `evidence`

### Evidencia
| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `addevidence [url]` | Agregar evidencia | `addevidence http://...` |
| `evidence [case_id]` | Ver evidencia | `evidence` |
| `evidence gui` | Manager GUI | `evidence gui` |

### Police
| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `arrest [citizenId]` | Booking wizard | `arrest` |
| `bolo-gui` | BOLO Manager GUI | `bolo-gui` |
| `bolo add person <id> <reason>` | BOLO persona | `bolo add person CIT_123 "Text"` |
| `bolo add vehicle <plate> <reason>` | BOLO vehículo | `bolo add vehicle ABC123 "Text"` |
| `bolo list` | Ver BOLOs | `bolo list` |
| `bolo remove <id>` | Eliminar BOLO | `bolo remove BOLO_123` |
| `bolo check person <id>` | Verificar | `bolo check person CIT_123` |

### EMS
| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `triage [name]` | Triaje | `triage "John Doe"` |
| `treatment [id]` | Tratamiento | `treatment PAT_123` |

### Búsqueda
| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `search person [query]` | Buscar persona | `search person "John"` |
| `search vehicle [plate]` | Buscar vehículo | `search vehicle ABC123` |

### Dispatch
| Comando | Descripción |
|---------|-------------|
| `dispatch view` | Abrir panel |
| `dispatch units` | Listar unidades |
| `dispatch calls` | Listar llamadas |

**En el panel:** Botón [CREATE CASE] en llamadas

### Sistema
| Comando | Descripción |
|---------|-------------|
| `help` | Mostrar ayuda |
| `clear` | Limpiar terminal |
| `exit` | Cerrar app |

## 🖥️ Interfaz GUI

### Modales Disponibles

| Modal | Acceso | Descripción |
|-------|--------|-------------|
| **Case Creator** | `case` | Crear caso con GUI |
| **Notes Editor** | `notegui` | Editor de notas |
| **Evidence Manager** | `evidence gui` | Manager con cadena de custodia |
| **Arrest Wizard** | `arrest` | Booking de 6 pasos |
| **Person Snapshot** | Click en search | Vista unificada de persona |
| **Dispatch Panel** | `dispatch view` | Panel de control |
| **Radio Panel** | GUI | Con marcadores de mensajes |
| **Radio Markers** | Botón en radio | Lista de marcadores |
| **EMS Dashboard** | GUI | Panel EMS con handoff |

### Atajos de Teclado
- `Tab` - Autocompletar comandos
- `↑/↓` - Historial de comandos
- `Ctrl+C` - Limpiar input actual
- `Ctrl+L` - Limpiar pantalla
- `Escape` - Cerrar modal

## 🏗️ Arquitectura

### Tecnologías
- **Frontend:** SolidJS + TypeScript
- **Styling:** CSS custom (estilo DOS/Terminal)
- **State:** SolidJS Stores + Signals
- **Build:** Vite

### Estructura
```
source/
├── stores/           # Estado global
│   ├── cadStore.ts   # Cases, evidence, BOLOs, markers
│   ├── userStore.ts  # Auth y permisos
│   ├── promptStore.ts # Sistema de prompts
│   └── ...
├── commands/         # Comandos del terminal
│   ├── case/
│   ├── police/
│   ├── ems/
│   └── ...
├── components/
│   ├── Terminal.tsx
│   └── modals/       # 23 modales
└── styles/
    └── main.css
```

### Modelos de Datos Principales

**Case:**
```typescript
{
  caseId: string,
  caseType: string,
  title: string,
  status: 'OPEN' | 'CLOSED' | 'PENDING',
  notes: Note[],
  evidence: Evidence[],
  tasks: CaseTask[],
  linkedCallId?: string,
  // ...
}
```

**Evidence con Custodia:**
```typescript
{
  evidenceId: string,
  evidenceType: string,
  custodyChain: CustodyEvent[],
  currentLocation: string,
  currentCustodian: string,
  // ...
}
```

## 🔒 Permisos por Rol

| Rol | Permisos |
|-----|----------|
| **police** | Casos, arrestos, BOLOs, búsqueda |
| **ems** | Triage, treatment, handoff, info médica |
| **dispatch** | Dispatch panel, radio, unidades |
| **admin** | Todos los permisos |

## 🐛 Troubleshooting

### Build falla
```bash
# Limpiar y reinstalar
rm -rf node_modules
bun install
bun run build
```

### Prompts no funcionan
- Verificar que no haya modales bloqueando
- Revisar consola por errores
- Refrescar página (F5)

### Caso no se selecciona
- Verificar que `case create` terminó exitosamente
- Usar `case select` para seleccionar manualmente
- Revisar `cadState.currentCase` en consola

## 📝 Changelog

### v1.0.0 - Producción Ready
- ✅ Todas las Quick Wins implementadas
- ✅ Todas las High Impact features implementadas
- ✅ Sistema completo de casos
- ✅ Booking wizard profesional
- ✅ Cadena de custodia
- ✅ BOLO system
- ✅ Person snapshot
- ✅ Radio markers
- ✅ Documentación completa

## 🤝 Contribuir

1. Fork el repositorio
2. Crear rama feature: `git checkout -b feature/nombre`
3. Commit cambios: `git commit -am "feat: descripción"`
4. Push a la rama: `git push origin feature/nombre`
5. Crear Pull Request

## 📄 Licencia

MIT License - FiveM Community

---

**Desarrollado con ❤️ para la comunidad FiveM**

Para soporte o reportar bugs, crear un issue en el repositorio.
