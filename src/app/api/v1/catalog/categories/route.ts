import { desc, eq, or } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

/**
 * 3. GET /api/v1/catalog/categories?module_scope=ECONOMIA_LOCAL
 * Retorna taxonomía maestra de categorías, iconos y pesos de criticidad.
 */
export async function GET(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/catalog/categories',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const url = new URL(request.url);
    const moduleScope = url.searchParams.get('module_scope');
    const database = getApiDatabaseInstance();

    const categories = moduleScope
      ? await database
          .select()
          .from(schema.category_catalog)
          .where(
            or(
              eq(schema.category_catalog.module_scope, moduleScope),
              eq(schema.category_catalog.module_scope, 'AMBOS')
            )
          )
          .orderBy(desc(schema.category_catalog.priority_weight))
      : await database
          .select()
          .from(schema.category_catalog)
          .orderBy(desc(schema.category_catalog.priority_weight));

    return jsonOk(categories, { count: categories.length });
  } catch (err) {
    return handleRouteException(err, '/api/v1/catalog/categories');
  }
}
