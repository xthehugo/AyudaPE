import {
  checkRateLimit,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { calculateDistanceMeters } from '@/lib/geo-utils';
import { INITIAL_SECTOR_POSTS } from '@/lib/initial-data';
import { CreateCommunityPostUseCase } from '@/server/use-cases/create-community-post';

/**
 * Memoria volátil de necesidades / posts para alta resiliencia
 */
const inMemoryNeeds = [...INITIAL_SECTOR_POSTS];

/**
 * GET /api/v1/needs?lat=-12.075&lng=-77.048&radius=1000
 * Consulta geolocalizada de necesidades con ubicación aproximada (difuminado Ley N° 29733).
 * NUNCA pide cuenta, DNI ni internet (funciona con caché offline).
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const latParam = url.searchParams.get('lat');
  const lngParam = url.searchParams.get('lng');
  const radiusParam = url.searchParams.get('radius');

  const refLat = latParam ? Number(latParam) : -12.0752;
  const refLng = lngParam ? Number(lngParam) : -77.0485;
  const radiusMeters = radiusParam ? Number(radiusParam) : 35000;

  // Filtrar necesidades por radio geodésico y retornar con ubicación aproximada
  const filtered = inMemoryNeeds
    .filter((need) => {
      const distance = calculateDistanceMeters(need.public_lat, need.public_lng, refLat, refLng);
      return distance <= radiusMeters;
    })
    .map((need) => ({
      ...need,
      // Ubicación aproximada garantizada
      exact_address: undefined,
    }));

  return jsonOk({
    needs: filtered,
    total: filtered.length,
    approximate_center: { lat: refLat, lng: refLng },
  });
}

/**
 * POST /api/v1/needs
 * Publica una necesidad solidaria o SOS (máximo 3 clics, sin cuenta requerida).
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de solicitudes excedido.', '/api/v1/needs');
  }

  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const database = getApiDatabaseInstance();
    const useCase = new CreateCommunityPostUseCase(database);

    const postType = (rawBody.post_type as string) || 'SOLICITUD_FAVOR';
    const sectorId = Number(rawBody.sector_id) || 1;
    const categoryId = Number(rawBody.category_id) || 5;

    const result = await useCase.execute({
      client_mutation_id: String(rawBody.client_mutation_id || crypto.randomUUID()),
      author_user_id: 1, // Usuario anónimo predeterminado
      sector_id: sectorId,
      category_id: categoryId,
      operational_mode: 'HABITUAL',
      post_type: postType as any,
      title: String(rawBody.title || 'Solicitud solidaria vecinal'),
      description: String(rawBody.description || ''),
      urgency_level: (rawBody.urgency_level as any) || 'MEDIA',
      public_lat: Number(rawBody.public_lat) || -12.0752,
      public_lng: Number(rawBody.public_lng) || -77.0485,
      resources: Array.isArray(rawBody.resources)
        ? (rawBody.resources as any[])
        : undefined,
    });

    return jsonOk(result, undefined, 201);
  } catch (error) {
    return handleRouteException(error, '/api/v1/needs');
  }
}
