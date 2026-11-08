import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import {
  resetRateLimiterStore,
  setApiDatabaseInstance,
} from '@/server/http/api-handler';

import { GET as getCategories } from '../catalog/categories/route';
import { POST as postCopilotChat } from '../ai/copilot-chat/route';
import { POST as postParseIntent } from '../ai/parse-intent/route';
import { POST as postEndorse } from '../listings/[id]/endorse/route';
import { GET as getListingById } from '../listings/[id]/route';
import { GET as getListings, POST as postListing } from '../listings/route';
import { GET as getInstitutionalImpact } from '../metrics/institutional-impact/route';
import { POST as postCommitment } from '../posts/[id]/commitments/route';
import { GET as getPostById } from '../posts/[id]/route';
import { POST as postSensitivePii } from '../posts/[id]/sensitive-pii/route';
import { GET as getPosts, POST as postCommunityPost } from '../posts/route';
import { POST as postSyncBatch } from '../sync/batch/route';
import { GET as getSyncDelta } from '../sync/delta/route';
import { GET as getDistricts } from '../territory/districts/route';
import { GET as getSectors } from '../territory/sectors/route';

describe('[MOD-07] Capa 3 — Suite Completa de 17 Endpoints RESTful OpenAPI 3.1 y Seguridad PII', () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    const testDb = drizzle(pg, { schema });
    setApiDatabaseInstance(testDb);

    const ddl001 = readFileSync(
      join(process.cwd(), 'src/database/migrations/001_initial_enterprise_schema.sql'),
      'utf-8'
    );
    const ddl002 = readFileSync(
      join(process.cwd(), 'src/database/migrations/002_functions_and_triggers.sql'),
      'utf-8'
    );
    const seed003 = readFileSync(
      join(process.cwd(), 'src/database/seeds/003_seed_lima_sector4.sql'),
      'utf-8'
    );

    await pg.exec(ddl001);
    await pg.exec(ddl002);
    await pg.exec(seed003);
  });

  beforeEach(() => {
    resetRateLimiterStore();
  });

  afterAll(async () => {
    await pg.close();
  });

  it('1. Bloque 1: debe servir distritos (1), sectores (2) y categorías maestras (3)', async () => {
    const resDistricts = await getDistricts(
      new Request('http://localhost:3000/api/v1/territory/districts')
    );
    expect(resDistricts.status).toBe(200);
    const jsonDistricts = await resDistricts.json();
    expect(jsonDistricts.success).toBe(true);
    expect(jsonDistricts.data[0].ubigeo_code).toBe('150113');

    const resSectors = await getSectors(
      new Request('http://localhost:3000/api/v1/territory/sectors?district_id=1')
    );
    expect(resSectors.status).toBe(200);
    const jsonSectors = await resSectors.json();
    expect(jsonSectors.data[0].sector_code).toBe('JM-SEC-04');

    const resCats = await getCategories(
      new Request('http://localhost:3000/api/v1/catalog/categories?module_scope=ECONOMIA_LOCAL')
    );
    expect(resCats.status).toBe(200);
    const jsonCats = await resCats.json();
    expect(jsonCats.data.length).toBeGreaterThanOrEqual(5);
  });

  it('2. Bloque 2: debe listar oficios/productos (4), obtener detalle (5), crear oficio (6) y emitir Visto Bueno (7)', async () => {
    const resList = await getListings(
      new Request('http://localhost:3000/api/v1/listings?sector_id=1&emergency_only=true')
    );
    expect(resList.status).toBe(200);
    const jsonList = await resList.json();
    expect(jsonList.data.length).toBeGreaterThanOrEqual(10);

    const firstId = jsonList.data[0].id as number;
    const resDetail = await getListingById(
      new Request(`http://localhost:3000/api/v1/listings/${firstId}`),
      { params: { id: String(firstId) } }
    );
    expect(resDetail.status).toBe(200);
    const jsonDetail = await resDetail.json();
    expect(jsonDetail.data.owner).toBeDefined();
    expect(Array.isArray(jsonDetail.data.recent_endorsements)).toBe(true);

    // Crear nuevo oficio
    const createRes = await postListing(
      new Request('http://localhost:3000/api/v1/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '4' },
        body: JSON.stringify({
          client_mutation_id: '99999999-9999-4999-8999-999999999901',
          listing_type: 'SERVICIO_OFICIO',
          category_id: 2,
          title: 'Revisión de Pozos a Tierra y Tableros',
          description: 'Diagnóstico eléctrico preventivo para edificios de San Felipe.',
          contact_phone: '+51991234504',
          latitude: -12.0833,
          longitude: -77.0525,
          available_for_emergencies: true,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const createdJson = await createRes.json();
    const newListingId = createdJson.data.id as number;

    // Emitir Visto Bueno desde otro vecino (userId = 1)
    const endorseRes = await postEndorse(
      new Request(`http://localhost:3000/api/v1/listings/${newListingId}/endorse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
        body: JSON.stringify({
          client_mutation_id: '99999999-9999-4999-8999-999999999902',
          comment: 'Revisó las conexiones del edificio con mucha prolijidad.',
        }),
      }),
      { params: { id: String(newListingId) } }
    );
    expect(endorseRes.status).toBe(201);
    const endorseJson = await endorseRes.json();
    expect(endorseJson.data.updated_listing.endorsement_count).toBe(1);
  });

  it('3. Bloque 3: debe proteger PII en GET /posts (8, 9), exigir RBAC en POST /sensitive-pii (10) y validar RN-01 en POST /posts (11) + compromisos (12)', async () => {
    const resPosts = await getPosts(
      new Request('http://localhost:3000/api/v1/posts?sector_id=1&mode=EMERGENCIA')
    );
    expect(resPosts.status).toBe(200);
    const jsonPosts = await resPosts.json();
    const sosPost = jsonPosts.data.find(
      (p: { post_type: string }) => p.post_type === 'SOS_VULNERABLE'
    );
    expect(sosPost).toBeDefined();
    expect(sosPost.exact_address_reference).toBeUndefined();
    expect(sosPost.privacy_radius_meters).toBe(50);

    const resPostDetail = await getPostById(
      new Request(`http://localhost:3000/api/v1/posts/${sosPost.id}`),
      { params: { id: String(sosPost.id) } }
    );
    expect(resPostDetail.status).toBe(200);

    // Intento de desbloqueo de PII por un VECINO estándar -> debe devolver HTTP 403 Forbidden
    const resForbiddenPii = await postSensitivePii(
      new Request(`http://localhost:3000/api/v1/posts/${sosPost.id}/sensitive-pii`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': '3',
          'x-user-role': 'VECINO',
        },
        body: JSON.stringify({
          access_reason: 'Quiero ver dónde vive exactamente el vecino.',
        }),
      }),
      { params: { id: String(sosPost.id) } }
    );
    expect(resForbiddenPii.status).toBe(403);

    // Desbloqueo autorizado por BRIGADISTA_CERTIFICADO -> debe devolver HTTP 200 y registrar auditoría
    const resAllowedPii = await postSensitivePii(
      new Request(`http://localhost:3000/api/v1/posts/${sosPost.id}/sensitive-pii`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': '2',
          'x-user-role': 'BRIGADISTA_CERTIFICADO',
        },
        body: JSON.stringify({
          access_reason: 'Intervención de Brigada San Felipe con soporte de oxígeno medicinal.',
        }),
      }),
      { params: { id: String(sosPost.id) } }
    );
    expect(resAllowedPii.status).toBe(200);
    const jsonAllowedPii = await resAllowedPii.json();
    expect(jsonAllowedPii.data.exact_address).toBeDefined();
    expect(jsonAllowedPii.data.access_audit_id).toBeDefined();

    // Intento de publicar un favor con cobro por Yape -> debe devolver HTTP 422 (RFC 7807)
    const resInvalidFavor = await postCommunityPost(
      new Request('http://localhost:3000/api/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '3' },
        body: JSON.stringify({
          client_mutation_id: '99999999-9999-4999-8999-999999999903',
          operational_mode: 'HABITUAL',
          post_type: 'OFERTA_FAVOR',
          category_id: 9,
          title: 'Presto escalera',
          description: 'La presto pero me dejan 15 lucas por yape.',
          urgency_level: 'BAJA',
          public_lat: -12.085,
          public_lng: -77.0515,
        }),
      })
    );
    expect(resInvalidFavor.status).toBe(422);

    // Compromiso de recurso sobre publicación existente
    const resCommit = await postCommitment(
      new Request(`http://localhost:3000/api/v1/posts/${sosPost.id}/commitments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '2' },
        body: JSON.stringify({
          client_mutation_id: '99999999-9999-4999-8999-999999999904',
          committed_quantity: 1,
          commitment_note: 'Llevando segundo balón de respaldo al departamento.',
        }),
      }),
      { params: { id: String(sosPost.id) } }
    );
    expect(resCommit.status).toBe(201);
  });

  it('4. Bloques 4, 5 y 6: debe procesar IA (13, 14), sincronizar lote offline con resolución de UUIDs (15), delta downlink (16) y métricas B2G (17)', async () => {
    // 13. Parse intent
    const resIntent = await postParseIntent(
      new Request('http://localhost:3000/api/v1/ai/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Auxilio urgente mi abuelita en Jr. Huiracocha 1480 Dpto 201 sufre de insuficiencia cardíaca y necesita oxígeno',
          current_mode: 'EMERGENCIA',
        }),
      })
    );
    expect(resIntent.status).toBe(200);
    const jsonIntent = await resIntent.json();
    expect(jsonIntent.data.post_type).toBe('SOS_VULNERABLE');
    expect(jsonIntent.data.is_pii_redacted).toBe(true);
    expect(jsonIntent.data.description).toContain('[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]');

    // 14. Copilot chat
    const resCopilot = await postCopilotChat(
      new Request('http://localhost:3000/api/v1/ai/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '¿Quién tiene botiquín o gasfitero de emergencia en el sector?',
          sector_id: 1,
          current_mode: 'EMERGENCIA',
        }),
      })
    );
    expect(resCopilot.status).toBe(200);
    const jsonCopilot = await resCopilot.json();
    expect(jsonCopilot.data.recommended_specialists.length).toBeGreaterThan(0);

    // 15. Batch Sync con resolución transaccional de UUID de post + recurso + compromiso en el mismo lote
    const offlinePostUuid = '99999999-9999-4999-8999-999999999905';
    const offlineResourceUuid = '99999999-9999-4999-8999-999999999906';
    const offlineCommitUuid = '99999999-9999-4999-8999-999999999907';

    const resBatch = await postSyncBatch(
      new Request('http://localhost:3000/api/v1/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
        body: JSON.stringify({
          mutations: [
            {
              client_mutation_id: offlinePostUuid,
              endpoint: '/api/v1/posts',
              http_method: 'POST',
              created_at: '2026-11-07T04:00:00.000Z',
              payload: {
                operational_mode: 'EMERGENCIA',
                post_type: 'RECURSO_SOLIDARIO',
                category_id: 6,
                title: 'Punto de distribución de agua en pasaje Los Pinos',
                description: 'Coordinando entrega de bidones para el bloque F.',
                urgency_level: 'ALTA',
                public_lat: -12.0851,
                public_lng: -77.0517,
                resources: [
                  {
                    client_mutation_id: offlineResourceUuid,
                    item_name: 'Bidones de agua',
                    quantity_needed: 5,
                    unit: 'UNIDADES',
                  },
                ],
              },
            },
            {
              client_mutation_id: offlineCommitUuid,
              endpoint: '/api/v1/posts/0/commitments',
              http_method: 'POST',
              created_at: '2026-11-07T04:01:00.000Z',
              payload: {
                post_client_mutation_id: offlinePostUuid,
                resource_item_client_mutation_id: offlineResourceUuid,
                committed_quantity: 2,
                commitment_note: 'Aporto 2 bidones creados mientras estábamos sin internet.',
              },
            },
          ],
        }),
      })
    );
    expect(resBatch.status).toBe(200);
    const jsonBatch = await resBatch.json();
    expect(jsonBatch.data.processed_count).toBe(2);
    expect(jsonBatch.data.results[0].status).toBe('SYNCED');
    expect(jsonBatch.data.results[1].status).toBe('SYNCED');

    // 16. Delta Downlink
    const resDelta = await getSyncDelta(
      new Request('http://localhost:3000/api/v1/sync/delta?sector_id=1')
    );
    expect(resDelta.status).toBe(200);
    const jsonDelta = await resDelta.json();
    expect(jsonDelta.data.listings.length).toBeGreaterThanOrEqual(12);
    expect(jsonDelta.data.posts.length).toBeGreaterThanOrEqual(10);

    // 17. Institutional Impact B2G
    const resMetrics = await getInstitutionalImpact(
      new Request('http://localhost:3000/api/v1/metrics/institutional-impact?sector_id=1')
    );
    expect(resMetrics.status).toBe(200);
    const jsonMetrics = await resMetrics.json();
    expect(jsonMetrics.data.connected_neighbors_total).toBeGreaterThanOrEqual(8);
    expect(jsonMetrics.data.pii_vault_audited_dispatches).toBeGreaterThanOrEqual(2);
  });
});
