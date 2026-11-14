import { jsonError } from '@/server/http/api-handler';
import { defaultGeocoder } from '@/server/geocoder/nominatim-adapter';

/**
 * GET /api/v1/geocoder/reverse?lat=-12.0528&lng=-75.2155
 * Proxy seguro para geocodificación inversa desde el pin movible.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const latParam = url.searchParams.get('lat');
    const lngParam = url.searchParams.get('lng');

    if (!latParam || !lngParam) {
      return jsonError(400, 'MISSING_COORDINATES', 'Se requieren los parámetros lat y lng.');
    }

    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return jsonError(400, 'INVALID_COORDINATES', 'Las coordenadas especificadas no son válidas.');
    }

    const place = await defaultGeocoder.reverse(lat, lng);
    return new Response(
      JSON.stringify({
        success: true,
        data: { place, attribution: '© OpenStreetMap' },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200',
        },
      }
    );
  } catch (err) {
    return jsonError(
      500,
      'GEOCODER_ERROR',
      err instanceof Error ? err.message : 'Error en la geocodificación inversa.'
    );
  }
}
