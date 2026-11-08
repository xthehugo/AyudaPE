# BRIEFING — 2026-11-07T12:27:30Z

## Mission
Investigar datos semilla, esquemas, catálogo de servicios, Muro Solidario, geolocalización y los requisitos R1 y R4 (Modo Presentación Jurado, SOS, PII vault, offline toggle).

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer, survey
- Working directory: C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_explorer_survey_3
- Original parent: 96619360-e8b6-46e4-8627-eb1fbff62c90
- Milestone: Survey phase (R1 and R4)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Analyze seed data, schemas, services catalog, Muro Solidario, location defaults, R1 & R4 requirements.

## Current Parent
- Conversation ID: 96619360-e8b6-46e4-8627-eb1fbff62c90
- Updated: 2026-11-07T12:25:10Z

## Investigation State
- **Explored paths**: `src/lib/initial-data.ts`, `src/database/seeds/003_seed_lima_sector4.sql`, `src/lib/offline/db.ts`, `src/lib/offline/sync-manager.ts`, `src/server/db/schema.ts`, `src/app/api/v1/posts/[id]/sensitive-pii/route.ts`, `src/server/use-cases/create-community-post.ts`, `src/components/layout/top-bar.tsx`, `src/components/layout/offline-banner.tsx`, `src/components/map/neighborhood-map.tsx`, `src/components/views/proximity-catalog-view.tsx`, `src/components/views/solidarity-wall-view.tsx`, `src/components/publish/quick-publish-modal.tsx`, `src/components/publish/quick-publish-sheet.tsx`, `tests/e2e-audit-mod13.test.ts`, reports de Explorer 1 y 2.
- **Key findings**:
  1. La aplicación actual funciona con 63/63 tests pasando y 0 errores de tipo, pero está anclada rígidamente a Lima (Jesús María).
  2. R1: Se requiere soporte nativo de Huancayo (Junín) por defecto con sectores El Tambo, San Carlos, Centro y zonas críticas ante sismos (Huaytapallana) y Fenómeno El Niño (Mantaro).
  3. Los casos exactos de Mario Cortijo (muletas gratis, carpooling escolar, lasañas caseras, clases matemáticas, gasfitería, electricidad, enfermería, puntos de acopio y oxígeno) han sido especificados detalladamente con coordenadas geodésicas reales.
  4. R4: El widget del Jurado 180s requiere cronómetro interactivo (play/pause/reset) y 3 botones de simulación (Modo Avión 1 clic vía syncManager, Alerta SOS con difuminado a 50m vía executeQuickPublishPersist, y Desbloqueo de Bóveda PII con log de auditoría local visible).
  5. Todos los botones nuevos deben incluir `min-h-[48px]` para cumplir la aserción WCAG estricta de `tests/e2e-audit-mod13.test.ts`.
- **Unexplored areas**: Ninguna dentro del alcance de R1 y R4. Investigación completada.

## Key Decisions Made
- Especificar dataset completo de semillas para Huancayo y zonas de desastre sin romper retrocompatibilidad con las pruebas existentes de Jesús María.
- Diseñar la integración del panel de jurado (180s) conectando las APIs existentes de `syncManager.setOnlineStatus`, `executeQuickPublishPersist` y auditoría local de la Bóveda PII.

## Artifact Index
- handoff.md — Reporte final de investigación exhaustivo (5 componentes)
- progress.md — Tracker de progreso y estado
- DISPATCH.md — Registro de despachos y mensajes de coordinación
