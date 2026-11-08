# Project: RedVecina — Experiencia Hiperlocal Huancayo, Mapa Estilo Uber & Modo Pitch Jurado 180s

## Architecture

RedVecina es una plataforma web progresiva (PWA) hiperlocal y resiliente para la economía vecinal y respuesta ante catástrofes, construida sobre Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI, Vaul (Bottom Sheet Drawer), Dexie.js 4 (IndexedDB con Transactional Outbox) y Drizzle ORM.

### Flujo de Datos y Capas Arquitectónicas
1. **Capa de Dominio y Tipos (`src/shared/types.ts` & `src/shared/schemas.ts`):**
   - Entidades base: `IListingLocal`, `IPostLocal`, `ICommitmentLocal`, `ITerritorySector`.
   - Modos operativos: `HABITUAL` y `EMERGENCIA`.
   - Esquemas Zod para validación estricta de coordenadas, radios de privacidad y datos PII.
2. **Capa de Estado y Contexto Geográfico (`src/context/location-context.tsx` & `src/context/mode-context.tsx`):**
   - `LocationContext`: Gestiona la ubicación activa (Huancayo por defecto: El Tambo, San Carlos, Centro Urbano, Zonas Críticas y Jesús María), el radio hiperlocal activo (`200m`, `500m`, `1000m` o sin límite) y el recentrado GPS.
   - `ModeContext`: Gestiona el modo dual (Habitual vs Emergencia), escala de fuente accesible y rol del usuario (`VECINO`, `BRIGADISTA_CERTIFICADO`, `OPERADOR_MUNICIPAL`).
3. **Capa Local-First y Resiliencia Offline (`src/lib/offline/` & `public/sw.js`):**
   - `RedVecinaLocalDB` (Dexie.js v4): Almacén persistente local para publicaciones, oficios, compromisos, cola outbox y tabla local de auditoría PII.
   - `SyncManager`: Monitoreo reactivo de conectividad online/offline conmutado en tiempo real sin recargar página.
   - Cartografía OpenStreetMap resiliente: tiles con fallback a retícula vectorial offline elegante en modo avión.
4. **Capa de Presentación e Interacción (`src/components/`):**
   - `NeighborhoodMap`: Mapa interactivo estilo Uber/delivery con OpenStreetMap, marcadores categorizados por color/icono, trazado dinámico de ruta con tiempo a pie, y tarjeta inferior deslizable (*Bottom Sheet* con `vaul`).
   - `ProximityCatalogView` & `SolidarityWallView`: Vistas reactivas filtradas en tiempo real por el selector de radio hiperlocal.
   - `PitchJuryPanel`: Widget interactivo flotante para la evaluación de 180s ante el jurado con cronómetro y disparadores de las 3 simulaciones del video.
   - `TopBar`: Selector interactivo de territorio accesible con soporte de cambio rápido de ubicación.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Selector de Ubicación Hiperlocal | Selector en cabecera para alternar entre Huancayo (El Tambo, San Carlos, Centro), Zonas Críticas y Jesús María | M1 | ORIGINAL_REQUEST § R1 |
| F2 | Semillas de Huancayo: Muro Solidario | Préstamo gratuito de muletas ortopédicas y carpooling/pool escolar vecinal verificado | M1 | ORIGINAL_REQUEST § R1 |
| F3 | Semillas de Huancayo: Catálogo Proximidad | Lasañas y postres caseros, clases de matemáticas/nivelación, gasfitería, electricidad, enfermería | M1 | ORIGINAL_REQUEST § R1 |
| F4 | Semillas de Huancayo: Emergencias | Puntos de acopio, balones de oxígeno, brigadas vecinales y puntos de encuentro ante sismos y Fenómeno El Niño | M1 | ORIGINAL_REQUEST § R1 |
| F5 | Mapa Interactivo OpenStreetMap Resiliente | Cartografía fluida con OpenStreetMap y fallback vectorial offline garantizado sin errores SSR en Vitest | M2 | ORIGINAL_REQUEST § R2 |
| F6 | Bottom Sheet Deslizable Estilo Uber/Delivery | Tarjeta inferior interactiva (Vaul Drawer) al tocar marcadores con badge, distancia, llamada y acciones | M2 | ORIGINAL_REQUEST § R2 |
| F7 | Marcadores Categorizados y Trazado de Ruta | Marcadores diferenciados (oficio, producto, solidario, emergencia) con línea visual y tiempo estimado a pie | M2 | ORIGINAL_REQUEST § R2 |
| F8 | Controles Táctiles del Mapa | Zoom in/out, recentrar en mi ubicación, alternador de capas y pantalla completa con botones >= 48px | M2 | ORIGINAL_REQUEST § R2 |
| F9 | Selector de Radio Hiperlocal Configurable | Control visual rápido ("200m · Mi cuadra", "500m · Mi barrio", "1 km · Mi sector") | M3 | ORIGINAL_REQUEST § R3 |
| F10 | Sincronización Inmediata Mapa y Catálogo | Filtrado instantáneo geodésico Haversine de marcadores en el mapa y tarjetas en el catálogo según el radio | M3 | ORIGINAL_REQUEST § R3 |
| F11 | Cronómetro Regresivo Jurado (180s) | Cronómetro de 3 minutos visual con estados de color e inicio/pausa/reinicio accesible | M4 | ORIGINAL_REQUEST § R4 |
| F12 | Simulación 1: Caída de Red / Modo Avión | Conmutación instantánea a offline en 1 clic mostrando navegación sin internet | M4 | ORIGINAL_REQUEST § R4 |
| F13 | Simulación 2: Publicación SOS con Blur 50m | Creación de alerta SOS por voz con difuminado geográfico auditado a 50 metros | M4 | ORIGINAL_REQUEST § R4 |
| F14 | Simulación 3: Desbloqueo Bóveda PII con Log | Desbloqueo de datos sensibles por Brigadista con visualizador de auditoría local visible (Ley 29733) | M4 | ORIGINAL_REQUEST § R4 |
| F15 | Suite de Pruebas E2E (Tiers 1-4) | Conjunto exhaustivo de pruebas opacas para verificar F1-F14 sin regresiones | E2E-TEST | ORIGINAL_REQUEST § Acceptance Criteria |
| F16 | Pase Final E2E y Hardening Adversarial | Validación 100% de tests E2E y pruebas adversarias de casos límite y robustez | M5 | ORIGINAL_REQUEST § Calidad |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Creación de suite integral de pruebas para R1-R4 (Tiers 1-4), publica TEST_READY.md | none | DONE |
| M1 | Semillas y Selector de Ubicación Hiperlocal | F1, F2, F3, F4: LocationContext, selector en TopBar, semillas de Huancayo y zonas de desastre | none | DONE |
| M2 | Módulo de Mapa Uber/Delivery con Bottom Sheet | F5, F6, F7, F8: OpenStreetMap, Vaul drawer bottom sheet, marcadores, trazado de ruta, controles táctiles | M1 | DONE |
| M3 | Selector de Radio Hiperlocal Sincronizado | F9, F10: Píldoras de 200m/500m/1km sincronizadas en catálogo y mapa con filtro Haversine | M1, M2 | DONE |
| M4 | Panel Interactivo "Modo Presentación Jurado (180s)" | F11, F12, F13, F14: PitchJuryPanel flotante con cronómetro, 3 simulaciones en vivo y log PII | M1, M2, M3 | DONE |
| M5 | Integración Final, Pase 100% E2E y Hardening | F15, F16: Validación de 100% tests E2E, auditoría forense sin trampas, typecheck estricto | E2E, M4 | IN_PROGRESS |

---

## Interface Contracts

### 1. `LocationContext` (`src/context/location-context.tsx`)
```typescript
export interface ITerritorySector {
  id: string;
  name: string;
  district: string;
  department: string;
  centerLat: number;
  centerLng: number;
  zoomLevel: number;
  isCatastropheZone?: boolean;
}

export type HyperlocalRadiusMeters = 200 | 500 | 1000 | null;

export interface ILocationContextState {
  currentSector: ITerritorySector;
  availableSectors: ITerritorySector[];
  activeRadius: HyperlocalRadiusMeters;
  userCoords: { lat: number; lng: number };
  setSector: (sectorId: string) => void;
  setActiveRadius: (radius: HyperlocalRadiusMeters) => void;
  recenterToUser: () => void;
}
```

### 2. Utilidades Geodésicas (`src/lib/geo-utils.ts`)
```typescript
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number;
export function formatDistance(meters: number): string; // "180 m" o "1.4 km"
export function estimateWalkingMinutes(meters: number): number; // Basado en 4.5 km/h
export function applySpatialBlurring50m(lat: number, lng: number, seed?: string): { blurredLat: number; blurredLng: number; radiusMeters: 50 };
```

### 3. Log de Auditoría PII Local (`src/lib/offline/db.ts` / `pii-audit-store`)
```typescript
export interface ILocalPiiAuditRecord {
  id: string;
  timestamp: string;
  post_id: number;
  requester_role: string;
  requester_name: string;
  access_reason: string;
  compliance_legal: 'LEY_29733_ART_17';
}
```

### 4. Bottom Sheet State en Mapa (`src/components/map/neighborhood-map.tsx`)
```typescript
export interface IMapSelectionTarget {
  type: 'LISTING' | 'POST';
  id: number;
  title: string;
  category: string;
  badgeType: 'SOLIDARIO' | 'COMERCIAL' | 'EMERGENCIA';
  latitude: number;
  longitude: number;
  distanceMeters: number;
  contactPhone?: string;
  availableForEmergencies?: boolean;
  trustScore?: number;
  urgencyLevel?: string;
  privacyRadiusMeters?: number;
  isPiiProtected?: boolean;
}
```

---

## Code Layout

- `src/context/location-context.tsx`: Contexto reactivo para territorio activo, coordenadas y radio hiperlocal.
- `src/lib/geo-utils.ts`: Cálculo geodésico Haversine unificado, formateo de distancias y proyección.
- `src/lib/initial-data.ts`: Colección completa de semillas locales para Huancayo (El Tambo, San Carlos, Centro) y Zonas Críticas.
- `src/components/layout/top-bar.tsx`: Selector interactivo de ubicación accesible en cabecera.
- `src/components/map/neighborhood-map.tsx`: Mapa interactivo estilo Uber/Delivery, OpenStreetMap, Vaul Bottom Sheet y trazado de ruta.
- `src/components/views/proximity-catalog-view.tsx`: Catálogo con selector de radio hiperlocal sincronizado y filtrado dinámico.
- `src/components/presentation/pitch-jury-panel.tsx`: Componente flotante para evaluación de jurado (cronómetro 180s y 3 simulaciones).
- `tests/e2e/`: Suites de pruebas automatizadas E2E Tiers 1-4.
