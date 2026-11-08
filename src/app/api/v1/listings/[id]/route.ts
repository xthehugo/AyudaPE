import { desc, eq } from 'drizzle-orm';
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
 * 5. GET /api/v1/listings/[id]
 * Retorna ficha completa del oficio/producto con perfil del anunciante y últimos 10 vistos buenos.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/listings/[id]',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const listingId = Number(resolvedParams.id);

    if (!Number.isInteger(listingId) || listingId <= 0) {
      return jsonError(400, 'INVALID_ID', 'El identificador del servicio no es válido.');
    }

    const database = getApiDatabaseInstance();
    const [listing] = await database
      .select()
      .from(schema.proximity_listing)
      .where(eq(schema.proximity_listing.id, listingId))
      .limit(1);

    if (!listing) {
      return jsonError(
        404,
        'NOT_FOUND',
        'El oficio o producto solicitado no fue encontrado.',
        `/api/v1/listings/${listingId}`
      );
    }

    const [owner] = await database
      .select({
        id: schema.user_profile.id,
        full_name: schema.user_profile.full_name,
        is_verified_neighbor: schema.user_profile.is_verified_neighbor,
        system_role: schema.user_profile.system_role,
        reputation_points: schema.user_profile.reputation_points,
      })
      .from(schema.user_profile)
      .where(eq(schema.user_profile.id, listing.owner_user_id))
      .limit(1);

    const endorsements = await database
      .select()
      .from(schema.neighbor_endorsement)
      .where(eq(schema.neighbor_endorsement.listing_id, listingId))
      .orderBy(desc(schema.neighbor_endorsement.created_at))
      .limit(10);

    return jsonOk({
      ...listing,
      owner: owner ?? null,
      recent_endorsements: endorsements,
    });
  } catch (err) {
    return handleRouteException(err, '/api/v1/listings/[id]');
  }
}
