import { jsonError, jsonOk } from '@/server/http/api-handler';
import { defaultGeocoder } from '@/server/geocoder/nominatim-adapter';

/**
 * GET /api/v1/geocoder/search?q=Parque+Bolognesi&minLat=...
 * Proxy seguro para búsqueda de lugares en OpenStreetMap Nominatim.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    if (!q || q.trim().length < 2) {
      return jsonError(400, 'QUERY_TOO_SHORT', 'La consulta debe tener al menos 2 caracteres.');
    }

    const minLat = url.searchParams.get('minLat');
    const minLng = url.searchParams.get('minLng');
    const maxLat = url.searchParams.get('maxLat');
    const maxLng = url.searchParams.get('maxLng');

    const bounds =
      minLat && minLng && maxLat && maxLng
        ? {
            minLat: parseFloat(minLat),
            minLng: parseFloat(minLng),
            maxLat: parseFloat(maxLat),
            maxLng: parseFloat(maxLng),
          }
        : undefined;

    const places = await defaultGeocoder.search(q, { bounds, limit: 6 });
    return jsonOk({ places, attribution: '© OpenStreetMap' });
  } catch (err) {
    return jsonError(
      500,
      'GEOCODER_ERROR',
      err instanceof Error ? err.message : 'Error al consultar el servicio geográfico.'
    );
  }
}
