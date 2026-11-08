# SPEC.md: Especificación Funcional, Contratos por Capa y Reglas de Negocio
**Proyecto:** RedVecina (Plataforma Hiperlocal y Resiliente de Economía Vecinal y Ayuda Humanitaria)  
**Marco:** Hackathon UTP – El Comercio  
**Modalidad:** Mobile-First PWA (Online & Offline)

---

## 1. Definición de Módulos Funcionales (Requisitos del Reto)

### Módulo 1: Servicios de Proximidad (Economía Local)
* **Modo Día a Día:** Directorio geolocalizado de oficios y profesiones del barrio (gasfitería, carpintería, electricidad, paseador de mascotas, clases particulares, cerrajería) validados mediante el sistema **"Visto Bueno Vecinal"** (recomendaciones verificadas de vecinos de la misma zona).
* **Modo Emergencia (Soporte):** Filtra y destaca automáticamente los servicios técnicos y grupos de apoyo comunitario disponibles para atender situaciones críticas (fugas de gas, cortocircuitos, rescate, primeros auxilios).

### Módulo 2: Cadena de Favores & Red de Solidaridad (Economía Solidaria)
* **Modo Día a Día:** Muro colaborativo para resolver necesidades cotidianas **sin dinero** (préstamo de herramientas, ayuda temporal, donación de materiales, intercambio de habilidades, movilidad solidaria).
* **Modo Emergencia (Ayuda Humanitaria):** Tablero crítico con reportes geolocalizados de vecinos en situación de vulnerabilidad (adultos mayores aislados, personas con discapacidad, falta de medicamentos) y coordinación de recursos vitales compartibles (agua potable, generadores, botiquines, puntos de carga).

---

## 2. Contratos de Datos y Esquemas por Capa

### 2.1 Contrato de la Capa de IA (`src/lib/ai/schemas.ts`)
El endpoint `POST /api/ai-parse` recibe el texto o transcripción de voz del vecino y el modo actual de la aplicación, devolviendo estrictamente este esquema validado con `zod`:

```typescript
import { z } from 'zod';

export const NeighborIntentSchema = z.object({
  targetModule: z.enum(['SERVICIO_OFICIO', 'CADENA_FAVORES', 'EMERGENCIA_SOS']),
  postType: z.enum([
    'OFERTA_OFICIO',
    'OFERTA_FAVOR',
    'NECESIDAD_FAVOR',
    'SOS_VULNERABLE',
    'RECURSO_CRITICO'
  ]),
  category: z.enum([
    'Gasfitería',
    'Electricidad',
    'Carpintería',
    'Cerrajería',
    'Cuidado y Mascotas',
    'Herramientas',
    'Movilidad Solidaria',
    'Agua y Alimentos',
    'Salud y Primeros Auxilios',
    'Otros'
  ]),
  title: z.string().max(60).describe('Título claro y directo de máximo 60 caracteres'),
  description: z.string().max(240).describe('Descripción resumida y empática'),
  urgency: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']),
  availableInEmergency: z.boolean().describe('True si el vecino ofrece apoyo en emergencias'),
  hasMonetaryIntent: z.boolean().describe('True si menciona precios o cobros para redirigir a Oficios')
});
```

### 2.2 Contrato de la Capa Offline (`src/lib/db/dexie.ts`)
Estructura de tablas locales en `IndexedDB` para soportar desconexión total:

* **`servicesCache`:** `id, category, title, neighborName, endorsementsCount, availableForEmergencies, latitude, longitude`
* **`postsCache`:** `id, mode, postType, category, title, urgency, status, latitude, longitude, createdAt`
* **`outboxQueue`:** `++localId, payload, endpoint, createdAt, syncStatus ('PENDING' | 'SYNCED' | 'FAILED')`

---

## 3. Flujo Exacto de "Máximo 3 Clics" para Publicar

Para cumplir con la métrica de usabilidad del jurado, ninguna publicación debe requerir más de 3 interacciones:

1. **Clic 1 (Iniciar / Dictar):** El usuario toca el botón flotante central **`+ Publicar`** (que activa el micrófono o cuadro rápido de texto) y expresa su necesidad o servicio.
2. **Clic 2 (Autocompletado IA):** Toca **`✨ Procesar`** (o se dispara automáticamente al terminar de hablar). La IA clasifica el módulo, elige la categoría, redacta el título y captura las coordenadas GPS actuales del teléfono.
3. **Clic 3 (Confirmar y Publicar):** El usuario verifica la tarjeta pre-llenada y toca el botón grande **`Publicar en mi Barrio`**. Si no hay internet, se guarda en `outboxQueue` y aparece de inmediato en el muro y mapa local.

---

## 4. Criterios de Evaluación de la Hackathon Cubiertos por Diseño

| Criterio del Jurado | Implementación Técnica en RedVecina |
| :--- | :--- |
| **Usabilidad** | Botones táctiles $\ge 48\text{ px}$, lenguaje claro, flujo de 3 clics y tutorial interactivo inicial. |
| **Confiabilidad** | Arquitectura *Offline-First* con `Dexie.js` y fallback manual si falla la red o la API de IA. |
| **Escalabilidad** | Monolito modular con PostgreSQL geoespacial particionado por sectores barriales (`neighborhood_sector`). |
| **Propuesta Institucional** | Modelo B2G/B2B conectable con Defensa Civil, Municipalidades y periodismo hiperlocal de El Comercio. |
| **Código y Programa** | MVP funcional 100% navegable con datos semilla realistas y sincronización en tiempo real. |
| **Innovación y Creatividad** | Conmutador de Estado Dual (Economía Diaria $\leftrightarrow$ Supervivencia SOS) + Triaje por Voz con IA. |