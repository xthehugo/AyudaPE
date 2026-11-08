# Reporte de Revisión y Crítica Adversaria — Hito 1 (Milestone 1)

**Proyecto:** RedVecina — Experiencia Hiperlocal Huancayo, Mapa Estilo Uber & Modo Pitch Jurado 180s  
**Módulo:** Hito 1 — Semillas y Selector de Ubicación Hiperlocal (R1 / F1-F4)  
**Revisor & Crítico:** Reviewer M1-1 (`teamwork_reviewer_m1_1`)  
**Fecha:** 2026-11-07  
**Veredicto Oficial:** **APPROVE**  
**Evaluación de Riesgo Adversario:** **LOW**

---

## 1. Observation (Observaciones Directas con Evidencia Verificada)

### 1.1 Inspección Forense de Archivos de Código Fuente

1. **`src/lib/geo-utils.ts`**:
   - `calculateDistanceMeters(lat1, lon1, lat2, lon2)` (líneas 16-41): Implementa la fórmula esférica de Haversine genuina con $R = 6,371,000$ m. No contiene valores hardcodeados ni bypasses. Para coordenadas idénticas retorna de inmediato `0`.
   - `formatDistance(meters)` (líneas 47-56): Formatea distancias de manera legible y accesible. Distancias $<1000$ m se expresan en `"X m"`, distancias $\ge 1000$ m en `"X.Y km"` con 1 decimal. Maneja de forma segura valores negativos, `null` o `NaN` devolviendo `'0 m'`.
   - `estimateWalkingMinutes(meters)` (líneas 62-68): Calcula tiempo a pie basado en $4.5$ km/h ($75$ m/min). Garantiza un mínimo de 1 minuto para distancias $>0$.
   - `applySpatialBlurring50m(lat, lng, seed)` (líneas 83-112): Implementa perturbación determinista en un anillo entre 35 y 49 metros (`radiusMeters = 35 + (hash % 15)`), garantizando estrictamente una desviación $\le 50$ m en cumplimiento de la Ley N° 29733 (RN-04). Retorna `{ blurredLat, blurredLng, public_lat, public_lng, radiusMeters: 50 }`.

2. **`src/context/location-context.tsx`**:
   - Cumple 1:1 con el contrato de interfaz especificado en `PROJECT.md § Interface Contracts`: `ITerritorySector`, `HyperlocalRadiusMeters`, `ILocationContextState`.
   - `AVAILABLE_SECTORS` (líneas 40-97) define 6 sectores completos:
     * `huancayo-el-tambo`: El Tambo, Junín (`-12.0528, -75.2155, zoom: 15`). Definido como `DEFAULT_SECTOR`.
     * `huancayo-san-carlos`: San Carlos, Junín (`-12.0625, -75.2005, zoom: 15`).
     * `huancayo-centro`: Centro Urbano, Junín (`-12.0678, -75.2085, zoom: 15`).
     * `zona-critica-huaytapallana`: Falla Huaytapallana, Junín (`-12.048, -75.195, zoom: 14, isCatastropheZone: true`).
     * `zona-critica-mantaro`: Mantaro / El Niño, Junín (`-12.058, -75.228, zoom: 14, isCatastropheZone: true`).
     * `lima-jesus-maria-4`: Jesús María Sector 4, Lima (`-12.0752, -77.0485, zoom: 15`).
   - `defaultContextState` (líneas 104-112): Provee un estado seguro por defecto para evitar roturas de renderizado en pruebas unitarias y SSR cuando `useLocation()` es invocado fuera de `<LocationProvider>`.
   - `LocationProvider` (líneas 122-242): Persistencia con sincronización en `localStorage` con captura de excepciones para entornos restrictivos. Función `recenterToUser()` con soporte de `navigator.geolocation` y fallback al centroide del sector activo.

3. **`src/lib/initial-data.ts`**:
   - Preserva intactos los 6 registros de catálogo de Jesús María (`JESUS_MARIA_LISTINGS`, IDs 1 al 6) y los 4 de publicaciones (`JESUS_MARIA_POSTS`, IDs 1 al 4) para asegurar retrocompatibilidad sin regresión.
   - Incorpora todas las semillas requeridas por R1 y documentadas por Mario Cortijo para Huancayo y Zonas Críticas:
     * **Muro Solidario (Cero Dinero):** Préstamo gratuito de muletas ortopédicas y andador clínico sin costo en El Tambo (`HUANCAYO_SECTOR_POSTS` ID 11); Pool escolar y carpooling vecinal para colegios Claretiano y San Agustín (`HUANCAYO_SECTOR_POSTS` ID 12). Ninguna publicación contiene términos monetarios o cobros encubiertos (`MONEY_REGEX.test === false`).
     * **Catálogo de Proximidad:** Lasañas caseras y postres de la vecina Gladys (`HUANCAYO_SECTOR_LISTINGS` ID 11); Clases de matemáticas y nivelación escolar con el Prof. Yuri (`HUANCAYO_SECTOR_LISTINGS` ID 12); Gasfitería Maestro Teodoro con termas solares y motobomba (`HUANCAYO_SECTOR_LISTINGS` ID 13); Electricidad Integral Técnico Wálter (`HUANCAYO_SECTOR_LISTINGS` ID 14); Enfermería Lic. Maritza con soporte de oxígeno 24/7 (`HUANCAYO_SECTOR_LISTINGS` ID 15); Cerrajería de emergencia Don Pancho (`HUANCAYO_SECTOR_LISTINGS` ID 17).
     * **Emergencias y Catástrofes:** Punto de acopio oficial en Coliseo Municipal de El Tambo (`HUANCAYO_SECTOR_LISTINGS` ID 16 y `HUANCAYO_SECTOR_POSTS` ID 13); Brigada vecinal ante sismos en Parque Bolognesi (`HUANCAYO_SECTOR_POSTS` ID 14); Brigada de rescate andino en Falla Huaytapallana (`HUANCAYO_SECTOR_LISTINGS` ID 18); Alerta SOS de oxígeno con difuminado de 50 metros (`HUANCAYO_SECTOR_POSTS` ID 15); Cuadrilla de mitigación ante crecida del Río Mantaro (`HUANCAYO_SECTOR_LISTINGS` ID 19 y `HUANCAYO_SECTOR_POSTS` ID 16).
   - Todos los teléfonos celulares cumplen con el patrón peruano móvil `9XX-XXX-XXX` y validan estrictamente con `CreateListingSchema`.
   - Provee funciones helper `getListingsForSector(sectorId)` y `getPostsForSector(sectorId)`.

4. **`src/components/layout/top-bar.tsx`**:
   - Selector accesible `<select id="territory-sector-selector">` conectado al hook `useLocation()`.
   - Cumple con WCAG 2.1 AA: altura táctil `min-h-[48px] h-12` en todos los interactivos (selector territorial, zoom tipográfico, guía rápida, conmutador de modo y selector de rol).
   - Etiqueta accesible `<label htmlFor="territory-sector-selector" className="sr-only">`, soporte de `aria-label` y atributo `title`.
   - Contenedor con `flex-wrap` y anchos máximos controlados (`max-w-[170px] sm:max-w-[220px] truncate`), evitando desbordamientos en pantallas pequeñas.

5. **`src/app/layout.tsx`**:
   - Envuelve la aplicación en `<ModeProvider><LocationProvider>{children}...</LocationProvider></ModeProvider>`.

---

### 1.2 Verificación Independiente de Compilación y Suites de Pruebas

#### Verificación Estática TypeScript (`tsc --noEmit`):
- **Comando:** `npm run typecheck`
- **Resultado:** Código de salida `0`. 0 errores de tipado en todo el repositorio.

#### Ejecución de Pruebas Unitarias y E2E de Milestone 1:
- **Comando:** `npx vitest run tests/e2e/r1-location-seeds.test.ts src/lib/__tests__/geo-utils.test.ts src/context/__tests__/location-context.test.ts`
- **Resultado:**
  ```text
  Test Files  3 passed (3)
       Tests  50 passed (50)
    Duration  5.62s
  ```
- **Desglose:**
  * `src/lib/__tests__/geo-utils.test.ts`: 4 pruebas pasadas (Haversine, formateo, caminata, difuminado determinista 50m).
  * `src/context/__tests__/location-context.test.ts`: 3 pruebas pasadas (Huancayo por defecto, fallback seguro sin provider, inicialización personalizada).
  * `tests/e2e/r1-location-seeds.test.ts`: 43 pruebas pasadas (F1-F4 en Tiers 1, 2 y 3: contratos, validación Zod, invariantes RN-01 cero dinero, persistencia en Dexie sin colisiones).

#### Verificación de Pruebas Preexistentes (Cero Regresiones):
- `src/components/layout/__tests__/app-shell-mod10.test.ts`: 3/3 passed.
- `src/components/views/__tests__/views-mod12.test.ts`: 3/3 passed.
- `src/lib/offline/__tests__/db-mod04.test.ts`: 4/4 passed.
- `src/shared/__tests__/schemas.test.ts`: 20/20 passed.
- `tests/e2e-audit-mod13.test.ts`: 4/4 passed.

*(Nota sobre fallo externo observado en corrida global: en `tests/e2e/r4-pitch-jury-panel.test.ts` falla 1 test de sincronización de `SyncManager` para Milestone 4; este archivo pertenece al Hito 4 y no forma parte del alcance del Hito 1 ni fue modificado por el Worker M1).*

---

## 2. Auditoría Forense de Integridad (Integrity Check)

Se revisaron exhaustivamente los siguientes patrones de fraude:
1. **Resultados de prueba o salidas esperadas hardcodeadas en código fuente:** Ninguna detectada. `geo-utils.ts` implementa trigonometría esférica genuina, y las semillas contienen datos realistas y estructurados conforme a los esquemas Zod.
2. **Implementaciones dummy o fachada que aparentan ser correctas sin lógica real:** Ninguna detectada. `LocationContext` gestiona estado reactivo real con persistencia en `localStorage` y geolocalización.
3. **Atajos que eluden la tarea prevista o delegación a herramientas externas:** Ninguno detectado.
4. **Salidas de verificación fabricadas o atestaciones falsas:** Ninguna detectada. La ejecución independiente confirma el paso de las 50 pruebas de M1 con código de salida 0.
5. **Autocertificación sin verificación independiente:** Descartada mediante reproducción directa de comandos en terminal.

---

## 3. Logic Chain (Cadena Lógica desde Observaciones hacia Conclusiones)

1. **Premisa 1 (Cumplimiento de Casos de Mario Cortijo):**
   - El requerimiento R1 exige explícitamente incorporar los casos del video: muletas, pool escolar, lasañas, clases de matemáticas, oficios técnicos (gasfitería, electricidad, enfermería) y respuesta a catástrofes (oxígeno, acopio, sismos, huaicos/Mantaro).
   - Observación 1.1.3 constata que cada uno de estos casos está registrado con títulos, descripciones, teléfonos peruanos válidos y coordenadas en Junín dentro de `HUANCAYO_SECTOR_LISTINGS` y `HUANCAYO_SECTOR_POSTS`.
   - Por tanto, la cobertura de requisitos funcionales R1 es del 100%.

2. **Premisa 2 (Preservación del Principio Cero Dinero - RN-01):**
   - El Muro Solidario prohíbe cualquier solicitud de dinero, cobros indirectos o jerga monetaria.
   - Observación 1.1.3 y los tests de `r1-location-seeds.test.ts` verifican que `MONEY_REGEX` no dispara en ninguna de las publicaciones de oferta/solicitud de favor (`OFERTA_FAVOR`), mientras que detecta correctamente expresiones simuladas de cobro.
   - Por tanto, la invariante de integridad humanitaria se cumple rigurosamente.

3. **Premisa 3 (Protección de Datos Sensibles PII - Ley 29733 / RN-04):**
   - Las publicaciones de emergencia SOS para adultos mayores no deben revelar ubicación exacta públicamente.
   - Observación 1.1.1 y 1.1.3 demuestran que `applySpatialBlurring50m` calcula un desplazamiento determinista de 35 a 49 metros (estrictamente $\le 50$ m), y la descripción pública de los posts SOS utiliza etiquetas de resguardo `[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]`.
   - Por tanto, se garantiza el cumplimiento normativo legal de privacidad.

4. **Premisa 4 (Accesibilidad y Robustez de Interfaz):**
   - Se requiere un tamaño de objetivo táctil de al menos 48px para personas mayores y situación de emergencia.
   - Observación 1.1.4 confirma que el selector y los botones en `top-bar.tsx` tienen clases `min-h-[48px] h-12`.
   - Además, `useLocation()` implementa `defaultContextState`, evitando caídas en componentes renderizados sin el proveedor.
   - Por tanto, la capa de interfaz es robusta y accesible.

---

## 4. Crítica Adversaria y Análisis de Casos Límite (Adversarial Review)

| ID | Desafío / Escenario de Ataque | Radio de Impacto | Resultado de la Evaluación | Mitigación Implementada |
|---|---|---|---|---|
| **ADV-01** | **Entorno SSR o ejecución de tests sin `LocationProvider`**: Llamar a `useLocation()` en componentes aislados (ej. `TopBar` o `AppShell`) provocaría `TypeError: Cannot read properties of undefined (reading 'currentSector')`. | Crítico (rompería suites de tests existentes como `views-mod12` y `app-shell-mod10`). | **SUPERADO** | `location-context.tsx` exporta `defaultContextState` con `DEFAULT_SECTOR` y funciones no-op, devolviendo estado coherente incluso fuera de un provider. |
| **ADV-02** | **Almacenamiento Local Restringido / Modo Privado**: Llamadas directas a `localStorage.getItem` o `setItem` pueden lanzar `SecurityError` en iframes o navegación ultra-privada. | Medio (caída de la aplicación al seleccionar sector). | **SUPERADO** | Todas las operaciones de `localStorage` están envueltas en bloques `try/catch` con manejo silencioso de excepciones. |
| **ADV-03** | **Coordenadas Polares o División por Cero en Difuminado Espacial**: Al calcular `deltaLng` cerca de los polos, $\cos(\text{lat}) \approx 0$ podría provocar `Infinity` o `NaN`. | Bajo en Huancayo ($\text{lat} \approx -12^\circ$), pero latente en librería compartida. | **SUPERADO** | `applySpatialBlurring50m` utiliza `Math.max(0.1, Math.cos(...))` protegiendo contra divisiones por cero. |
| **ADV-04** | **Desbordamiento Visual en Dispositivos Móviles Angostos (320px - 360px)**: La incorporación del selector territorial junto al título, estado de red, zoom A/A+ y botón de guía podría desbordar horizontalmente la cabecera. | Medio (rotura de layout móvil). | **SUPERADO** | La fila superior utiliza `flex-wrap`, el selector cuenta con `max-w-[170px]` y `truncate`, y el título tiene `truncate`. |
| **ADV-05** | **Colisión de IDs en Dexie al fusionar Jesús María con Huancayo**: Al sembrar listings con IDs ya existentes se sobreescribirían registros locales. | Alto (corrupción de datos). | **SUPERADO** | Jesús María utiliza IDs 1 a 6 (listings) y 1 a 4 (posts); Huancayo utiliza IDs 11 a 19 (listings) y 11 a 18 (posts). Cero colisiones. |

---

## 5. Caveats (Advertencias y Supuestos)

- **Alcance Específico del Hito 1:** El filtro geodésico dinámico en base al radio hiperlocal configurable (`200m`, `500m`, `1000m`) dentro de las vistas de catálogo y mapa corresponde al Hito 3. En el Hito 1 se definieron los tipos, las utilidades y el estado del radio en el contexto, lo cual es conforme a la planificación por hitos.
- **Suite de Milestone 4 en el Repositorio:** El archivo de test `tests/e2e/r4-pitch-jury-panel.test.ts` tiene 1 prueba fallida respecto a suscripciones reactivas en `SyncManager`. Esta prueba pertenece al alcance de M4 y será resuelta cuando se implemente dicho hito; no afecta ni invalida el Hito 1.

---

## 6. Conclusion (Evaluación Final)

**Veredicto:** **APPROVE**

El trabajo realizado por el Worker M1 en el Hito 1 es de excelente calidad, completamente fiel a los requisitos funcionales de R1 y a los casos de Mario Cortijo, sin violaciones de integridad, con 0 regresiones en suites previas, con 100% de éxito en las 50 pruebas de M1 y con tipado estricto verificado.

---

## 7. Verification Method (Método de Verificación Independiente)

Para reproducir independientemente las verificaciones realizadas:

1. **Verificación de Tipos TypeScript:**
   ```powershell
   cd "C:\Users\hugoc\OneDrive\Documentos\hackaton"
   npm run typecheck
   ```
   *Criterio de éxito:* 0 errores (`tsc --noEmit` código de salida 0).

2. **Verificación de Pruebas Unitarias y E2E de Milestone 1:**
   ```powershell
   cd "C:\Users\hugoc\OneDrive\Documentos\hackaton"
   npx vitest run tests/e2e/r1-location-seeds.test.ts src/lib/__tests__/geo-utils.test.ts src/context/__tests__/location-context.test.ts
   ```
   *Criterio de éxito:* 3 archivos de prueba pasados, 50 pruebas pasando al 100% sin fallos.

3. **Verificación de Retrocompatibilidad en Tests Preexistentes:**
   ```powershell
   cd "C:\Users\hugoc\OneDrive\Documentos\hackaton"
   npx vitest run src/components/layout/__tests__/app-shell-mod10.test.ts src/components/views/__tests__/views-mod12.test.ts
   ```
   *Criterio de éxito:* 6/6 pruebas pasando al 100%.
