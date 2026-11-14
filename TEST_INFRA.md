# E2E Test Infra: AyudaPE Rescate USAR, Malla Vecinal y Modo Ultra-Ahorro

## Test Philosophy
- Opaque-box, requirement-driven. Derivado de `ORIGINAL_REQUEST.md`.
- Metodología: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Testing.
- Rigor de Accesibilidad: AST audit automatizado de altura táctil WCAG AAA (`min-h-[48px]`).

## Feature Inventory
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------|:------:|:------:|:------:|:------:|
| F1 | Baliza Morse Acústica USAR | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F2 | Baliza Háptica Sincronizada | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F3 | Controles Activar / Silenciar Baliza | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F4 | Insignia Mula de Datos Vecinal | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F5 | Sincronización Realtime Multi-Dispositivo | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F6 | Disparador Diálogo SOS en Barra Superior | ORIGINAL_REQUEST §R1-R2 | 5 | 5 | ✓ | ✓ |
| F7 | Modo Pantalla Negra 72h OLED | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F8 | Despertar por Doble Toque en Overlay | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F9 | Persistencia de Baliza en Segundo Plano | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: `vitest run` (Vitest 3.x en entorno Node con mockups de Web Audio, navigator.vibrate y DOM SSR via `react-dom/server`).
- E2E Test Files:
  - `tests/morse-beacon.test.ts` (Unit & timing & AudioContext simulation)
  - `tests/rescue-usar-ultra-ahorro.test.tsx` (Component, DOM, WCAG AAA, double-tap, and state persistence)
  - `tests/sos-mesh-sync.test.ts` (Mesh & Realtime synchronization dispatch validation)
  - `tests/m5-challenger-deep-stress.test.ts` (AST WCAG AAA `min-h-[48px]` across all components)
- Output esperado: 100% de suites en verde con 0 fallos (`Exit code 0`).

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Rescate bajo escombros: Emisión SOS -> Activación Baliza -> Activación Pantalla Negra 72h -> Despertar con doble toque -> Silenciado de baliza | F1, F2, F3, F7, F8, F9 | High |
| 2 | Retransmisión vecinal: Celular emite SOS -> Retransmisión Store-and-Forward + WebSocket -> Laptop vecina recibe alerta y muestra banner | F4, F5, F6 | High |
| 3 | Resistencia a doble toque accidental: Toques espaciados (>500ms) no despiertan; doble toque rápido (<400ms) despierta al instante | F8 | Medium |
| 4 | Tolerancia en dispositivos sin motor háptico (iOS Safari / PC): Audio funciona ininterrumpido sin lanzar excepción de `navigator.vibrate` | F1, F2, F3 | Medium |
| 5 | Interrupción por usuario a salvo: Pulsar "Ya estoy a salvo" apaga instantáneamente audio y vibración, cerrando el diálogo limpiamente | F1, F2, F3 | Medium |

## Coverage Thresholds
- Tier 1: ≥ 5 casos por feature.
- Tier 2: ≥ 5 límites y casos borde por feature (mockups nulos, duraciones, rebotes).
- Tier 3: Cobertura de interacción combinada (Baliza + OLED + Malla).
- Tier 4: ≥ 5 escenarios de aplicación realista.
