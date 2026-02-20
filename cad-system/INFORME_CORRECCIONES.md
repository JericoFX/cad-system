# Informe de Correcciones del Sistema CAD

## 1. Callbacks de Noticias sin Protección de Seguridad

### Problema Identificado
Los callbacks de noticias en `server/news.lua` no estaban protegidos con `CAD.Auth.WithGuard`, lo que eliminaba las protecciones centralizadas de rate limiting y panic shielding, aumentando el riesgo de abuso/DoS.

### Solución Implementada
Se envolvieron todos los callbacks de noticias con `CAD.Auth.WithGuard` utilizando el bucket 'default'.

### Impacto en el Sistema
- Mejora significativa en la seguridad de los endpoints de noticias
- Implementación consistente con otros módulos protegidos
- Reducción del riesgo de abuso y ataques DoS

### Beneficios Obtenidos
- **Seguridad:** Protección estandarizada contra abusos
- **Mantenibilidad:** Consistencia con el modelo de protección del sistema

## 2. Endpoint de Fotos sin Verificación de Autorización

### Problema Identificado
El endpoint `cad:photos:getPhoto` en `server/photos.lua` devolvía objetos completos de fotos sin verificar la autorización del solicitante, permitiendo acceso no autorizado a metadatos sensibles.

### Solución Implementada
Se implementó verificación de identidad de oficial y política de acceso que requiere propiedad, rol asignado o privilegios de administrador.

### Impacto en el Sistema
- Protección de datos sensibles de evidencia
- Control de acceso basado en roles y propiedad
- Prevención de enumeración no autorizada de fotos

### Beneficios Obtenidos
- **Seguridad:** Protección de información sensible
- **Correctitud:** Acceso controlado a recursos del sistema

## 3. Iteración Incorrecta en Detección de Crímenes Activos

### Problema Identificado
En `server/forensic/sync.lua`, se utilizaba `ipairs` para iterar sobre un mapa de llamadas de despacho, lo que causaba que `inActiveCrime` permaneciera false incluso cuando existían llamadas activas.

### Solución Implementada
Se reemplazó `ipairs` con `pairs` para la traversía correcta del mapa por claves.

### Impacto en el Sistema
- Generación adecuada de evidencia forense cuando hay crímenes activos
- Corrección del flujo lógico en la generación de evidencias

### Beneficios Obtenidos
- **Correctitud:** Funcionamiento preciso del sistema forense
- **Rendimiento:** Evita trabajo innecesario cuando no hay crímenes activos

## 4. Timestamps Controlados por el Cliente

### Problema Identificado
En `server/news.lua`, las marcas de tiempo `createdAt` y `updatedAt` se aceptaban del payload del cliente, permitiendo manipulación de la integridad de la línea de tiempo.

### Solución Implementada
Se modificó `sanitizeArticle` para que siempre establezca `updatedAt` en el servidor y solo permita `createdAt` del servidor para nuevos registros.

### Impacto en el Sistema
- Integridad de la línea de tiempo de artículos garantizada
- Auditoría precisa de fechas de creación y actualización

### Beneficios Obtenidos
- **Correctitud:** Integridad temporal consistente
- **Seguridad:** Prevención de manipulación de metadatos

## 5. Hilo Forense Ejecutándose con Demasiada Frecuencia

### Problema Identificado
El hilo en `server/forensic/sync.lua` ejecutaba `ensureEvidenceState()` cada segundo permanentemente, causando overhead innecesario en el servidor.

### Solución Implementada
Se modificó el intervalo de ejecución de 1 segundo a 30 segundos y se optimizó la inicialización.

### Impacto en el Sistema
- Reducción significativa de overhead en el servidor
- Uso más eficiente de recursos del sistema
- Mantenimiento adecuado del estado forense con menor frecuencia

### Beneficios Obtenidos
- **Rendimiento:** Reducción del 95% en ejecuciones innecesarias
- **Eficiencia:** Mejor uso de recursos del servidor

## 6. Modelo de Protección de Callbacks Inconsistente

### Problema Identificado
Existía una inconsistencia en el modelo de protección de callbacks a través de módulos, con algunos usando protecciones centralizadas y otros verificaciones ad-hoc.

### Solución Implementada
Se estandarizó el registro de callbacks a través de `CAD.Auth.WithGuard` y se reservaron verificaciones inline para lógica específica de roles.

### Impacto en el Sistema
- Consistencia en la protección de todos los endpoints
- Implementación uniforme de rate limiting y manejo de errores
- Reducción de riesgos de drift de seguridad

### Beneficios Obtenidos
- **Mantenibilidad:** Modelo de protección uniforme
- **Seguridad:** Comportamiento consistente en todos los módulos
- **Escalabilidad:** Sistema de protección estandarizado para futuras expansiones

## Resumen General

Las correcciones implementadas han mejorado significativamente la seguridad, correctitud, rendimiento y mantenibilidad del sistema CAD. Todos los problemas críticos identificados han sido abordados con soluciones que no solo resuelven los problemas inmediatos sino que también establecen una base más sólida para el desarrollo futuro del sistema.
