# CAD System - Addons & NUI Customization

## Phone System (gcphone)

El sistema de teléfono está en `addons/gcphone.lua`.

### Uso

1. El teléfono se carga automáticamente al iniciar el resource
2. Commands disponibles:
   - `/phone` - Abrir teléfono
   - `/call <number>` - Llamar a número

### Modificar Teléfono

Edita `addons/gcphone.lua` para cambiar:
- Funciones del teléfono
- Eventos registrados
- Permisos requeridos

## Customizar NUI

Para modificar la interfaz NUI sin cambiar el core:

### 1. Configurar Tema y Layout

Edita `source NUI/source/config/nuiConfig.ts`:

```typescript
export const customConfig: NuiCustomization = {
  theme: {
    primaryColor: '#00ff00',
    backgroundColor: '#0a0a0a',
  },
  layout: {
    dockPosition: 'bottom',
    dockSize: 'medium',
  },
  features: {
    enableDispatch: true,
    enableEvidence: true,
  },
  phone: {
    enablePhone: true,
    phoneResource: 'gcphone',
  },
};
```

### 2. Agregar Componentes Custom

Crea componentes en `source NUI/source/components/custom/`:

```tsx
// source NUI/source/components/custom/CustomDock.tsx
import { DockProps } from '~/types/dock';

export function CustomDock(props: DockProps) {
  // Your custom dock implementation
  return <div>Custom Dock</div>;
}
```

### 3. Registrar Componente Custom

En `source NUI/source/config/nuiConfig.ts`:

```typescript
components: {
  customDock: 'custom/CustomDock',
}
```

### 4. Estilos Custom

Agrega CSS en `source NUI/source/styles/custom.css`:

```css
.cad-terminal-custom {
  background: #000000;
  border: 1px solid #00ff00;
}
```

## Ejemplo: Cambiar Color del Teléfono

1. Edita `addons/gcphone.lua`:
   ```lua
   local PHONE_COLOR = '#00ff00'
   ```

2. Edita `source NUI/source/config/nuiConfig.ts`:
   ```typescript
   phone: {
     enablePhone: true,
   }
   ```

3. Recarga el resource:
   ```
   refresh
   restart cad-system
   ```

## Estructura

```
addons/
  gcphone.lua          - Sistema de teléfono
  
source NUI/source/
  config/
    nuiConfig.ts       - Configuración NUI
  components/
    custom/            - Componentes custom (crear)
  styles/
    custom.css         - Estilos custom (crear)
```

---

**Last Updated**: 2026-03-16