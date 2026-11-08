import { eq, sql } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  getApiDatabaseInstance,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

export interface InteractionStageRecord {
  post_client_mutation_id: string;
  stage: 'PENDIENTE' | 'COMPROMETIDO' | 'ENTREGADO' | 'RECIBIDO';
  author_device_id?: string;
  helper_device_id?: string;
  helper_name?: string;
  post_title?: string;
  updated_at: string;
}

// Memoria de respaldo rápida para instancias cálidas (complementa PostgreSQL)
const globalStore = globalThis as unknown as {
  __redvecinaStages?: Map<string, InteractionStageRecord>;
  __redvecinaAuthors?: Map<string, string>;
};

if (!globalStore.__redvecinaStages) {
  globalStore.__redvecinaStages = new Map<string, InteractionStageRecord>();
}
if (!globalStore.__redvecinaAuthors) {
  globalStore.__redvecinaAuthors = new Map<string, string>();
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/realtime/interaction
 * Devuelve el mapa actualizado de estados solidarios (Compromiso -> Entregado -> Recibido)
 * y autores registrados desde PostgreSQL + memoria del servidor.
 */
export async function GET(): Promise<Response> {
  try {
    const database = getApiDatabaseInstance();
    const stages: Record<string, InteractionStageRecord> = {};
    const authors: Record<string, string> = {};

    for (const [k, v] of globalStore.__redvecinaAuthors!.entries()) {
      authors[k] = v;
    }
    for (const [k, v] of globalStore.__redvecinaStages!.entries()) {
      stages[k] = v;
    }

    try {
      const [posts, commitments] = await Promise.all([
        database
          .select({
            id: schema.community_post.id,
            client_mutation_id: schema.community_post.client_mutation_id,
            title: schema.community_post.title,
            status: schema.community_post.status,
            updated_at: schema.community_post.updated_at,
          })
          .from(schema.community_post),
        database
          .select({
            post_client_mutation_id: schema.resource_commitment.post_client_mutation_id,
            commitment_note: schema.resource_commitment.commitment_note,
            status: schema.resource_commitment.status,
            updated_at: schema.resource_commitment.updated_at,
          })
          .from(schema.resource_commitment),
      ]);

      for (const p of posts) {
        const mutId = String(p.client_mutation_id);
        if (!stages[mutId]) {
          const derivedStage: InteractionStageRecord['stage'] =
            p.status === 'ATENDIDO'
              ? 'RECIBIDO'
              : p.status === 'EN_COORDINACION'
              ? 'COMPROMETIDO'
              : 'PENDIENTE';
          if (derivedStage !== 'PENDIENTE') {
            stages[mutId] = {
              post_client_mutation_id: mutId,
              stage: derivedStage,
              post_title: p.title,
              updated_at:
                p.updated_at instanceof Date
                  ? p.updated_at.toISOString()
                  : new Date().toISOString(),
            };
          }
        }
      }

      for (const c of commitments) {
        const mutId = c.post_client_mutation_id ? String(c.post_client_mutation_id) : '';
        if (!mutId) continue;
        const note = String(c.commitment_note ?? '');
        if (note.startsWith('{') && note.endsWith('}')) {
          try {
            const parsed = JSON.parse(note) as {
              s?: InteractionStageRecord['stage'];
              a?: string;
              h?: string;
              n?: string;
            };
            if (parsed.s) {
              stages[mutId] = {
                post_client_mutation_id: mutId,
                stage: parsed.s,
                author_device_id: parsed.a ?? stages[mutId]?.author_device_id,
                helper_device_id: parsed.h ?? stages[mutId]?.helper_device_id,
                helper_name: parsed.n ?? stages[mutId]?.helper_name,
                updated_at:
                  c.updated_at instanceof Date
                    ? c.updated_at.toISOString()
                    : new Date().toISOString(),
              };
            }
            if (parsed.a) {
              authors[mutId] = parsed.a;
            }
          } catch {
            // Nota en texto plano
          }
        }
      }
    } catch {
      // Continuar con estado en memoria si la consulta falla temporalmente
    }

    return jsonOk({
      server_timestamp: new Date().toISOString(),
      stages,
      authors,
    });
  } catch {
    return jsonOk({
      server_timestamp: new Date().toISOString(),
      stages: Object.fromEntries(globalStore.__redvecinaStages!.entries()),
      authors: Object.fromEntries(globalStore.__redvecinaAuthors!.entries()),
    });
  }
}

/**
 * POST /api/v1/realtime/interaction
 * Persiste en servidor y PostgreSQL:
 * - REGISTER_AUTHOR: asocia client_mutation_id con author_device_id
 * - SOLIDARITY_STAGE: actualiza el paso (PENDIENTE -> COMPROMETIDO -> ENTREGADO -> RECIBIDO)
 * - LISTING_ENDORSE: incrementa el contador de recomendaciones en PostgreSQL
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? '');
    const database = getApiDatabaseInstance();

    if (action === 'REGISTER_AUTHOR') {
      const mutationId = String(body.client_mutation_id ?? '').trim();
      const authorDeviceId = String(body.author_device_id ?? '').trim();
      if (mutationId && authorDeviceId) {
        globalStore.__redvecinaAuthors!.set(mutationId, authorDeviceId);
      }
      return jsonOk({ registered: true, client_mutation_id: mutationId });
    }

    if (action === 'SOLIDARITY_STAGE') {
      const postMutationId = String(body.post_client_mutation_id ?? '').trim();
      const rawStage = String(body.stage ?? 'COMPROMETIDO') as InteractionStageRecord['stage'];
      const authorDeviceId = body.author_device_id
        ? String(body.author_device_id).trim()
        : globalStore.__redvecinaAuthors!.get(postMutationId);
      const helperDeviceId = body.helper_device_id
        ? String(body.helper_device_id).trim()
        : undefined;
      const helperName = body.helper_name ? String(body.helper_name).trim() : undefined;
      const postTitle = body.post_title ? String(body.post_title).trim() : undefined;

      if (!postMutationId) {
        return jsonError(400, 'MISSING_MUTATION_ID', 'Se requiere post_client_mutation_id.');
      }

      const prev = globalStore.__redvecinaStages!.get(postMutationId);
      const record: InteractionStageRecord = {
        post_client_mutation_id: postMutationId,
        stage: rawStage,
        author_device_id: authorDeviceId ?? prev?.author_device_id,
        helper_device_id: helperDeviceId ?? prev?.helper_device_id,
        helper_name: helperName ?? prev?.helper_name,
        post_title: postTitle ?? prev?.post_title,
        updated_at: new Date().toISOString(),
      };
      globalStore.__redvecinaStages!.set(postMutationId, record);

      if (record.author_device_id) {
        globalStore.__redvecinaAuthors!.set(postMutationId, record.author_device_id);
      }

      // Persistir en PostgreSQL si el UUID es válido y existe el post
      if (UUID_REGEX.test(postMutationId)) {
        try {
          const nextDbStatus =
            rawStage === 'RECIBIDO'
              ? 'ATENDIDO'
              : rawStage === 'PENDIENTE'
              ? 'ACTIVO'
              : 'EN_COORDINACION';

          const foundPosts = await database
            .select({ id: schema.community_post.id })
            .from(schema.community_post)
            .where(eq(schema.community_post.client_mutation_id, postMutationId))
            .limit(1);

          if (foundPosts.length > 0) {
            const postId = foundPosts[0].id;
            await database
              .update(schema.community_post)
              .set({
                status: nextDbStatus,
                updated_at: new Date(),
              })
              .where(eq(schema.community_post.id, postId));

            const compactNote = JSON.stringify({
              s: record.stage,
              a: record.author_device_id?.slice(0, 48),
              h: record.helper_device_id?.slice(0, 48),
              n: record.helper_name?.slice(0, 32),
            }).slice(0, 245);

            const existingCommitments = await database
              .select({ id: schema.resource_commitment.id })
              .from(schema.resource_commitment)
              .where(eq(schema.resource_commitment.post_id, postId))
              .limit(1);

            if (existingCommitments.length > 0) {
              await database
                .update(schema.resource_commitment)
                .set({
                  commitment_note: compactNote,
                  status: rawStage === 'RECIBIDO' ? 'ENTREGADO' : 'EN_CAMINO',
                  updated_at: new Date(),
                })
                .where(eq(schema.resource_commitment.id, existingCommitments[0].id));
            } else {
              await database.insert(schema.resource_commitment).values({
                post_id: postId,
                post_client_mutation_id: postMutationId,
                helper_user_id: 1,
                committed_quantity: '1.00',
                commitment_note: compactNote,
                status: rawStage === 'RECIBIDO' ? 'ENTREGADO' : 'EN_CAMINO',
              });
            }
          }
        } catch {
          // Si el post aún está en tránsito en el outbox, se conserva en memoria del servidor
        }
      }

      return jsonOk({ updated: true, record });
    }

    if (action === 'LISTING_ENDORSE') {
      const listingMutationId = String(body.listing_client_mutation_id ?? '').trim();
      const listingId = body.listing_id ? Number(body.listing_id) : undefined;
      const proximityWeight = Number(body.proximity_weight ?? 1.0);

      try {
        if (listingMutationId && UUID_REGEX.test(listingMutationId)) {
          await database
            .update(schema.proximity_listing)
            .set({
              endorsement_count: sql`${schema.proximity_listing.endorsement_count} + 1`,
              weighted_trust_score: sql`${schema.proximity_listing.weighted_trust_score} + ${proximityWeight}`,
              updated_at: new Date(),
            })
            .where(eq(schema.proximity_listing.client_mutation_id, listingMutationId));
        } else if (listingId && Number.isInteger(listingId) && listingId > 0) {
          await database
            .update(schema.proximity_listing)
            .set({
              endorsement_count: sql`${schema.proximity_listing.endorsement_count} + 1`,
              weighted_trust_score: sql`${schema.proximity_listing.weighted_trust_score} + ${proximityWeight}`,
              updated_at: new Date(),
            })
            .where(eq(schema.proximity_listing.id, listingId));
        }
      } catch {
        // Ignorar si es una semilla local que no está en PostgreSQL
      }

      return jsonOk({ endorsed: true, listing_client_mutation_id: listingMutationId });
    }

    return jsonError(400, 'INVALID_ACTION', 'Acción no reconocida.');
  } catch (err) {
    return jsonError(
      500,
      'INTERACTION_ERROR',
      err instanceof Error ? err.message : 'Error procesando interacción en tiempo real.'
    );
  }
}
