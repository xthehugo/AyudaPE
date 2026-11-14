# Project: AyudaPE - Integración de Propuestas de Rescate USAR, Malla Vecinal y Ultra-Ahorro OLED

## Architecture
AyudaPE es una plataforma de ayuda vecinal y emergencia comunitaria en modo PWA (Next.js 14, React 18, TypeScript, Tailwind CSS, Dexie IndexedDB y Supabase Realtime).

### Data & Control Flow
1. **Flujo de Emisión de Auxilio SOS**:
   - `src/components/layout/top-bar.tsx`: Botón SOS en la cabecera abre directamente `SosConfirmationDialog` (`isSosDialogOpen=true`).
   - `src/components/safety/sos-confirmation-dialog.tsx`:
     - Paso 1 (`'CONFIRM'`): Prevención de falsos positivos con foco accesible en "No". Al pulsar "Sí" pasa a paso 2.
     - Paso 2 (`'PERMISSIONS_CHECK'`): Verificación no bloqueante de Bluetooth y Wi-Fi Direct.
     - Paso 3 (`'SENT'`):
       - Transmisión local y simulada vía `meshService.broadcastSos(userCoords)` con Store-and-Forward en Dexie/localStorage.
       - Transmisión en tiempo real vía WebSockets de Supabase con `broadcastRealtimeSos(...)`.
       - Renderizado de la insignia destacada 'Mula de Datos Vecinal' (`data-testid="mesh-mule-badge"`).
       - Control interactivo de la Baliza Acústica y Háptica Morse USAR (`src/lib/safety/morse-beacon.ts`).
       - Control interactivo del Modo Ultra-Ahorro 72 Horas (`#000000` OLED con despertar por doble toque).
2. **Flujo de Recepción en Segundo Dispositivo Físico**:
   - `src/lib/realtime/sos-realtime.ts`: Canal Supabase Realtime Broadcast `redvecina_realtime_v1` (evento `sos_emergency`).
   - `src/app/page.tsx`: Escuchador `handleWebSocketSos` procesa la alerta recibida, activa el banner superior fijo `fixed-top-sos-alert` destacando la retransmisión por Mula de Datos Vecinal, y emite notificación.
3. **Baliza Morse USAR**:
   - Módulo desacoplado `src/lib/safety/morse-beacon.ts`: Genera oscilador sinusoidal de 880Hz (óptimo para geófonos USAR) con tiempos Morse internacionales (punto 150ms, raya 450ms, silencio intra 150ms, silencio letra 450ms, silencio ciclo 1400ms) y vibración háptica sincronizada `navigator.vibrate([150, 150, 150, 150, 150, 450, 450, 150, 450, 150, 450, 450, 150, 150, 150, 150, 150, 1400])`.
4. **Modo Ultra-Ahorro 72h**:
   - Overlay a pantalla completa (`fixed inset-0 z-[100]`) en negro absoluto `#000000` (consumo 0 en pantallas OLED).
   - Pulso tenue central: 'Baliza SOS activa en segundo plano · Toca 2 veces para despertar'.
   - Despertar inmediato por doble toque (delta < 400ms) en cualquier punto de la pantalla, manteniendo la baliza activa.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Baliza Morse Acústica USAR | Módulo desacoplado de audio 880Hz con patrón Morse SOS (··· ——— ···) | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Baliza Háptica Sincronizada | Vibración rítmica `navigator.vibrate` sincronizada con el patrón Morse | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Controles de Baliza en Diálogo | Botones interactivos 'Activar Baliza' y 'Silenciar Baliza (Pausar)' con WCAG AAA (`min-h-[48px]`) | M1 | ORIGINAL_REQUEST §R1 |
| F4 | Insignia Mula de Datos Vecinal | Insignia visible y accesible en paso 'SENT' indicando saltos a <50m hacia la central | M1 | ORIGINAL_REQUEST §R2 |
| F5 | Sincronización en Vivo Multi-Dispositivo | Transmisión vía `broadcastRealtimeSos` al emitir SOS para recepción instantánea en otro dispositivo | M1 | ORIGINAL_REQUEST §R2 |
| F6 | Disparador Directo de Diálogo SOS | Botón SOS en `top-bar.tsx` abre directamente `SosConfirmationDialog` para pruebas físicas | M1 | Survey Explorer 1 & 2 |
| F7 | Banner Receptor Mula de Datos | Banner superior en dispositivo B indicando SOS recibido por Mula de Datos | M1 | Survey Explorer 2 |
| F8 | Modo Pantalla Negra OLED 72h | Overlay `#000000` con texto tenue pulsante y despertar por doble toque | M1 | ORIGINAL_REQUEST §R3 |
| F9 | Persistencia de Baliza en Ultra-Ahorro | La baliza sonora y vibratoria continúa corriendo en segundo plano durante el overlay | M1 | ORIGINAL_REQUEST §R3 |
| F10 | Suite de Pruebas Unitarias & E2E | Validación de baliza, sincronización, overlay y corrección de discrepancias heredadas | M2 | ORIGINAL_REQUEST §Verification |
| F11 | Auditoría WCAG AAA AST | Verificación automatizada de `min-h-[48px]` y accesibilidad en todos los botones | M2 | ORIGINAL_REQUEST §Verification |
| F12 | Despliegue en Producción Vercel | Despliegue directo `npx vercel deploy --prod --yes` con 0 `git push` a GitHub | M3 | ORIGINAL_REQUEST §R4 |
| F13 | Guía de Prueba en Vivo Celular <-> PC | Documentación paso a paso para probar en dos dispositivos físicos reales | M3 | ORIGINAL_REQUEST §R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Implementación de las 3 Propuestas de Rescate | `morse-beacon.ts`, integración en `sos-confirmation-dialog.tsx`, trigger `broadcastRealtimeSos`, badge Mula de Datos, overlay OLED 72h, `top-bar.tsx` y `page.tsx` | none | IN_PROGRESS |
| M2 | Verificación Opaque-Box, Tests & WCAG AAA | Suites de prueba dedicadas, alineación de tests heredados para `npm test` con 0 fallos, AST audit WCAG AAA, typecheck y build | M1 | PLANNED |
| M3 | Despliegue en Vercel & Guía de Pruebas en Vivo | `npx vercel deploy --prod --yes` (sin git push) y redacción detallada de `GUIA_PRUEBAS_EN_VIVO.md` | M2 | PLANNED |

## Interface Contracts
### `src/lib/safety/morse-beacon.ts`
```typescript
export const MORSE_SOS_VIBRATE_PATTERN: number[]; // [150, 150, 150, 150, 150, 450, 450, 150, 450, 150, 450, 450, 150, 150, 150, 150, 150, 1400]
export const MORSE_FREQUENCY_HZ: number; // 880

export interface MorseBeaconController {
  start: () => Promise<void>;
  stop: () => void;
  isActive: () => boolean;
}

export function createMorseBeacon(): MorseBeaconController;
```

### `src/components/safety/sos-confirmation-dialog.tsx`
- En `step === 'SENT'`:
  - Botón: `'🔊 Activar Baliza de Rescate (SOS Morse)'` / `'🔇 Silenciar Baliza (Pausar)'` (clase `min-h-[48px]`).
  - Insignia: `data-testid="mesh-mule-badge"` con texto de Mula de Datos Vecinal.
  - Botón: `'🌙 Pantalla Negra (Ahorro 72h)'` (clase `min-h-[48px]`).
  - Overlay: `bg-[#000000]` con doble toque para despertar y texto sutil en pulso.

## Code Layout
- `src/lib/safety/morse-beacon.ts` — Propiedad exclusiva M1
- `src/components/safety/sos-confirmation-dialog.tsx` — Propiedad exclusiva M1
- `src/components/layout/top-bar.tsx` — Propiedad exclusiva M1
- `src/app/page.tsx` — Propiedad exclusiva M1
- `tests/morse-beacon.test.ts` — Propiedad exclusiva M2
- `tests/rescue-usar-ultra-ahorro.test.tsx` — Propiedad exclusiva M2
- `tests/sos-mesh-sync.test.ts` — Propiedad exclusiva M2
- `tests/m1-challenger-stress.test.ts` — Propiedad M2
- `tests/m2-challenger-stress.test.ts` — Propiedad M2
- `GUIA_PRUEBAS_EN_VIVO.md` — Propiedad exclusiva M3
