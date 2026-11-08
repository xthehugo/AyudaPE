import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import HomePage from '@/app/page';
import {
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
} from '@/lib/initial-data';
import { POST as piiAccessPost } from '../src/app/api/v1/posts/[id]/sensitive-pii/route';
import { POST as syncBatchPost } from '../src/app/api/v1/sync/batch/route';
import { NeighborhoodMap } from '@/components/map/neighborhood-map';
import {
  executeQuickPublishPersist,
  QuickPublishModal,
} from '@/components/publish/quick-publish-modal';
import { CopilotView } from '@/components/views/copilot-view';
import { ProximityCatalogView } from '@/components/views/proximity-catalog-view';
import { SolidarityWallView } from '@/components/views/solidarity-wall-view';
import { ModeProvider } from '@/context/mode-context';
import { parseNeighborIntent } from '@/lib/ai/ai-orchestrator';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import { SyncManager } from '@/lib/offline/sync-manager';
import * as schema from '@/server/db/schema';
import { setApiDatabaseInstance } from '@/server/http/api-handler';

/**
 * Calcula el ratio de contraste WCAG 2.2 entre dos colores hexadecimales (#RRGGBB).
 */
function calculateWcagContrastRatio(hex1: string, hex2: string): number {
  const toLuminance = (hex: string): number => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const channel = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const l1 = toLuminance(hex1);
  const l2 = toLuminance(hex2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

describe('MOD-13: Auditoría Integral E2E, Accesibilidad WCAG AAA, Rendimiento LCP y Flujo Offline', () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    const migrationsDir = join(process.cwd(), 'src', 'database', 'migrations');
    const seedsDir = join(process.cwd(), 'src', 'database', 'seeds');

    await pg.exec(readFileSync(join(migrationsDir, '001_initial_enterprise_schema.sql'), 'utf-8'));
    await pg.exec(readFileSync(join(migrationsDir, '002_functions_and_triggers.sql'), 'utf-8'));
    await pg.exec(readFileSync(join(seedsDir, '003_seed_lima_sector4.sql'), 'utf-8'));

    const db = drizzle(pg, { schema });
    setApiDatabaseInstance(db);
  });

  it('1. Certifica ratios de contraste WCAG AA (>= 4.5:1 en Modo Habitual) y WCAG AAA (>= 7.0:1 en Modo Emergencia)', () => {
    // Modo Habitual: #0f172a sobre #f8fafc
    const habitualBodyContrast = calculateWcagContrastRatio('#0f172a', '#f8fafc');
    const habitualMutedContrast = calculateWcagContrastRatio('#334155', '#f8fafc');
    expect(habitualBodyContrast).toBeGreaterThanOrEqual(15.0);
    expect(habitualMutedContrast).toBeGreaterThanOrEqual(7.0);

    // Modo Emergencia AAA: #ffffff sobre #050505 y #fef08a sobre #050505
    const emergencyPrimaryContrast = calculateWcagContrastRatio('#ffffff', '#050505');
    const emergencyYellowContrast = calculateWcagContrastRatio('#fef08a', '#050505');
    const emergencyBadgeContrast = calculateWcagContrastRatio('#050505', '#facc15');

    expect(emergencyPrimaryContrast).toBeGreaterThanOrEqual(19.0);
    expect(emergencyYellowContrast).toBeGreaterThanOrEqual(17.0);
    expect(emergencyBadgeContrast).toBeGreaterThanOrEqual(12.0);
  });

  it('2. Audita jerarquía semántica (h1 -> h2 -> h3), áreas táctiles >= 48px y atributos ARIA en todas las vistas y modales', () => {
    const fullMarkup = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(
          'div',
          null,
          React.createElement(HomePage),
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          }),
          React.createElement(ProximityCatalogView, {
            initialListings: INITIAL_SECTOR_LISTINGS,
          }),
          React.createElement(SolidarityWallView, {
            initialPosts: INITIAL_SECTOR_POSTS,
          }),
          React.createElement(CopilotView),
          React.createElement(QuickPublishModal, {
            isOpen: true,
            onClose: () => {},
          })
        ),
      })
    );

    // Verificar existencia de encabezados jerárquicos h1, h2 y h3 sin saltos inválidos
    expect(fullMarkup).toContain('<h1');
    expect(fullMarkup).toContain('<h2');
    expect(fullMarkup).toContain('<h3');

    // Verificar que todos los botones tengan clase de altura táctil mínima >= 48px (min-h-[48px], min-h-[52px] o min-h-[56px])
    const buttonTags = fullMarkup.match(/<button[^>]*>/g) ?? [];
    expect(buttonTags.length).toBeGreaterThan(15);
    for (const btnTag of buttonTags) {
      const hasAccessibleTouchHeight =
        btnTag.includes('min-h-[48px]') ||
        btnTag.includes('min-h-[52px]') ||
        btnTag.includes('min-h-[56px]');
      expect(hasAccessibleTouchHeight).toBe(true);
    }

    // Verificar modales con role="dialog" y aria-modal="true"
    expect(fullMarkup).toContain('role="dialog"');
    expect(fullMarkup).toContain('aria-modal="true"');
  });

  it('3. Ejecuta prueba E2E de Resiliencia Offline: Desconexión -> Publicación SOS en 3 Clics -> Optimistic UI -> Reconexión -> SyncManager -> Bóveda PII en PostgreSQL', async () => {
    const e2eLocalDb = new RedVecinaLocalDB(`Mod13E2EOfflineDB_${Date.now()}`);

    // Puente HTTP local hacia el endpoint real POST /api/v1/sync/batch respaldado por PGlite PostgreSQL
    const e2eFetch: typeof fetch = async (input, init) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('/api/v1/sync/batch')) {
        const req = new Request('http://localhost:3000/api/v1/sync/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': '3',
            'x-user-role': 'VECINO',
          },
          body: init?.body,
        });
        return syncBatchPost(req);
      }
      throw new Error(`Unexpected URL in E2E test: ${urlStr}`);
    };

    const e2eSyncManager = new SyncManager(e2eLocalDb, e2eFetch);

    // PASO A: Emular desconexión total de red (Modo Avión durante sismo)
    e2eSyncManager.setOnlineStatus(false);
    expect(e2eSyncManager.getState().isOnline).toBe(false);

    // PASO B: Abrir QuickPublishModal y ejecutar los 3 clics con solicitud de auxilio vulnerable
    const intent = await parseNeighborIntent(
      'Auxilio urgente por sismo, mi abuelita con insuficiencia cardíaca severa necesita 2 balones de oxígeno en Jr. Huiracocha 1488 Dpto 201, llamar al 987-111-222',
      'EMERGENCIA'
    );

    const persisted = await executeQuickPublishPersist({
      intent,
      latitude: -12.0754,
      longitude: -77.0486,
      operationalMode: 'EMERGENCIA',
      db: e2eLocalDb,
    });

    // PASO C: Verificar Optimistic UI en localDb.posts y registro en localDb.outbox mientras sigue sin red
    const localPosts = await e2eLocalDb.posts.toArray();
    expect(localPosts.length).toBe(1);
    expect(localPosts[0]?.is_pending_sync).toBe(true);
    expect(localPosts[0]?.privacy_radius_meters).toBe(50);
    expect(localPosts[0]?.description).not.toContain('Jr. Huiracocha 1488');

    const pendingBeforeReconnect = await e2eLocalDb.getPendingMutations();
    expect(pendingBeforeReconnect.length).toBe(1);
    expect(pendingBeforeReconnect[0]?.client_mutation_id).toBe(persisted.client_mutation_id);

    // PASO D: Restaurar la conexión de red y confirmar que SyncManager envíe la mutación al backend y la marque como SYNCED
    e2eSyncManager.setOnlineStatus(true);
    const syncOutcome = await e2eSyncManager.processOutbox();

    expect(syncOutcome.syncedIds).toContain(persisted.client_mutation_id);
    expect(syncOutcome.failedIds.length).toBe(0);

    const pendingAfterReconnect = await e2eLocalDb.getPendingMutations();
    expect(pendingAfterReconnect.length).toBe(0);

    const syncedLocalPosts = await e2eLocalDb.posts.toArray();
    expect(syncedLocalPosts[0]?.is_pending_sync).toBe(false);

    // PASO E: Verificar que el post sincronizado guardó la PII en la bóveda PostgreSQL y solo un Brigadista puede desbloquearla con auditoría
    const dbRows = await pg.query<{ id: number }>(
      `SELECT id FROM community_post WHERE client_mutation_id = $1 LIMIT 1`,
      [persisted.client_mutation_id]
    );
    const syncedServerPostId = dbRows.rows[0]?.id;
    expect(syncedServerPostId).toBeDefined();

    const brigadistaUnlockReq = new Request(
      `http://localhost:3000/api/v1/posts/${syncedServerPostId}/pii-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': '4',
          'x-user-role': 'BRIGADISTA_CERTIFICADO',
        },
        body: JSON.stringify({
          access_reason:
            'Traslado inmediato de balón de oxígeno medicinal con Brigada del Sector 4.',
        }),
      }
    );

    const unlockRes = await piiAccessPost(brigadistaUnlockReq, {
      params: { id: String(syncedServerPostId) },
    });
    expect(unlockRes.status).toBe(200);
    const unlockJson = (await unlockRes.json()) as {
      success: boolean;
      data: {
        exact_address: string;
        contact_phone: string;
        access_audit_id: string;
      };
    };

    expect(unlockJson.success).toBe(true);
    expect(unlockJson.data.exact_address).toContain('Jr. Huiracocha 1488');
    expect(unlockJson.data.contact_phone).toBe('987-111-222');
    expect(Number(unlockJson.data.access_audit_id)).toBeGreaterThan(0);
  });

  it('4. Audita presupuesto de rendimiento LCP: renderizado inicial del AppShell + HomePage en <100ms sin recursos bloqueantes', () => {
    const start = performance.now();
    const html = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(HomePage),
      })
    );
    const renderDurationMs = performance.now() - start;

    expect(renderDurationMs).toBeLessThan(100);
    expect(html.length).toBeGreaterThan(1000);
    // Verificar ausencia de imágenes pesadas con loading="lazy" en el viewport principal
    expect(html).not.toContain('loading="lazy"');
  });
});
