## 2026-11-07T12:29:37Z
You are Worker M1 (Milestone 1 Implementation).
Working directory: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_worker_m1_1
Workspace root: C:\Users\hugoc\OneDrive\Documentos\hackaton
Path to ORIGINAL_REQUEST.md: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\ORIGINAL_REQUEST.md
Path to PROJECT.md: C:\Users\hugoc\OneDrive\Documentos\hackaton\PROJECT.md
Explorer 1 Report: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_explorer_survey_1\handoff.md
Explorer 2 Report: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_explorer_survey_2\handoff.md
Explorer 3 Report: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_explorer_survey_3\handoff.md

You MUST read ORIGINAL_REQUEST.md, PROJECT.md, and the Explorer reports first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Task:
1. Implement `src/lib/geo-utils.ts` with Haversine distance, distance formatting (`formatDistance`), walking minutes estimation (`estimateWalkingMinutes`), and spatial blurring (`applySpatialBlurring50m`).
2. Implement `src/context/location-context.tsx` as defined in `PROJECT.md § Interface Contracts`:
   - Default sector: Huancayo · El Tambo (`lat: -12.0528, lng: -75.2155`).
   - Other available sectors: Huancayo · San Carlos (`-12.0625, -75.2005`), Huancayo · Centro Urbano (`-12.0678, -75.2085`), Zona Crítica Sismos · Falla Huaytapallana (`-12.0480, -75.1950`), Zona Crítica El Niño · Mantaro (`-12.0580, -75.2280`), and Lima · Jesús María Sector 4 (`-12.0752, -77.0485`) for backward compatibility.
   - State for `currentSector`, `availableSectors`, `activeRadius` (200, 500, 1000, null), `userCoords`, `setSector`, `setActiveRadius`, `recenterToUser`.
   - Wrap `LocationProvider` in `src/app/layout.tsx` or `src/app/page.tsx`.
3. Enrich `src/lib/initial-data.ts`:
   - Add rich, realistic seed listings and posts for Huancayo and disaster zones with exact cases from Mario Cortijo's video:
     * Muletas ortopédicas gratis (Muro Solidario).
     * Pool escolar / carpooling vecinal (Muro Solidario).
     * Lasañas caseras y postres de la vecina Gladys (Catálogo).
     * Clases de matemáticas y nivelación del profesor Yuri (Catálogo).
     * Oficios técnicos: gasfitería Maestro Teodoro, electricidad Técnico Wálter, enfermería Lic. Maritza con balón de oxígeno.
     * Emergencias: punto de acopio Coliseo El Tambo, brigada y punto de encuentro Parque Bolognesi, alerta SOS oxígeno con 50m privacy radius.
   - Retain existing Jesús María seeds so existing tests do NOT break!
4. Update `src/components/layout/top-bar.tsx`:
   - Replace the static text `'Jesús María · Sector 4'` with an accessible interactive dropdown/popover territory selector connected to `LocationContext`.
   - Ensure the selector displays the current sector name (e.g. "Huancayo · El Tambo"), allows switching to any other sector, and still renders `'Jesús María · Sector 4'` when that option is viewed/selected (CRITICAL for `app-shell-mod10.test.ts`).
   - Ensure every button in `top-bar.tsx` has `min-h-[48px]` to pass WCAG touch-target rules!
5. Verification:
   - Run `npm run typecheck` (`tsc --noEmit`).
   - Run `npm test` (`vitest run`).
   - All 13 existing test suites must pass 100% with 0 regressions.
6. Write your handoff report to:
   `C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_worker_m1_1\handoff.md`
7. Send a message to caller when done.
