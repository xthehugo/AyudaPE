import { eq } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

export interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * 9. GET /api/v1/posts/[id]
 * Retorna detalle público sanitizado de la publicación con sus recursos atómicos y compromisos.
 * NUNCA expone datos de `post_sensitive_pii`.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/posts/[id]',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const postId = Number(resolvedParams.id);

    if (!Number.isInteger(postId) || postId <= 0) {
      return jsonError(400, 'INVALID_ID', 'El identificador de la publicación no es válido.');
    }

    const database = getApiDatabaseInstance();
    const [post] = await database
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
      .where(eq(schema.community_post.id, postId))
      .limit(1);

    if (!post) {
      return jsonError(
        404,
        'NOT_FOUND',
        'La publicación solicitada no fue encontrada.',
        `/api/v1/posts/${postId}`
      );
    }

    const resources = await database
      .select()
      .from(schema.post_resource_item)
      .where(eq(schema.post_resource_item.post_id, postId));

    const commitments = await database
      .select()
      .from(schema.resource_commitment)
      .where(eq(schema.resource_commitment.post_id, postId));

    return jsonOk({
      ...post,
      resources,
      commitments,
    });
  } catch (err) {
    return handleRouteException(err, '/api/v1/posts/[id]');
  }
}
