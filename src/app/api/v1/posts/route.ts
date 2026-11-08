import { and, desc, eq, inArray } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  extractActorFromRequest,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { CreateCommunityPostUseCase } from '@/server/use-cases/create-community-post';

/**
 * 8. GET /api/v1/posts
 * Filtros: sector_id, mode ('HABITUAL' | 'EMERGENCIA'), post_type, urgency.
 * Sanitiza la respuesta excluyendo columnas de `post_sensitive_pii` y exponiendo solo `public_lat/public_lng`.
 */
export async function GET(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/posts',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const url = new URL(request.url);
    const sectorId = url.searchParams.get('sector_id');
    const mode = url.searchParams.get('mode');
    const postType = url.searchParams.get('post_type');
    const urgency = url.searchParams.get('urgency');

    const conditions = [
      inArray(schema.community_post.status, ['ACTIVO', 'EN_COORDINACION', 'ATENDIDO']),
    ];

    if (sectorId) {
      conditions.push(eq(schema.community_post.sector_id, Number(sectorId)));
    }
    if (mode) {
      conditions.push(eq(schema.community_post.operational_mode, mode));
    }
    if (postType) {
      conditions.push(eq(schema.community_post.post_type, postType));
    }
    if (urgency) {
      conditions.push(eq(schema.community_post.urgency_level, urgency));
    }

    const database = getApiDatabaseInstance();
    const posts = await database
      .select({
        id: schema.community_post.id,
        client_mutation_id: schema.community_post.client_mutation_id,
        author_user_id: schema.community_post.author_user_id,
        sector_id: schema.community_post.sector_id,
        category_id: schema.community_post.category_id,
        operational_mode: schema.community_post.operational_mode,
        post_type: schema.community_post.post_type,
        title: schema.community_post.title,
        description: schema.community_post.description,
        urgency_level: schema.community_post.urgency_level,
        public_lat: schema.community_post.public_lat,
        public_lng: schema.community_post.public_lng,
        privacy_radius_meters: schema.community_post.privacy_radius_meters,
        status: schema.community_post.status,
        created_at: schema.community_post.created_at,
      })
      .from(schema.community_post)
      .where(and(...conditions))
      .orderBy(desc(schema.community_post.created_at))
      .limit(50);

    // Adjuntar ítems cuantificables de recursos (post_resource_item) sin consultar jamás post_sensitive_pii
    const postIds = posts.map((p: { id: number }) => p.id);
    const resources =
      postIds.length > 0
        ? await database
            .select()
            .from(schema.post_resource_item)
            .where(inArray(schema.post_resource_item.post_id, postIds))
        : [];

    const enrichedPosts = posts.map((post: { id: number }) => ({
      ...post,
      resources: resources.filter((r: { post_id: number }) => r.post_id === post.id),
    }));

    return jsonOk(enrichedPosts, { count: enrichedPosts.length });
  } catch (err) {
    return handleRouteException(err, '/api/v1/posts');
  }
}

/**
 * 11. POST /api/v1/posts
 * Crea una publicación en la Cadena de Favores o Tablero SOS aplicando invariante RN-01
 * y particionamiento transaccional en `post_sensitive_pii` cuando es `SOS_VULNERABLE`.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;
  const isSos = body.post_type === 'SOS_VULNERABLE' || body.operational_mode === 'EMERGENCIA';

  const rl = checkRateLimit(request, isSos ? 'SOS_PII' : 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Pool de emergencia saturado temporalmente. La alerta se resguarda en la cola local Outbox.',
      '/api/v1/posts',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const actor = extractActorFromRequest(request);
    const database = getApiDatabaseInstance();
    const useCase = new CreateCommunityPostUseCase(database);

    const result = await useCase.execute({
      ...(body as unknown as Parameters<CreateCommunityPostUseCase['execute']>[0]),
      author_user_id: Number(body.author_user_id ?? actor.userId),
    });

    return jsonOk(
      {
        post: result.post,
        resources: result.resources,
        pii_isolated: result.pii_isolated,
      },
      { idempotent_replay: result.idempotent_replay },
      result.idempotent_replay ? 200 : 201
    );
  } catch (err) {
    return handleRouteException(err, '/api/v1/posts');
  }
}
