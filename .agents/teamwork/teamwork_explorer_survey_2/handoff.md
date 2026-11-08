# Reporte de Investigación Técnica: Módulo de Mapa Interactivo (Estilo Uber/Delivery), Geolocalización y Filtro Hiperlocal (R2 y R3)

**Autor:** Explorer 2 (Survey Phase)  
**Fecha:** 2026-11-07  
**Estado:** Hard Handoff — Investigación Completa y Accionable

---

## 1. Observation (Observaciones Directas del Código y Entorno)

### 1.1. Estado de la Suite de Pruebas y Compilación
- **Comando:** `npm test` (ejecutado en `C:\Users\hugoc\OneDrive\Documentos\hackaton` vía Vitest v3.2.7).
  - **Resultado:** 13 archivos de prueba pasados (13/13), 63 pruebas exitosas (63/63), 0 fallos.
- **Comando:** `npm run typecheck` (`tsc --noEmit`).
  - **Resultado:** Código de salida 0, 0 errores de tipado TypeScript.

### 1.2. Implementación Actual del Mapa (`src/components/map/neighborhood-map.tsx`)
- **Librería de mapas utilizada:** Actualmente **NO se utiliza ninguna librería externa** (ni Leaflet, ni MapLibre, ni Google Maps). No están presentes en `package.json`.
- **Estructura gráfica:**
  - El mapa es un plano estático SVG renderizado con `<svg viewBox="0 0 400 320">` (líneas 195-244) con líneas vectoriales hardcodeadas simulando avenidas de Lima (`Av. Garzón`, `Jr. Huiracocha`, `Av. Húsares de Junín`).
  - Contiene únicamente un texto estático de atribución en línea 301: `"© Colaboradores de OpenStreetMap · React-Leaflet Compatible"`.
- **Proyección de Coordenadas:**
  - Definida en líneas 21-39:
    ```typescript
    const CENTER_LAT = -12.0752;
    const CENTER_LNG = -77.0485;
    const LAT_SPAN = 0.008;
    const LNG_SPAN = 0.008;

    export function projectCoordToViewport(lat: number, lng: number): { xPercent: number; yPercent: number } {
      const normX = 0.5 + (lng - CENTER_LNG) / LNG_SPAN;
      const normY = 0.5 - (lat - CENTER_LAT) / LAT_SPAN;
      const xPercent = Math.min(90, Math.max(10, Number((normX * 100).toFixed(2))));
      const yPercent = Math.min(90, Math.max(10, Number((normY * 100).toFixed(2))));
      return { xPercent, yPercent };
    }
    ```
  - **Limitación crítica observada:** Coordenadas centradas de forma fija e inmutable en Jesús María, Lima (`-12.0752, -77.0485`). Si se ingresan coordenadas de Huancayo (`-12.0653, -75.2049`), el cálculo arroja `normX = 230` y colapsa todos los marcadores en el límite `xPercent = 90%`.
- **Renderizado de Marcadores:**
  - Botones HTML absolutos posicionados mediante CSS inline: `style={{ left: `${xPercent}%`, top: `${yPercent}%` }}`.
  - Oficios: botón con clase `bg-sky-600 text-white rounded-full` y texto "Oficio" (líneas 247-267).
  - Publicaciones/Favores: botón con clase `bg-emerald-700 text-white` y texto "Favor" (líneas 269-298).
  - SOS Vulnerable: botón con clase `bg-red-700/90 text-yellow-200 border-yellow-300` y texto "SOS ~50m".
  - Círculo de privacidad SOS: Renderizado como `<circle cx={cx} cy={cy} r={34} fill="rgba(220, 38, 38, 0.28)" stroke="#f87171" strokeWidth="2" strokeDasharray="4 3" data-testid="sos-privacy-circle-50m" data-radius-meters={sosPost.privacy_radius_meters || 50} />`.
- **Interacción al tocar un marcador:**
  - Actualmente despliega un `<div>` estático debajo del mapa (`selectedListing` o `selectedPost`, líneas 324-409). **No cuenta con bottom sheet deslizable tipo Uber/Rappi ni trazado de rutas**.
- **Cálculo de Distancia:**
  - En `NeighborhoodMap`, **no se calcula ni muestra ninguna distancia** hacia los marcadores.
  - En cambio, en `src/components/views/proximity-catalog-view.tsx` (líneas 23-41), existe la función matemática Haversine `calculateDistanceMeters(lat1, lng1, lat2, lng2)` con radio esférico terrestre $R = 6,371,000$ m, pero sus parámetros por defecto están anclados a `SECTOR_CENTER_LAT = -12.0752` y `SECTOR_CENTER_LNG = -77.0485`.

### 1.3. Esquema de Datos de Pines y Coordenadas (`src/shared/types.ts`)
- **`IListingLocal` (Oficios y Productos Locales):**
  - `latitude: number`
  - `longitude: number`
  - `title: string`, `description: string`, `contact_phone: string`
  - `listing_type: 'SERVICIO_OFICIO' | 'PRODUCTO_LOCAL' | 'SOPORTE_EMERGENCIA'`
  - `available_for_emergencies: boolean`
  - `endorsement_count: number`, `weighted_trust_score: number`
- **`IPostLocal` (Muro Solidario y Alertas SOS):**
  - `public_lat: number`
  - `public_lng: number`
  - `privacy_radius_meters: number` (0 para ordinarios, 50 para `SOS_VULNERABLE`)
  - `post_type: 'SOLICITUD_FAVOR' | 'OFERTA_FAVOR' | 'SOS_VULNERABLE' | 'ALERTA_COMUNITARIA'`
  - `urgency_level: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'`
  - `status: 'ACTIVO' | 'EN_COORDINACION' | 'ATENDIDO' | 'ARCHIVADO'`

### 1.4. Arquitectura de Modo Offline y Almacenamiento Local
- **IndexedDB (Dexie.js):**
  - Ubicación: `src/lib/offline/db.ts`.
  - Tablas: `listings`, `posts`, `commitments`, `outbox`.
  - Semilla inicial: En `src/app/page.tsx` (líneas 34-50), si la base local está vacía, se inicializa con `INITIAL_SECTOR_LISTINGS` e `INITIAL_SECTOR_POSTS` de `src/lib/initial-data.ts`.
- **Service Worker:**
  - Archivo `public/sw.js`: Solo tiene en caché el App Shell básico `['/', '/manifest.json']` con estrategia Network-first / Cache fallback. **No almacena tiles cartográficos**.
- **Detección de Conexión:**
  - `src/lib/offline/sync-manager.ts` y `src/hooks/use-network-sync.ts` monitorean `window.addEventListener('online')` y `'offline'`, manteniendo el estado en memoria y sincronizando automáticamente la cola outbox al reconectar.

### 1.5. Componente Bottom Sheet en el Proyecto
- En `package.json` está instalado `"vaul": "^1.1.2"`.
- En `src/components/publish/quick-publish-sheet.tsx`, `vaul` (`Drawer.Root`, `Drawer.Portal`, `Drawer.Overlay`, `Drawer.Content`) ya está configurado y probado con animación táctil fluida para móviles.

### 1.6. Regla Estricta de Accesibilidad WCAG (Bloqueante de Tests)
- En `tests/e2e-audit-mod13.test.ts` (líneas 117-125):
  ```typescript
  const buttonTags = fullMarkup.match(/<button[^>]*>/g) ?? [];
  for (const btnTag of buttonTags) {
    const hasAccessibleTouchHeight =
      btnTag.includes('min-h-[48px]') ||
      btnTag.includes('min-h-[52px]') ||
      btnTag.includes('min-h-[56px]');
    expect(hasAccessibleTouchHeight).toBe(true);
  }
  ```
  **Todos los botones sin excepción (`<button>`) deben tener obligatoriamente la clase `min-h-[48px]`, `min-h-[52px]` o `min-h-[56px]`.**

### 1.7. Restricciones de Regresión en Tests Existentes
- `src/components/publish/__tests__/publish-map-mod11.test.ts` (líneas 126-129) verifica vía `renderToStaticMarkup`:
  - `data-testid="sos-privacy-circle-50m"`
  - `data-radius-meters="50"`
  - Texto `"SOS ~50m"`
  - Texto `"OpenStreetMap"`
- Vitest ejecuta pruebas en Node.js puro (`renderToStaticMarkup`). Cualquier importación síncrona en top-level de una librería que use `window` (como `L` de Leaflet sin verificación `typeof window !== 'undefined'`) provocará un fallo inmediato en SSR y tests.

---

## 2. Logic Chain (Cadena Lógica de Deducción)

1. **Premisa 1 (Requisito R2):** Se exige un módulo de mapa interactivo con OpenStreetMap, estilo Uber/delivery, con bottom sheet deslizable, marcadores categorizados, trazado de ruta/distancia estimada, y controles táctiles de zoom, recentrado, capas y pantalla completa, con resiliencia offline.
2. **Premisa 2 (Requisito R3):** Se exige un selector de radio hiperlocal ("200m · Mi cuadra", "500m · Mi barrio", "1 km · Mi sector") visible y sincronizado en tiempo real entre el mapa y el catálogo de proximidad.
3. **Premisa 3 (Requisito R1):** La app debe centrarse por defecto en Junín, Huancayo (`-12.0653, -75.2049`) y permitir cambiar de sector dinámicamente.
4. **Deducción sobre la librería de mapas:**
   - La implementación actual es un SVG estático anclado rígidamente a Lima. Para satisfacer R2 y R3 sin romper el renderizado estático en tests (Vitest `renderToStaticMarkup` y SSR de Next.js), existen dos vías viables:
     - **Vía A (Recomendada por Resiliencia y Cero Fricción): Motor de Tiles OpenStreetMap Reactivo Nativo + Overlay Vectorial de Capas.** Utiliza las URLs estándar de tiles OSM `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, gestos táctiles de paneo/zoom, overlay SVG para el trazado de ruta y marcadores enriquecidos, y fallback instantáneo a retícula vectorial cuando se corta la conexión o en modo avión. No añade dependencias pesadas en `node_modules`, funciona 100% en Node/Vitest, y no sufre problemas de empaquetado de CSS de Leaflet ni errores de SSR con `window`.
     - **Vía B (Leaflet dinámico):** Instalar `leaflet` y `@types/leaflet`. Requiere cargar Leaflet mediante `next/dynamic({ ssr: false })` o `import('leaflet')` dentro de `useEffect`, manteniendo un fallback estático SSR para que `renderToStaticMarkup` en Vitest continúe encontrando `data-testid="sos-privacy-circle-50m"` y las cadenas requeridas.
5. **Deducción sobre el Bottom Sheet Interactivo:**
   - Como `vaul` ya está instalado en el proyecto y probado en `quick-publish-sheet.tsx`, la tarjeta inferior deslizable debe implementarse con `vaul` (`Drawer.Root`, `Drawer.Content`), desplegándose al tocar cualquier marcador. Debe mostrar: icono de categoría, título, badge de disponibilidad, distancia calculada ("a 180 m · ~2 min caminando"), puntaje de visto bueno vecinal o nivel de urgencia, botón verde de llamada telefónica directa (`tel:...`) y botón de acción ("Dar Visto Bueno", "Ofrecer Ayuda", "Ver Ruta").
   - Para reportes SOS, debe conservar el flujo de desbloqueo auditado de Bóveda PII para Brigadistas (MOD-11).
6. **Deducción sobre el Trazado de Ruta/Distancia (Estilo Delivery):**
   - Al seleccionar un marcador, se debe calcular la distancia geodésica con Haversine y proyectar una línea visual animada discontinua (`strokeDasharray: "6 4"`) entre el pin del usuario y el marcador seleccionado, con un badge flotante en el centro que indique: `"180 m · ~2 min a pie"`.
7. **Deducción sobre el Selector de Radio Hiperlocal (R3):**
   - El estado del radio seleccionado (`200 | 500 | 1000 | null`) debe compartirse entre `NeighborhoodMap` y `ProximityCatalogView`.
   - Se debe ubicar un control segmentado táctil visible en la parte superior del catálogo y en los controles del mapa.
   - En el mapa, se debe proyectar un círculo geodésico translúcido centrado en la ubicación del usuario correspondiente al radio activo (200m, 500m o 1km).
   - Tanto el mapa como el catálogo deben filtrar de inmediato los elementos cuya distancia sea mayor al radio seleccionado.

---

## 3. Caveats (Advertencias, Supuestos y Riesgos)

1. **Compatibilidad con SSR en Vitest:** Los tests existentes `publish-map-mod11.test.ts` y `e2e-audit-mod13.test.ts` renderizan `NeighborhoodMap` directamente en Node mediante `renderToStaticMarkup`. Si se usa Leaflet directo sin un guardia `typeof window !== 'undefined'`, las pruebas fallarán por falta de APIs del navegador (`window`, `navigator`, `HTMLCanvasElement`). El componente debe renderizar siempre un contenedor SSR válido con todos los atributos `data-testid`.
2. **Cumplimiento WCAG 48px:** Cualquier nuevo botón (controles de zoom `+`/`-`, recentrado, alternador de capas, pantalla completa, píldoras de radio 200m/500m/1km, botones del bottom sheet) **debe tener estrictamente la clase `min-h-[48px]`** para no provocar regresiones en `tests/e2e-audit-mod13.test.ts`.
3. **Caché Offline de Tiles OSM:** Si el usuario no ha cargado previamente los tiles de OpenStreetMap y entra en Modo Avión, las imágenes de tiles HTTP fallarán. Por ello, el mapa debe contar con un fondo o retícula cartográfica SVG elegante de respaldo para que la interfaz nunca muestre imágenes rotas y los marcadores sigan siendo 100% operativos sin red.
4. **Coordenadas de Huancayo vs Lima:** Los tests unitarios `views-mod12.test.ts` y `publish-map-mod11.test.ts` pasan coordenadas iniciales de Lima (`-12.0752, -77.0485`). La lógica de cálculo y centrado del mapa debe ser dinámica: usar la ubicación activa (Huancayo por defecto para la experiencia del usuario, o la ubicación de las semillas pasadas por props en los tests).

---

## 4. Conclusion (Diagnóstico Final y Plan de Acción)

El módulo actual de mapa es un prototipo vectorial fijo para Jesús María. Para cumplir a cabalidad R2 y R3 preservando la resiliencia offline y el pase del 100% de la suite de tests, se deben implementar las siguientes modificaciones arquitectónicas:

### 4.1. Archivos a Modificar
1. **`src/components/map/neighborhood-map.tsx`:**
   - Rediseño completo a experiencia interactiva estilo Uber/Delivery.
   - Soporte de centrado dinámico (Huancayo por defecto: `lat: -12.0653, lng: -75.2049`).
   - Integración de cartografía OpenStreetMap con capa de respaldo offline resiliente.
   - Marcadores visuales de alto impacto por categoría (iconos Lucide, colores distintivos, badges de distancia y pin GPS del usuario con pulso animado).
   - Trazado de ruta visual con línea punteada dinámica y tiempo estimado a pie al seleccionar cualquier pin.
   - Bottom sheet interactivo deslizable utilizando `vaul` (`Drawer`), con información contextual completa, llamada rápida y desbloqueo auditado de PII para Brigadistas.
   - Controles táctiles fluidos: Zoom in/out, Botón de recentrado en mi ubicación, Filtro de capas y Conmutador de pantalla completa.
   - Visualización del círculo de radio hiperlocal activo (200m / 500m / 1km).
   - Inclusión obligatoria de `min-h-[48px]` en todos los botones y preservación de atributos de test (`data-testid="sos-privacy-circle-50m"`, etc.).
2. **`src/components/views/proximity-catalog-view.tsx`:**
   - Incorporación del selector visual rápido de radio hiperlocal ("200m · Mi cuadra", "500m · Mi barrio", "1 km · Mi sector").
   - Filtrado en tiempo real de las tarjetas según `distanceMeters <= activeRadius`.
   - Conexión del cálculo de distancia con la ubicación activa del usuario.
3. **`src/components/layout/top-bar.tsx`:**
   - Sustituir el texto fijo `"Jesús María · Sector 4"` por un selector interactivo de territorio que permita elegir entre "Huancayo · Centro", "Huancayo · El Tambo", "Huancayo · San Carlos", "Jesús María" y "Zonas Críticas de Desastre".
4. **`src/app/page.tsx`:**
   - Proveer el estado sincronizado de `activeRadius` y `userLocation` entre el catálogo y el mapa.
5. **`public/sw.js`:**
   - Añadir soporte de almacenamiento en caché para tiles de OpenStreetMap (`tile.openstreetmap.org`) con estrategia Stale-While-Revalidate o Cache-First para potenciar la navegación offline.

### 4.2. Nuevos Archivos Recomendados
1. **`src/context/location-context.tsx`:** Contexto centralizado para la ubicación activa del usuario (Huancayo por defecto), selector de radio hiperlocal sincronizado (200m / 500m / 1000m) y recentrado GPS.
2. **`src/lib/geo-utils.ts`:** Utilidades geodésicas unificadas (fórmula de Haversine, cálculo de distancias, estimación de tiempo a pie a 4.5 km/h, y proyección de coordenadas).

---

## 5. Verification Method (Método de Verificación Independiente)

1. **Verificación de Pruebas Automatizadas:**
   ```powershell
   cd C:\Users\hugoc\OneDrive\Documentos\hackaton
   npm test
   ```
   *Criterio de aceptación:* Los 13 suites de prueba (y las nuevas pruebas que se añadan) deben pasar con 0 fallos.

2. **Verificación de Tipado Estricto:**
   ```powershell
   cd C:\Users\hugoc\OneDrive\Documentos\hackaton
   npm run typecheck
   ```
   *Criterio de aceptación:* 0 errores de TypeScript (`tsc --noEmit`).

3. **Verificación de Accesibilidad WCAG (Botones >= 48px):**
   - Ejecutar la prueba `tests/e2e-audit-mod13.test.ts`. Todos los botones creados en el mapa y en el selector de radio deben superar la aserción de `min-h-[48px]`.

4. **Verificación Funcional R2 y R3:**
   - El mapa renderiza los marcadores con OpenStreetMap.
   - Al pulsar un marcador, se abre el bottom sheet deslizable con título, categoría, distancia calculada y botón de llamada.
   - Se traza la línea visual de ruta estimada entre el usuario y el punto seleccionado.
   - Al cambiar el radio hiperlocal a 200m, 500m o 1km, tanto el mapa como el catálogo ocultan inmediatamente los servicios fuera del perímetro.
