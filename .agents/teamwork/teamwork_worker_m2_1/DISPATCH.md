## 2026-11-07T12:55:47Z
You are Worker M2 (Milestone 2 Implementation: Modern Uber/Delivery Style Interactive Map with Vaul Bottom Sheet & Routing).
Working directory: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_worker_m2_1
Workspace root: C:\Users\hugoc\OneDrive\Documentos\hackaton
Path to ORIGINAL_REQUEST.md: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\ORIGINAL_REQUEST.md
Path to PROJECT.md: C:\Users\hugoc\OneDrive\Documentos\hackaton\PROJECT.md
Path to TEST_READY.md: C:\Users\hugoc\OneDrive\Documentos\hackaton\TEST_READY.md
Explorer 2 Report: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_explorer_survey_2\handoff.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and Explorer 2 report first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Task:
Redesign `src/components/map/neighborhood-map.tsx` into a modern interactive map with delivery/Uber UX (R2: F5, F6, F7, F8):
1. **Interactive OpenStreetMap Integration & Resilient Offline Fallback**:
   - Dynamic viewport centered on `currentSector` from `useLocation()` (Huancayo default: `-12.0528, -75.2155`, or coords passed via props/active sector).
   - Render OpenStreetMap tiles with interactive pan/drag and zoom, and resilient offline vector grid fallback so it works seamlessly offline/airplane mode without broken images.
   - Vitest SSR safety: Node.js runs `renderToStaticMarkup`. Ensure the component renders a valid SSR markup containing:
     * `data-testid="sos-privacy-circle-50m"`
     * `data-radius-meters="50"`
     * `"SOS ~50m"`
     * `"OpenStreetMap"`
     * All required accessibility labels and touch targets.
2. **Interactive Bottom Sheet (Vaul Drawer)**:
   - Use `vaul` (already installed in package.json) for a fluid sliding bottom sheet (`Drawer.Root`, `Drawer.Portal`, `Drawer.Overlay`, `Drawer.Content`).
   - When any marker is clicked or tapped, open the bottom sheet displaying:
     * Title, category, status/availability badge.
     * Calculated distance (`calculateDistanceMeters`) and estimated walking time (`estimateWalkingMinutes`, e.g. "a 180 m · ~2 min caminando").
     * Direct call button (`tel:${contact_phone}`) with green styling.
     * Action button ("Dar Visto Bueno", "Ofrecer Ayuda", "Ver Ruta").
     * For SOS alerts: PII unlock request button with audited reason dialog for Brigadista role.
3. **Categorized Markers & Visual Route Line (Uber/Delivery Style)**:
   - Distinctive visual styling for markers:
     * Oficios / Servicios: Blue badge with Lucide icon.
     * Productos locales: Amber/Orange badge.
     * Muro solidario / favores: Emerald/Green badge.
     * Emergencias / SOS: Red badge with pulsating ring and 50m privacy circle for SOS.
     * User GPS pin with pulsing blue dot.
   - When a target is selected, render a prominent dashed visual route line (`strokeDasharray: "6 4"`) connecting the user's location to the destination, with a floating mid-point badge showing distance and walking time.
4. **Fluid Touch Controls & Accessibility**:
   - Controls: Zoom In (`+`), Zoom Out (`-`), Recentrar en mi ubicación (`MapPin` / recenter), Alternar capas, Pantalla completa.
   - STRICT WCAG AAA TARGET SIZE: ALL `<button>` elements MUST have `min-h-[48px]`, `min-h-[52px]` or `min-h-[56px]`.
5. **Cache in `public/sw.js`**:
   - Enhance `public/sw.js` to cache OpenStreetMap tiles with Stale-While-Revalidate.
6. **Verification**:
   - Run `npm run typecheck` (`tsc --noEmit`).
   - Run `npx vitest run tests/e2e/r2-uber-map.test.ts src/components/publish/__tests__/publish-map-mod11.test.ts tests/e2e-audit-mod13.test.ts`.
   - Run full `npm test` to ensure 0 regressions.
7. Write your handoff report to:
   `C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_worker_m2_1\handoff.md`.
8. Send a message to caller when done.
