# Forensic Audit Report: Milestone 2 — Uber/Delivery Map & Bottom Sheet

**Work Product**: `src/components/map/neighborhood-map.tsx`, `public/sw.js`  
**Profile**: General Project (Demo Mode per `ORIGINAL_REQUEST.md`)  
**Auditor**: Forensic Auditor (`teamwork_auditor_m2_1`)  
**Fecha**: 2026-11-07  
**Verdict**: **CLEAN**

---

## 1. Observation (Observaciones Directas y Empíricas)

1. **Análisis Estático del Código Fuente (`src/components/map/neighborhood-map.tsx`):**
   - **Integración de Vaul Drawer:** La biblioteca `vaul` (`^1.1.2`) se encuentra genuinamente importada (`import { Drawer } from 'vaul'`) e implementada en líneas 902–1106 mediante `Drawer.Root`, `Drawer.Portal`, `Drawer.Overlay`, `Drawer.Content`, `Drawer.Title`, y `Drawer.Description`. Incluye la barra superior de arrastre táctil (`div` con `w-12 h-1.5 rounded-full`), badges contextuales (`SOLIDARIO`, `COMERCIAL`, `EMERGENCIA`), tarjeta de distancia calculada y tiempo a pie, llamada telefónica directa (`tel:...`), acciones de "Dar Visto Bueno", "Ofrecer Ayuda", "Ver Ruta", y diálogo de auditoría forense PII (Ley N° 29733). Adicionalmente conserva un renderizado inline accesible como respaldo.
   - **Cálculo Geométrico y Ruteo Dinámico:** La proyección cartográfica se ejecuta mediante `projectCoordToViewport(lat, lng, centerLat, centerLng, latSpan, lngSpan, zoomScale)` con cálculo equirectangular genuino y acotamiento de seguridad (10% a 90%). La cuadrícula de tiles Slippy Map de OpenStreetMap (`getOsmTiles`) calcula los índices $X, Y, Z$ mediante la proyección canónica Mercator esférica ($\pi$, logaritmo y tangente trigonométrica).
   - **Trazado de Ruta Estilo Delivery:** La línea visual discontinua de conexión entre el usuario y el punto de destino se traza dinámicamente con `<line x1={...} y1={...} x2={...} y2={...} strokeDasharray="6 4" stroke="#38bdf8" />`, acompañada de una píldora flotante centrada en el punto medio geométrico con `formatDistance` y `estimateWalkingMinutes` (75 m/min a 4.5 km/h).
   - **Marcadores Categorizados:** Los botones de marcadores diferencian visualmente oficios (`bg-sky-600`), productos (`bg-amber-600`), favores (`bg-emerald-700`) y reportes SOS (`bg-red-700/90` con anillo pulsante `animate-ping` e icono `ShieldAlert`), proyectando el círculo difuminado de privacidad de 50 metros (`data-testid="sos-privacy-circle-50m"`).
   - **Accesibilidad y Áreas Táctiles (WCAG AAA >= 48px):** Todos y cada uno de los elementos `<button>` del componente (filtros, marcadores, controles de zoom, recentrado, capas, pantalla completa y modales) cuentan con la clase `min-h-[48px]`, cumpliendo con creces los requisitos de accesibilidad móvil para vecinos y adultos mayores.

2. **Análisis de Service Worker (`public/sw.js`):**
   - Incorpora la estrategia de red *Stale-While-Revalidate* dirigida a solicitudes hacia `tile.openstreetmap.org`, resguardando las imágenes en la caché aislada `redvecina-tiles-v1`.

3. **Detección de Patrones Prohibidos (Forensic Integrity):**
   - **Resultados Hardcodeados:** 0 instancias. No existen condicionales que intercepten datos de prueba ni valores fijos devueltos sin cálculo.
   - **Implementaciones Fachada (Facades):** 0 instancias. Todas las funciones (`deriveMapSelectionTarget`, `projectCoordToViewport`, `getOsmTiles`, `handleRecenter`, `handleUnlockPiiSubmit`) implementan lógica matemática o de estado genuina.
   - **Artefactos Pre-Poblados:** Búsqueda recursiva en el workspace arrojó 0 archivos de log, resultados o salida preexistentes fuera de `node_modules`.
   - **Delegación Ilícita de Ejecución:** No se delega lógica a scripts externos no permitidos ni frameworks cerrados.

4. **Validación en Tiempo de Ejecución (Independent Test Execution):**
   - **Verificación de Tipos TypeScript (`npm run typecheck`):**
     ```powershell
     > redvecina@1.0.0 typecheck
     > tsc --noEmit
     ```
     Código de salida: 0 (0 errores de compilación).
   - **Pruebas de Mapa y Accesibilidad (`r2-uber-map.test.ts`, `publish-map-mod11.test.ts`, `e2e-audit-mod13.test.ts`):**
     ```powershell
     Test Files  3 passed (3)
          Tests  50 passed (50)
       Duration  23.99s
     ```
   - **Suite Completa del Proyecto (`npm test`):**
     ```powershell
     Test Files  21 passed (21)
          Tests  252 passed (252)
       Duration  60.38s
     ```

---

## 2. Logic Chain (Cadena Lógica de Deducción)

1. El objetivo de Milestone 2 según `ORIGINAL_REQUEST.md` (R2: F5, F6, F7, F8) y `PROJECT.md` requería:
   - Integración de cartografía OpenStreetMap con resiliencia offline.
   - Tarjeta inferior deslizable (*Bottom Sheet* interactivo con `vaul`).
   - Marcadores categorizados con trazado visual de ruta estimada.
   - Controles táctiles fluidos con botones de al menos 48px.
2. La inspección del código fuente demuestra que `src/components/map/neighborhood-map.tsx` integra `vaul` genuinamente a nivel de componente (`Drawer.Root`, `Drawer.Portal`, etc.), permitiendo la experiencia interactiva móvil requerida.
3. El cálculo de distancias y tiempos se delega en `src/lib/geo-utils.ts`, cuya fórmula Haversine y velocidad de caminata urbana (75 m/min) son matemáticamente auténticas y reproducibles.
4. Las pruebas automatizadas no dependen de strings o estructuras tramposas: el mapa renderiza tanto la capa vectorial SVG resiliente como la capa de tiles de OpenStreetMap, y el Service Worker intercepta y almacena en caché los tiles para navegación sin red.
5. Todas las pruebas del proyecto (252 tests en 21 archivos) y la verificación estricta de tipos de TypeScript se ejecutaron de manera autónoma y pasaron al 100% sin regresiones.
6. Por consiguiente, se deduce que no existe ninguna violación de integridad ni atajo simulado.

---

## 3. Caveats (Advertencias y Supuestos)

- **Simulación en Entorno Node.js (Vitest):** En el entorno de servidor / pruebas unitarias de Vitest (`renderToStaticMarkup`), el portal de `vaul` (`Drawer.Portal`) no inyecta en `document.body` porque no existe un DOM de navegador completo. El desarrollador anticipó esto correctamente implementando una tarjeta accesible inline en el árbol estático, garantizando compatibilidad total tanto en SSR/Node como en el cliente móvil interactivo.
- **Sin Conexión Satelital Real en Tests:** Las coordenadas GPS provienen de `location-context` y se derivan por defecto a Huancayo / Junín (o Jesús María en datasets históricos), comportándose de forma predecible sin depender de hardware GPS físico.

---

## 4. Conclusion (Veredicto Forense Final)

El trabajo entregado para **Milestone 2 (Uber/Delivery Map & Bottom Sheet)** cumple rigurosamente con los estándares de integridad en modo **Demo**:
- **Verdict**: **CLEAN**
- **0 Atajos Prohibidos / 0 Trampas en Tests / 0 Fachadas**.
- Código listo para proceder con el Milestone 3 (Selector de Radio Hiperlocal Sincronizado).

---

## 5. Verification Method (Método de Verificación Independiente)

Cualquier evaluador o auditor puede verificar este reporte ejecutando de forma independiente:

```powershell
# 1. Compilación estricta TypeScript
cd "C:\Users\hugoc\OneDrive\Documentos\hackaton"
npm run typecheck

# 2. Pruebas específicas de M2
npm test -- tests/e2e/r2-uber-map.test.ts src/components/publish/__tests__/publish-map-mod11.test.ts tests/e2e-audit-mod13.test.ts

# 3. Regresión global 100% verde
npm test
```
