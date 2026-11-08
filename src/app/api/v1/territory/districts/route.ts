import { asc } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

/**
 * 1. GET /api/v1/territory/districts
 * Retorna lista de distritos con código UBIGEO y estado `emergency_active`.
 */
export async function GET(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/territory/districts',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const database = getApiDatabaseInstance();
    const districts = await database
      .select()
      .from(schema.district)
      .orderBy(asc(schema.district.ubigeo_code));

    return jsonOk(districts, { count: districts.length });
  } catch (err) {
    return handleRouteException(err, '/api/v1/territory/districts');
  }
}
