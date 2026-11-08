import { and, eq, gt, inArray } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

/**
 * 16. GET /api/v1/sync/delta?sector_id=1&since_timestamp=2026-11-07T00:00:00.000Z
 * Downlink incremental: retorna `DeltaSyncResponseDto` para hidratar Dexie.js en el cliente.
 * NUNCA incluye datos de `post_sensitive_pii`.
 */
export async function GET(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de sincronización delta excedido.',
      '/api/v1/sync/delta',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const url = new URL(request.url);
    const sectorIdParam = url.searchParams.get('sector_id');
    const sinceTimestampParam = url.searchParams.get('since_timestamp');

    const sectorId = sectorIdParam ? Number(sectorIdParam) : 1;
    if (!Number.isInteger(sectorId) || sectorId <= 0) {
      return jsonError(400, 'INVALID_SECTOR_ID', 'El parámetro sector_id debe ser un entero positivo.');
    }

    const sinceDate = sinceTimestampParam ? new Date(sinceTimestampParam) : null;
    const isValidSince = sinceDate !== null && !Number.isNaN(sinceDate.getTime());

    const database = getApiDatabaseInstance();

    const listingConditions = [
      eq(schema.proximity_listing.sector_id, sectorId),
      eq(schema.proximity_listing.is_active, true),
    ];
    if (isValidSince) {
      listingConditions.push(gt(schema.proximity_listing.updated_at, sinceDate));
    }

    const postConditions = [eq(schema.community_post.sector_id, sectorId)];
    if (isValidSince) {
      postConditions.push(gt(schema.community_post.updated_at, sinceDate));
    }

    const [listings, posts, categories] = await Promise.all([
      database
        .select()
        .from(schema.proximity_listing)
        .where(and(...listingConditions)),
      database
        .select({
          id: schema.community_post.id,
          client_mutation_id: schema.community_post.client_mutation_id,
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
          client_created_at: schema.community_post.client_created_at,
          updated_at: schema.community_post.updated_at,
        })
        .from(schema.community_post)
        .where(and(...postConditions)),
      database.select().from(schema.category_catalog),
    ]);

    const postIds = posts.map((p: { id: number }) => p.id);
    const commitments =
      postIds.length > 0
        ? await database
            .select()
            .from(schema.resource_commitment)
            .where(inArray(schema.resource_commitment.post_id, postIds))
        : [];

    return jsonOk({
      server_timestamp: new Date().toISOString(),
      sector_id: sectorId,
      listings: listings.map((l: Record<string, unknown>) => ({
        ...l,
        weighted_trust_score: Number(l.weighted_trust_score ?? 0),
        is_pending_sync: false,
      })),
      posts: posts.map((p: Record<string, unknown>) => ({
        ...p,
        is_pending_sync: false,
      })),
      commitments: commitments.map((c: Record<string, unknown>) => ({
        ...c,
        committed_quantity: Number(c.committed_quantity ?? 1),
        is_pending_sync: false,
      })),
      categories,
      has_more: false,
    });
  } catch (err) {
    return handleRouteException(err, '/api/v1/sync/delta');
  }
}
