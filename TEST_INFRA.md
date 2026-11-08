# E2E Test Infra: RedVecina

## Test Philosophy
- Opaque-box, requirement-driven. Derivado estrictamente de `ORIGINAL_REQUEST.md` y de los casos del video de Mario Cortijo.
- Metodología: Category-Partition + BVA (Boundary Value Analysis) + Pairwise Combinatorial Testing + Real-World Workload Testing (Tiers 1-4).
- Resiliencia y compatibilidad: Los tests deben ejecutarse mediante Vitest (`npm test`) en entorno Node.js sin fallar por APIs faltantes de navegador (`typeof window !== 'undefined'`).

## Feature Inventory & Metas de Cobertura

| # | Feature | Requerimiento | Tier 1 (Funcional) | Tier 2 (BVA/Límites) | Tier 3 (Interacciones) |
|---|---------|---------------|:------------------:|:--------------------:|:----------------------:|
| 1 | Selector de Ubicación (Huancayo por defecto) | R1 | 5 tests | 5 tests | ✓ |
| 2 | Semillas Muro Solidario (Muletas y Carpooling) | R1 | 5 tests | 5 tests | ✓ |
| 3 | Semillas Catálogo (Lasañas, Matemáticas, Oficios) | R1 | 5 tests | 5 tests | ✓ |
| 4 | Semillas Emergencias (Oxígeno, Acopio, Brigadas) | R1 | 5 tests | 5 tests | ✓ |
| 5 | Mapa Interactivo OpenStreetMap Resiliente | R2 | 5 tests | 5 tests | ✓ |
| 6 | Bottom Sheet Deslizable (Vaul Drawer) | R2 | 5 tests | 5 tests | ✓ |
| 7 | Marcadores Categorizados y Trazado de Ruta | R2 | 5 tests | 5 tests | ✓ |
| 8 | Controles Táctiles y Accesibilidad (Botones >= 48px) | R2 | 5 tests | 5 tests | ✓ |
| 9 | Selector de Radio Hiperlocal (200m, 500m, 1km) | R3 | 5 tests | 5 tests | ✓ |
| 10 | Sincronización Inmediata Mapa y Catálogo | R3 | 5 tests | 5 tests | ✓ |
| 11 | Cronómetro Regresivo Jurado (180s con Controles) | R4 | 5 tests | 5 tests | ✓ |
| 12 | Simulación 1: Modo Avión / Sin Red en 1 Clic | R4 | 5 tests | 5 tests | ✓ |
| 13 | Simulación 2: SOS Voz con Difuminado a 50m | R4 | 5 tests | 5 tests | ✓ |
| 14 | Simulación 3: Desbloqueo Bóveda PII + Log Local | R4 | 5 tests | 5 tests | ✓ |

## Test Architecture
- Test Runner: `npm test` (`vitest run`).
- Directorio de pruebas E2E: `tests/e2e/`.
- Archivos de prueba:
  - `tests/e2e/r1-location-seeds.test.ts`
  - `tests/e2e/r2-uber-map.test.ts`
  - `tests/e2e/r3-hyperlocal-radius.test.ts`
  - `tests/e2e/r4-pitch-jury-panel.test.ts`
  - `tests/e2e/r5-real-world-scenarios.test.ts` (Tier 4)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Sismo en Falla Huaytapallana: Conmutación a Huancayo, corte de luz/red, navegación offline de balones de oxígeno y brigadas vecinales | F1, F4, F5, F12 | Alta |
| 2 | Emergencia SOS Adulto Mayor electrodependiente en El Tambo con solicitud de oxígeno, difuminado a 50m y rescate auditado por Brigadista | F4, F6, F7, F13, F14 | Alta |
| 3 | Rutina vecinal matutina: Solicitud de muletas ortopédicas sin costo, coordinación de carpooling escolar y pedido de lasañas de la vecina | F1, F2, F3, F9, F10 | Media |
| 4 | Búsqueda por proximidad estricta en Mi Cuadra (200m) filtrando gasfitería ante tubería rota por heladas en El Tambo | F1, F3, F6, F9, F10 | Media |
| 5 | Pitch en vivo de 180 segundos ante el jurado ejecutando las 3 simulaciones secuencialmente sin recargar la app | F11, F12, F13, F14 | Alta |

## Coverage Thresholds
- Tier 1: ≥5 por feature (14 features × 5 = 70 tests).
- Tier 2: ≥5 por feature (casos límite, distancias fuera de radio, radio nulo, búsqueda vacía, inputs inválidos).
- Tier 3: Pruebas combinatorias entre features concurrentes.
- Tier 4: ≥5 escenarios realistas de aplicación integral.
