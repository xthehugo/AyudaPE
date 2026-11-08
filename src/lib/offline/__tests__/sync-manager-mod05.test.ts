import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeltaSyncResponseDto } from '@shared/types';
import { RedVecinaLocalDB } from '../db';
import { SyncManager } from '../sync-manager';

describe('[MOD-05] Capa 2 — Gestor de Sincronización Idempotente (SyncManager: Uplink & Downlink)', () => {
  let db: RedVecinaLocalDB;

  beforeEach(async () => {
    db = new RedVecinaLocalDB(`SyncTestDB_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. debe vaciar la cola outbox en lote (Uplink) hacia POST /api/v1/sync/batch y emitir outbox_synced', async () => {
    const id1 = await db.enqueueMutation('/api/v1/posts', 'POST', {
      title: 'Reporte SOS offline 1',
    });
    const id2 = await db.enqueueMutation('/api/v1/listings', 'POST', {
      title: 'Oficio offline 2',
    });

    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            processed_count: 2,
            results: [
              { client_mutation_id: id1, status: 'SYNCED' },
              { client_mutation_id: id2, status: 'IGNORED_DUPLICATE' },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const manager = new SyncManager(db, mockFetch, 50);
    let eventFired = false;
    manager.subscribe('outbox_synced', () => {
      eventFired = true;
    });

    const result = await manager.processOutbox();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.syncedIds).toEqual([id1, id2]);
    expect(result.failedIds).toHaveLength(0);
    expect(eventFired).toBe(true);

    const remaining = await db.getPendingMutations();
    expect(remaining).toHaveLength(0);
    manager.dispose();
  });

  it('2. NO debe enviar peticiones si el dispositivo está en modo offline y debe preservar la cola intacta', async () => {
    await db.enqueueMutation('/api/v1/posts', 'POST', {
      title: 'En modo avión',
    });

    const mockFetch = vi.fn() as unknown as typeof fetch;
    const manager = new SyncManager(db, mockFetch, 50);
    manager.setOnlineStatus(false);

    const result = await manager.processOutbox();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.syncedIds).toHaveLength(0);

    const pending = await db.getPendingMutations();
    expect(pending).toHaveLength(1);
    manager.dispose();
  });

  it('3. debe incrementar retry_count y programar backoff exponencial si el servidor devuelve HTTP 503', async () => {
    const id = await db.enqueueMutation('/api/v1/posts', 'POST', {
      title: 'Fallo temporal de antena',
    });

    const mockFetch = vi.fn(async () => {
      return new Response('Service Unavailable', { status: 503 });
    }) as unknown as typeof fetch;

    const manager = new SyncManager(db, mockFetch, 500);
    let errorCaptured = false;
    manager.subscribe('sync_error', () => {
      errorCaptured = true;
    });

    const result = await manager.processOutbox();
    expect(result.failedIds).toEqual([id]);
    expect(errorCaptured).toBe(true);

    const failedRecord = await db.outbox.where('client_mutation_id').equals(id).first();
    expect(failedRecord?.status).toBe('FAILED');
    expect(failedRecord?.retry_count).toBe(1);
    expect(manager.calculateBackoffDelayMs(1)).toBe(1000);
    expect(manager.calculateBackoffDelayMs(3)).toBe(4000);
    manager.dispose();
  });

  it('4. debe hidratar el caché local de Dexie.js mediante hydrateDownlink(sectorId) y emitir downlink_hydrated', async () => {
    const sampleDelta: DeltaSyncResponseDto = {
      server_timestamp: '2026-11-07T04:30:00.000Z',
      sector_id: 1,
      listings: [
        {
          client_mutation_id: '33333333-3333-4333-8333-333333333301',
          category_id: 1,
          listing_type: 'SERVICIO_OFICIO',
          title: 'Maestro Gasfitero Jorge Quispe',
          description: 'Atención de emergencias en San Felipe',
          contact_phone: '+51991234503',
          latitude: -12.0855,
          longitude: -77.0521,
          available_for_emergencies: true,
          endorsement_count: 3,
          weighted_trust_score: 4.5,
          is_pending_sync: false,
        },
      ],
      posts: [
        {
          client_mutation_id: '55555555-5555-4555-8555-555555555507',
          sector_id: 1,
          category_id: 4,
          operational_mode: 'EMERGENCIA',
          post_type: 'SOS_VULNERABLE',
          title: 'Adulta mayor requiere oxígeno',
          description: 'Vecina en [DIRECCIÓN PROTEGIDA] necesita balón de oxígeno.',
          urgency_level: 'CRITICA',
          public_lat: -12.0848,
          public_lng: -77.0516,
          privacy_radius_meters: 50,
          status: 'EN_COORDINACION',
          client_created_at: '2026-11-07T04:00:00.000Z',
          is_pending_sync: false,
        },
      ],
      commitments: [],
      categories: [],
      has_more: false,
    };

    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          data: sampleDelta,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const manager = new SyncManager(db, mockFetch, 50);
    let hydratedEvent = false;
    manager.subscribe('downlink_hydrated', () => {
      hydratedEvent = true;
    });

    const payload = await manager.hydrateDownlink(1);
    expect(payload?.server_timestamp).toBe('2026-11-07T04:30:00.000Z');
    expect(hydratedEvent).toBe(true);

    const cachedListings = await db.listings.toArray();
    const cachedPosts = await db.posts.toArray();
    expect(cachedListings).toHaveLength(1);
    expect(cachedPosts).toHaveLength(1);
    expect(cachedPosts[0]?.privacy_radius_meters).toBe(50);
    manager.dispose();
  });
});
