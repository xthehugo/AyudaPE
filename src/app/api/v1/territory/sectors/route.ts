import { asc, eq } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

/**
 * 2. GET /api/v1/territory/sectors?district_id=1
 * Retorna sectores barriales con centroides lat/lng y radio en metros.
 */
export async function GET(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/territory/sectors',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const url = new URL(request.url);
    const districtIdParam = url.searchParams.get('district_id');
    const database = getApiDatabaseInstance();

    const sectors = districtIdParam
      ? await database
          .select()
          .from(schema.neighborhood_sector)
          .where(eq(schema.neighborhood_sector.district_id, Number(districtIdParam)))
          .orderBy(asc(schema.neighborhood_sector.sector_code))
      : await database
          .select()
          .from(schema.neighborhood_sector)
          .orderBy(asc(schema.neighborhood_sector.sector_code));

    return jsonOk(sectors, { count: sectors.length });
  } catch (err) {
    return handleRouteException(err, '/api/v1/territory/sectors');
  }
}
