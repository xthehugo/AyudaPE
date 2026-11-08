# ARCHITECTURE.md: Diseño Arquitectónico Multicapa y Stack Tecnológico
**Proyecto:** RedVecina (PWA Hiperlocal de Economía Vecinal y Respuesta Humanitaria)  
**Patrón Principal:** Local-First & Offline-First PWA + Modular Monolith (Feature-Sliced Design)

---

## 1. ¿Qué Tipo de Arquitectura Usar y Por Qué?

Para cumplir con las exigencias empresariales del jurado (escalabilidad, confiabilidad, funcionamiento online/offline y velocidad móvil) sin caer en la sobreingeniería de microservicios complejos que retrasen el desarrollo en la hackathon, implementaremos una **Arquitectura Híbrida de 3 Pilares**:

1. **Monolito Modular Full-Stack (Next.js App Router):** Mantiene el frontend y los endpoints del backend en un único repositorio fuertemente tipado con TypeScript. Esto elimina errores de desincronización de datos entre capas y permite desplegar todo en segundos.
2. **Arquitectura *Local-First / Offline-First* en el Cliente:** La interfaz de usuario nunca depende directamente de que internet funcione para mostrar datos o registrar una emergencia. Todas las lecturas y escrituras pasan por un coordinador local (`IndexedDB` + `Service Worker`) que sincroniza con la nube cuando hay red.
3. **Diseño Guiado por Funcionalidades (*Feature-Sliced Design* pragmático):** El código se organiza por módulos de negocio (`directorio-oficios`, `muro-solidario`, `emergencia-sos`, `publicacion-ia`) y no solo por tipos de archivo, facilitando que 4 programadores trabajen en paralelo sin conflictos en Git.

---

## 2. Diagrama General de las 7 Capas del Sistema

```
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 1: PRESENTACIÓN Y EXPERIENCIA MÓVIL (UI/UX Mobile-First Shell)        │
│ Next.js App Router + React + Tailwind CSS + shadcn/ui + React-Leaflet      │
│ [Switch Dual: Día a Día / SOS]  [Modal 3 Clics]  [Tutorial Driver.js]      │
└───────────────────┬────────────────────────────────────┬───────────────────┘
                    │ Lectura / Escritura Reactiva       │
                    ▼                                    ▼
┌────────────────────────────────────────┐ ┌─────────────────────────────────┐
│ CAPA 2: RESILIENCIA LOCAL (OFFLINE)    │ │ CAPA 3: ORQUESTACIÓN DE IA      │
│ - Service Worker (@serwist/next)       │ │ - Web Speech API (Voz a Texto)  │
│ - IndexedDB (Dexie.js)                 │ │ - Vercel AI SDK (generateObject)│
│ - Cola de Sincronización (Outbox Sync) │ │ - Gemini 2.5 Flash / OpenAI     │
└───────────────────┬────────────────────┘ └─────────────┬───────────────────┘
                    │ Sincronización HTTPS               │ JSON Estructurado
                    ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 4: APLICACIÓN, API Y VALIDACIÓN DE NEGOCIO (Backend Layer)            │
│ Next.js Server Actions + Route Handlers (/api/*) + Esquemas Zod            │
│ [Motor de Reputación "Visto Bueno"] [Triaje SOS] [Fallback sin IA]         │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │ Consultas Parametrizadas
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 5: SEGURIDAD, PRIVACIDAD Y GOBERNANZA (Security & Privacy Layer)      │
│ Supabase Auth + Row Level Security (RLS) + Ofuscación Geográfica de PII    │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 6: PERSISTENCIA Y DOMINIO GEOESPACIAL (Data & Geo Layer)              │
│ PostgreSQL (Supabase) + Extensión PostGIS / Índices Geodésicos             │
│ Tablas: [profiles] [local_services] [endorsements] [community_posts]       │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 7: INFRAESTRUCTURA, DESPLIEGUE Y OBSERVABILIDAD (DevOps Layer)        │
│ Vercel Edge Network + GitHub Actions CI + Monitoreo de Latencia            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Desglose Detallado Capa por Capa

### Capa 1: Presentación y Experiencia Móvil (UI/UX Layer)
* **Objetivo:** Entregar una experiencia idéntica a una app nativa desde el navegador móvil, accesible para adultos mayores y operable bajo estrés en una emergencia.
* **Tecnologías:**
  * **Next.js (App Router) + React:** Renderizado híbrido y transiciones instantáneas.
  * **Tailwind CSS + shadcn/ui:** Sistema de diseño accesible con soporte de temas dinámicos mediante variables CSS.
  * **React-Leaflet + OpenStreetMap:** Mapa interactivo ligero sin bloqueo de llaves de pago.
  * **Lucide React:** Iconografía clara y semántica.
* **Componentes Críticos:**
  * `ModeThemeProvider`: Cambia la paleta completa entre Modo Barrio (tonos verdes/azules de confianza) y Modo Emergencia SOS (alto contraste rojo/ámbar/negro para ahorro de batería y visibilidad crítica).
  * `QuickPublishModal`: Implementa la **Regla de los 3 Clics** (Clic 1: Abrir y dictar/escribir $\rightarrow$ Clic 2: Confirmar pre-llenado de IA y GPS $\rightarrow$ Clic 3: Publicar).
  * `OnboardingTour`: Tutorial paso a paso superpuesto en el primer ingreso del vecino.

### Capa 2: Resiliencia Local y Sincronización Offline (Local-First Layer)
* **Objetivo:** Garantizar que la app funcione al $100\%$ cuando se cae la red celular o el WiFi durante un sismo o corte eléctrico.
* **Tecnologías:**
  * **Service Workers (`@serwist/next` o `@ducanh2912/next-pwa`):** Cachea el *App Shell* (HTML, JS, CSS, íconos) bajo la estrategia *Cache-First* y las rutas de datos bajo *Stale-While-Revalidate*.
  * **Dexie.js (IndexedDB):** Base de datos relacional en el navegador del celular.
* **Mecanismo de Funcionamiento:**
  1. Cada vez que hay conexión, el cliente descarga los oficios y reportes de un radio de $2\text{ km}$ y los guarda en las tablas locales de `Dexie.js` (`local_services_cache`, `posts_cache`).
  2. Si `navigator.onLine === false`, la app lee directamente de `Dexie.js` sin mostrar pantallas de error.
  3. Si el vecino publica un pedido de auxilio sin internet, el registro se inserta en la tabla local `sync_outbox` con estado `PENDING_SYNC` y se pinta de inmediato en su pantalla (*Optimistic UI*).
  4. Al dispararse el evento `window.addEventListener('online')`, el `SyncManager` recorre `sync_outbox` y envía el lote al backend.

### Capa 3: Orquestación de Inteligencia Artificial (AI Layer)
* **Objetivo:** Eliminar la fricción de llenar formularios largos en pantallas pequeñas y clasificar automáticamente las urgencias barriales.
* **Tecnologías:**
  * **Web Speech API (`webkitSpeechRecognition`):** Reconocimiento de voz nativo en el navegador (funciona sin costo de API y con latencia cero).
  * **Vercel AI SDK (`ai`):** Orquestador de llamadas a modelos de lenguaje con soporte nativo de `generateObject`.
  * **Modelo LLM:** **Gemini 2.5 Flash** (vía `@ai-sdk/google`) o **GPT-4o-mini** (vía `@ai-sdk/openai`), elegidos por tener una latencia inferior a $800\text{ ms}$ y costo mínimo por millón de tokens.
* **Funciones Clave de la IA:**
  1. **Extracción de Intención en 1 Clic (`parseNeighborIntent`):** Convierte frases coloquiales (*"Don Pepe necesita insulina urgente en el pasaje Los Pinos"*) en un objeto estructurado:
     * `mode`: `'EMERGENCIA'`
     * `post_type`: `'SOS_VULNERABLE'`
     * `category`: `'Salud'`
     * `urgency_level`: `'CRITICA'`
     * `clean_title`: `'Solicitud urgente de insulina'`
  2. **Filtro de Integridad Comunitaria:** Detecta si alguien intenta cobrar dinero en el módulo de "Cadena de Favores" y sugiere mover la publicación al módulo de "Servicios de Proximidad".

### Capa 4: Lógica de Aplicación y Transporte (API & Business Logic Layer)
* **Objetivo:** Centralizar las reglas de negocio, validar datos y calcular la confianza vecinal.
* **Tecnologías:**
  * **Next.js Route Handlers & Server Actions:** Endpoints RESTful (`/api/ai/parse`, `/api/sync`) y mutaciones directas tipadas.
  * **Zod:** Validación estricta de esquemas tanto en cliente como en servidor.
* **Algoritmo de Negocio — "Visto Bueno Vecinal":**
  Para evitar reseñas falsas, el puntaje de confianza $S$ de un oficio local se calcula ponderando la cercanía de los vecinos que lo recomiendan:
  $$S = \sum_{i=1}^{n} \left( w_i \cdot R_i \right)$$
  Donde $R_i \in \{1, \dots, 5\}$ es la calificación del vecino $i$, y el peso de verificación barrial $w_i$ es:
  $$w_i = \begin{cases} 1.5 & \text{si el vecino está verificado y a } d \le 500\text{ m} \\ 1.0 & \text{si el vecino está a } 500\text{ m} < d \le 1500\text{ m} \\ 0.3 & \text{si está fuera del radio barrial} \end{cases}$$

### Capa 5: Seguridad, Privacidad y Gobernanza (Security Layer)
* **Objetivo:** Proteger a los vecinos vulnerables (adultos mayores solos, niños) de robos o abusos durante emergencias.
* **Tecnologías y Controles:**
  * **Supabase Auth + Row Level Security (RLS):** Políticas SQL que garantizan que un usuario solo pueda editar sus propios registros y que un vecino solo pueda dar un (1) "Visto Bueno" por servicio.
  * **Ofuscación Geográfica de Datos Sensibles (PII Spatial Blurring):** Cuando se reporta a un vecino vulnerable en `SOS_VULNERABLE`, el servidor aplica una perturbación aleatoria controlada $(\Delta \text{lat}, \Delta \text{lng})$ dentro de un radio de $\approx 50\text{ m}$ para la vista pública del mapa, mostrando un círculo de zona en lugar del punto exacto de la puerta. La ubicación exacta solo es visible para cuentas con el rol `is_emergency_volunteer = true` (brigadistas/líderes vecinales).

### Capa 6: Persistencia y Dominio Geoespacial (Data Layer)
* **Objetivo:** Consultas rápidas por cercanía geográfica y almacenamiento transaccional confiable.
* **Tecnologías:**
  * **Supabase (PostgreSQL 16):** Base de datos relacional en la nube.
  * **Cálculo Geodésico (Fórmula de Haversine / PostGIS):** Filtrado eficiente de publicaciones dentro de una caja delimitadora (*Bounding Box*) o radio en kilómetros:
    $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$

### Capa 7: Infraestructura, Despliegue y Observabilidad (DevOps Layer)
* **Objetivo:** Mantener una URL de producción siempre activa para la demostración ante el jurado.
* **Tecnologías:**
  * **Vercel:** Despliegue continuo desde la rama `main` de GitHub con certificado SSL/HTTPS automático (obligatorio para que funcionen el GPS, el micrófono y los Service Workers en celulares reales).

---

## 4. Estructura de Carpetas del Proyecto (Feature-Sliced)

```text
red-vecina/
├── public/
│   ├── manifest.json            # Configuración PWA (íconos, colores, standalone)
│   └── icons/                   # Íconos instalables 192x192 y 512x512
├── src/
│   ├── app/                     # CAPA 1 y 4: Rutas Next.js App Router
│   │   ├── layout.tsx           # Shell móvil + Proveedor de Modo Dual + Offline Banner
│   │   ├── page.tsx             # Vista principal con Tabs (Mapa, Oficios, Solidaridad)
│   │   └── api/
│   │       ├── ai-parse/route.ts # CAPA 3: Endpoint de extracción en 1 clic con IA
│   │       └── sync/route.ts     # CAPA 2/4: Endpoint de sincronización de cola offline
│   ├── components/
│   │   ├── ui/                  # Componentes atómicos shadcn/ui
│   │   ├── layout/              # Header con Switch SOS, Barra de navegación inferior
│   │   ├── map/                 # Mapa Leaflet dinámico con pines por categoría
│   │   ├── directory/           # Tarjetas de Oficios + Botón "Visto Bueno Vecinal"
│   │   ├── solidarity/          # Muro de Cadena de Favores + Tablero Humanitario SOS
│   │   ├── publish/             # Modal de Publicación en 3 Clics + Micrófono IA
│   │   └── onboarding/          # Tutorial accesible de bienvenida
│   ├── lib/
│   │   ├── db/
│   │   │   ├── supabase.ts      # CAPA 6: Cliente Supabase y tipos SQL
│   │   │   ├── dexie.ts         # CAPA 2: Base de datos local IndexedDB + Cola Offline
│   │   │   └── seed-data.ts     # Datos semilla realistas para modo demo y fallback
│   │   ├── ai/
│   │   │   └── schemas.ts       # CAPA 3: Esquemas Zod para Structured Outputs de IA
│   │   └── utils/
│   │       └── geo.ts           # CAPA 6: Cálculo de distancia en metros y ofuscación
│   └── context/
│       └── AppModeContext.tsx   # Estado global: Modo Habitual vs. Modo Emergencia + Red
├── SPEC.md
├── ARCHITECTURE.md
├── PLAN.md
└── CLAUDE.md
```