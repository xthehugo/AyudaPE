import { NextResponse } from 'next/server';

const DEFAULT_OSM_MAPTILER_KEY =
  process.env.MAPTILER_API_KEY ??
  process.env.NEXT_PUBLIC_MAPTILER_KEY ??
  'get_your_own_key_VowEvALRr1YluFC6auJW';

// Transparent 1x1 PNG fallback in case of offline/network failure
const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * GET /api/v1/tiles/maptiler-omt?z={z}&x={x}&y={y}
 * Sirve la capa oficial MapTiler OMT (OpenMapTiles / OpenStreetMap style) en mosaicos de 256px.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const z = Number(searchParams.get('z') ?? '16');
  const x = Number(searchParams.get('x') ?? '0');
  const y = Number(searchParams.get('y') ?? '0');

  if (
    !Number.isInteger(z) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    z < 0 ||
    z > 22 ||
    x < 0 ||
    y < 0
  ) {
    return NextResponse.json({ error: 'Coordenadas de tesela inválidas' }, { status: 400 });
  }

  const upstreamUrl = `https://api.maptiler.com/maps/openstreetmap/256/${z}/${x}/${y}.png?key=${encodeURIComponent(
    DEFAULT_OSM_MAPTILER_KEY
  )}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        Referer: 'https://www.openstreetmap.org/',
        Origin: 'https://www.openstreetmap.org',
        Accept: 'image/webp,image/apng,image/png,image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      cache: 'force-cache',
    });

    if (upstreamRes.ok) {
      const arrayBuffer = await upstreamRes.arrayBuffer();
      return new Response(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'image/png',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }
  } catch {
    // Continuar al fallback si falla la red
  }

  const fallbackBuffer = Buffer.from(TRANSPARENT_PNG_BASE64, 'base64');
  return new Response(fallbackBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
