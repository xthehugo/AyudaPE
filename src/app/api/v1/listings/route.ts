import { and, desc, eq, lt } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  extractActorFromRequest,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { RegisterListingUseCase } from '@/server/use-cases/register-listing';

/**
 * 4. GET /api/v1/listings
 * Filtros: sector_id, category_id, listing_type, emergency_only, cursor y limit.
 * Ordenado por weighted_trust_score DESC.
 */
export async function GET(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/listings',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const url = new URL(request.url);
    const sectorId = url.searchParams.get('sector_id');
    const categoryId = url.searchParams.get('category_id');
    const listingType = url.searchParams.get('listing_type');
    const emergencyOnly = url.searchParams.get('emergency_only') === 'true';
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 50);

    const conditions = [eq(schema.proximity_listing.is_active, true)];

    if (sectorId) {
      conditions.push(eq(schema.proximity_listing.sector_id, Number(sectorId)));
    }
    if (categoryId) {
      conditions.push(eq(schema.proximity_listing.category_id, Number(categoryId)));
    }
    if (listingType) {
      conditions.push(eq(schema.proximity_listing.listing_type, listingType));
    }
    if (emergencyOnly) {
      conditions.push(eq(schema.proximity_listing.available_for_emergencies, true));
    }
    if (cursor) {
      conditions.push(lt(schema.proximity_listing.id, Number(cursor)));
    }

    const database = getApiDatabaseInstance();
    const rows = await database
      .select()
      .from(schema.proximity_listing)
      .where(and(...conditions))
      .orderBy(
        desc(schema.proximity_listing.weighted_trust_score),
        desc(schema.proximity_listing.id)
      )
      .limit(limit);

    const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id ?? null : null;

    return jsonOk(rows, { count: rows.length, next_cursor: nextCursor });
  } catch (err) {
    return handleRouteException(err, '/api/v1/listings');
  }
}

/**
 * 6. POST /api/v1/listings
 * Registra un nuevo oficio, producto local o soporte de emergencia.
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/listings',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const actor = extractActorFromRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const database = getApiDatabaseInstance();
    const useCase = new RegisterListingUseCase(database);

    const result = await useCase.execute({
      ...(body as unknown as Parameters<RegisterListingUseCase['execute']>[0]),
      owner_user_id: Number(body.owner_user_id ?? actor.userId),
      sector_id: body.sector_id ? Number(body.sector_id) : undefined,
    });

    return jsonOk(
      result.listing,
      { idempotent_replay: result.idempotent_replay },
      result.idempotent_replay ? 200 : 201
    );
  } catch (err) {
    return handleRouteException(err, '/api/v1/listings');
  }
}
