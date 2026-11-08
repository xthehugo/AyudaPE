# Handoff Report: Challenger M2-1 — Verificación Empírica y Pruebas de Estrés Adversarias (Milestone 2)

**Agente:** Challenger M2-1 (Adversarial Critic & Domain Specialist)  
**Fecha:** 2026-11-07  
**Veredicto Final:** **APPROVE**  
**Tipo de Handoff:** Hard Handoff (Auditoría Completa, Pruebas Empíricas Ejecutadas)  

---

## 1. Observation (Observaciones Directas)

1. **Estado del Repositorio y Código Evaluado:**
   - Componente principal: `src/components/map/neighborhood-map.tsx` (1,165 líneas). Integra OpenStreetMap, retícula vectorial SVG nativa (`viewBox="0 0 400 320"`), Vaul Drawer bottom sheet, trazado visual de ruta discontinua (`strokeDasharray="6 4"`), badge flotante de distancia/tiempo a pie, 18 botones interactivos y modal de justificación forense PII (Ley N° 29733).
   - Utilidades geodésicas: `src/lib/geo-utils.ts` (113 líneas). Implementa `calculateDistanceMeters` (Haversine), `formatDistance`, `estimateWalkingMinutes` (4.5 km/h = 75 m/min) y `applySpatialBlurring50m` (35-50 metros determinista).
   - Service Worker: `public/sw.js` (57 líneas). Implementa Stale-While-Revalidate en la caché `redvecina-tiles-v1` para `tile.openstreetmap.org`.

2. **Ejecución de Pruebas de Estrés Adversarias (`tests/m2-challenger-stress.test.ts`):**
   - Se diseñó y ejecutó la suite adversarial independiente `tests/m2-challenger-stress.test.ts` que contiene 23 pruebas divididas en los 5 ejes obligatorios:
     - **Eje 1: Límites Geodésicos y Listas Vacías:** Coordenadas extremas (polos `[90, 0]`, antimeridiano `[0, 180]`, fuera de escala `[1000, 2000]`, `[-5000, -5000]`), zoom scales de 0.5x a 100x, listas vacías (`initialListings: []`, `initialPosts: []`) y registros dispersos. Resultado: 5/5 pasados.
     - **Eje 2: Bottom Sheet y Disparadores:** Derivación canónica `deriveMapSelectionTarget` para LISTING, POST Solidario y SOS; ciclo reactivo de apertura/cierre del Vaul Drawer; validación de justificación PII >= 10 caracteres; y blurring de privacidad de 50 metros comprobado con 7 semillas distintas (distancias de perturbación entre 30m y 50m). Resultado: 6/6 pasados.
     - **Eje 3: Ruteo y Tiempos a Pie:** Distancias cortas (<200m: 50m -> 1 min, 180m -> 2 min), medias (~500m: 400m -> 5 min, 500m -> 7 min, 750m -> 10 min, 999m -> "999 m") y largas (>1km: 1000m -> "1.0 km" / 13 min, 1400m -> "1.4 km" / 19 min, 2500m -> "2.5 km" / 33 min, 10000m -> "10.0 km" / 133 min). Punto medio de la ruta acotado en viewport. Resultado: 4/4 pasados.
     - **Eje 4: Accesibilidad Táctil WCAG AAA (Botones >= 48px):** Inspección exhaustiva de los 18 botones de `neighborhood-map.tsx`. El 100% de los botones cuenta con `min-h-[48px]` y los controles táctiles cuentan con `min-w-[48px]`. Resultado: 4/4 pasados.
     - **Eje 5: Resiliencia Offline:** Canvas vectorial SVG presente con nombres de vías urbanas (Av. Mariscal Castilla, Av. Huancavelica), manejador `onError` silencioso en tiles de OpenStreetMap, botón para alternar capas (OSM vs Vectorial) y Service Worker con caché de tiles. Resultado: 4/4 pasados.

3. **Verificación de Comandos y Herramientas:**
   - `npm run typecheck`: Salida código 0, 0 errores de TypeScript (`tsc --noEmit`).
   - `npx vitest run tests/m2-challenger-stress.test.ts`: 1 test file, 23 tests pasados en 114ms.
   - `npm test`: 22 test files pasados, 275 tests pasados (100% verde, 0 fallos, 0 regresiones).
   - `npm run build`: Compilación de producción de Next.js 14 exitosa con código 0 (15 rutas generadas sin errores).

---

## 2. Logic Chain (Cadena Lógica de Inferencia)

1. **Robustez ante Datos Malformados y Límites Extremos:**
   - La función `projectCoordToViewport` acota `normX` y `normY` mediante `Math.min(90, Math.max(10, ...))`. Esto previene desbordamientos del viewport SVG o renderizado fuera de la pantalla incluso con coordenadas imposibles o factores de zoom extremos de 100x.
   - El componente `NeighborhoodMap` no asume la presencia obligatoria de campos opcionales (`contact_phone`, `description`, `privacy_radius_meters`), utilizando fallbacks seguros (`item.id ?? 1`, `radius || 50`).

2. **Fidelidad del Bottom Sheet y Experiencia Delivery:**
   - Al tocar un marcador, se dispara `handleSelectListing` o `handleSelectPost`, generando un `selectedTarget` con el contrato unificado `IMapSelectionTarget`.
   - `Drawer.Root` de Vaul recibe `open={!!selectedTarget}` y se sincroniza con el estado reactivo. Al deslizar hacia abajo o presionar el botón de cierre, `onOpenChange(false)` limpia el objetivo seleccionado y oculta la tarjeta.
   - La llamada directa (`tel:...`) se renderiza únicamente cuando el registro dispone de número telefónico.

3. **Consistencia de las Fórmulas de Ruteo:**
   - La fórmula Haversine unificada en `src/lib/geo-utils.ts` calcula distancias exactas con radio terrestre canónico de 6,371,000 metros.
   - La velocidad peatonal asumida de 4.5 km/h (75 m/min) produce tiempos intuitivos: cualquier distancia positiva menor a 75 metros redondea al mínimo de 1 minuto (`Math.max(1, Math.round(meters / 75))`), evitando tiempos irreales de 0 minutos para vecinos en movimiento.
   - `formatDistance` transiciona de forma limpia de metros a kilómetros en la frontera exacta de 1,000 metros ("999 m" -> "1.0 km").

4. **Cumplimiento Incondicional de Accesibilidad Táctil:**
   - La auditoría automatizada en código fuente comprobó que los 18 bloques de botón en `neighborhood-map.tsx` contienen la clase `min-h-[48px]`.
   - Los botones de acción rápida, controles de mapa (+, -, Recentrar, Capas, Pantalla Completa) y marcadores cumplen con los 48x48 píxeles mínimos exigidos por WCAG AAA para adultos mayores en situaciones de emergencia.

5. **Independencia de Conexión en Catástrofes:**
   - Al cortar la conexión a internet (modo avión), los tiles de OpenStreetMap que no puedan descargarse son interceptados por el manejador `onError` sin generar pantallas blancas ni consolas de error.
   - La retícula vectorial SVG subyacente proporciona referencias espaciales inmediatas con las avenidas principales de Huancayo (El Tambo) y Jesús María, y el Service Worker mantiene una caché local persistente de tiles (`redvecina-tiles-v1`).

---

## 3. Caveats (Advertencias y Límites de la Revisión)

- **Simulación en Entorno Node.js / JSDOM:** Las pruebas de gestos de arrastre táctil (pan/drag) se verificaron analizando los manejadores de eventos `onPointerDown`, `onPointerMove` y `onPointerUp` y su impacto en el desplazamiento `panOffset`. No se ejecutó sobre un dispositivo físico real con pantalla capacitiva.
- **Sin Dependencia de APIs Externas:** El sistema no depende de servidores de mapas propietarios (Google Maps o Mapbox) ni de claves de API externas que puedan caducar o requerir facturación, cumpliendo con la directiva de autonomía local y cero costos.

---

## 4. Conclusion (Veredicto Final)

**Veredicto: APPROVE**

El módulo de Mapa Interactivo Estilo Uber/Delivery con Vaul Bottom Sheet y Ruteo (Milestone 2 - R2: F5, F6, F7, F8) ha superado exitosamente todas las pruebas de estrés, casos límite y auditorías de accesibilidad.
- 0 errores de compilación (`npm run typecheck`).
- 0 fallos de pruebas (`npm test`: 22 suites, 275 tests pasados).
- 23/23 pruebas adversarias dedicadas aprobadas en `tests/m2-challenger-stress.test.ts`.
- Compilación de producción Next.js 14 exitosa (`npm run build`).

El hito Milestone 2 queda certificado como **ROBUSTO, SEGURO Y LISTO PARA INTEGRACIÓN**.

---

## 5. Verification Method (Método de Verificación Independiente)

Cualquier agente o revisor puede reproducir y verificar de forma independiente estos resultados ejecutando los siguientes comandos en la raíz del proyecto:

1. **Verificación de Tipos TypeScript:**
   ```powershell
   cd C:\Users\hugoc\OneDrive\Documentos\hackaton
   npm run typecheck
   ```
   *Salida esperada:* Código de salida 0 sin advertencias ni errores.

2. **Ejecución de la Suite de Estrés Adversaria del Challenger:**
   ```powershell
   cd C:\Users\hugoc\OneDrive\Documentos\hackaton
   npx vitest run tests/m2-challenger-stress.test.ts
   ```
   *Salida esperada:* 23 tests pasados en 1 archivo de prueba.

3. **Ejecución de la Suite Completa del Proyecto:**
   ```powershell
   cd C:\Users\hugoc\OneDrive\Documentos\hackaton
   npm test
   ```
   *Salida esperada:* 22 suites pasadas, 275 tests pasados (100% verde).

4. **Compilación de Producción:**
   ```powershell
   cd C:\Users\hugoc\OneDrive\Documentos\hackaton
   npm run build
   ```
   *Salida esperada:* Next.js App Router compila 15 rutas estáticas y dinámicas con código 0.
