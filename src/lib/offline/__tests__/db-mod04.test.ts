import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RedVecinaLocalDB } from '../db';

describe('[MOD-04] Capa 2 — Almacén Local Dexie.js (IndexedDB) y Cola Outbox Transaccional', () => {
  let db: RedVecinaLocalDB;

  beforeEach(async () => {
    db = new RedVecinaLocalDB(`TestRedVecinaDB_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  it('1. debe encolar mutaciones en outbox en orden FIFO y recuperarlas con getPendingMutations()', async () => {
    const id1 = await db.enqueueMutation('/api/v1/posts', 'POST', {
      title: 'Primer reporte SOS sin red',
    });

    await new Promise((r) => setTimeout(r, 5));

    const id2 = await db.enqueueMutation('/api/v1/listings', 'POST', {
      title: 'Gasfitero en cuadra 14',
    });

    const pending = await db.getPendingMutations();
    expect(pending).toHaveLength(2);
    expect(pending[0]?.client_mutation_id).toBe(id1);
    expect(pending[1]?.client_mutation_id).toBe(id2);
    expect(pending[0]?.status).toBe('PENDING');
  });

  it('2. debe actualizar estado a SYNCED en outbox y limpiar is_pending_sync en la entidad local', async () => {
    const mutationId = '550e8400-e29b-41d4-a716-446655440099';

    // Guardado optimista del post en caché local
    await db.bulkCachePosts([
      {
        client_mutation_id: mutationId,
        sector_id: 1,
        category_id: 4,
        operational_mode: 'EMERGENCIA',
        post_type: 'SOS_VULNERABLE',
        title: 'Adulto mayor requiere insulina urgente',
        description: 'Vecino en [DIRECCIÓN PROTEGIDA] necesita apoyo médico.',
        urgency_level: 'CRITICA',
        public_lat: -12.0848,
        public_lng: -77.0516,
        privacy_radius_meters: 50,
        status: 'ACTIVO',
        client_created_at: new Date().toISOString(),
        is_pending_sync: true,
      },
    ]);

    await db.enqueueMutation('/api/v1/posts', 'POST', {
      client_mutation_id: mutationId,
      title: 'Adulto mayor requiere insulina urgente',
    });

    // Confirmar sincronización
    await db.markMutationSynced(mutationId);

    const pendingAfter = await db.getPendingMutations();
    expect(pendingAfter).toHaveLength(0);

    const syncedPost = await db.posts.where('client_mutation_id').equals(mutationId).first();
    expect(syncedPost?.is_pending_sync).toBe(false);

    const outboxRecord = await db.outbox.where('client_mutation_id').equals(mutationId).first();
    expect(outboxRecord?.status).toBe('SYNCED');
  });

  it('3. debe ejecutar bulkCacheListings y bulkCacheCommitments de forma idempotente (Upsert por client_mutation_id)', async () => {
    const listingUuid = '33333333-3333-4333-8333-333333333301';
    const commitUuid = '77777777-7777-4777-8777-777777777701';

    await db.bulkCacheListings([
      {
        client_mutation_id: listingUuid,
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Maestro Gasfitero Jorge Quispe',
        description: 'Atención de fugas en San Felipe',
        contact_phone: '+51991234503',
        latitude: -12.0855,
        longitude: -77.0521,
        available_for_emergencies: true,
        endorsement_count: 2,
        weighted_trust_score: 3.0,
        is_pending_sync: false,
      },
    ]);

    // Actualizar el mismo oficio tras recibir un nuevo Visto Bueno desde el servidor
    await db.bulkCacheListings([
      {
        client_mutation_id: listingUuid,
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Maestro Gasfitero Jorge Quispe',
        description: 'Atención de fugas en San Felipe',
        contact_phone: '+51991234503',
        latitude: -12.0855,
        longitude: -77.0521,
        available_for_emergencies: true,
        endorsement_count: 3,
        weighted_trust_score: 4.5,
        is_pending_sync: false,
      },
    ]);

    const allListings = await db.listings.toArray();
    expect(allListings).toHaveLength(1);
    expect(allListings[0]?.endorsement_count).toBe(3);
    expect(allListings[0]?.weighted_trust_score).toBe(4.5);

    await db.bulkCacheCommitments([
      {
        client_mutation_id: commitUuid,
        post_client_mutation_id: '55555555-5555-4555-8555-555555555507',
        committed_quantity: 1,
        commitment_note: 'Llevo balón de oxígeno portátil',
        status: 'EN_CAMINO',
        created_at: new Date().toISOString(),
        is_pending_sync: true,
      },
    ]);

    const allCommitments = await db.commitments.toArray();
    expect(allCommitments).toHaveLength(1);
    expect(allCommitments[0]?.status).toBe('EN_CAMINO');
  });

  it('4. debe incrementar retry_count al marcar una mutación como fallida', async () => {
    const id = await db.enqueueMutation('/api/v1/posts', 'POST', { title: 'Test retry' });
    await db.markMutationFailed(id, 'Network timeout 504');

    const item = await db.outbox.where('client_mutation_id').equals(id).first();
    expect(item?.status).toBe('FAILED');
    expect(item?.retry_count).toBe(1);
    expect(item?.error_message).toBe('Network timeout 504');
  });
});
