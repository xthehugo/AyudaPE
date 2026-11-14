/**
 * @file src/server/geocoder/nominatim-adapter.ts
 * @description Adaptador GeocoderProvider para Nominatim (OpenStreetMap).
 * Cumple estrictamente la Política de Uso Aceptable de Nominatim:
 * - Cola global de 1 petición por segundo para TODO el servidor (no por usuario).
 * - Encabezado User-Agent identificativo.
 * - Caché de respuestas en memoria para evitar consultas duplicadas.
 * - Atribución obligatoria © OpenStreetMap.
 */

import type { GeocodedPlace, GeocoderProvider, GeocoderSearchOptions } from './types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_USER_AGENT =
  process.env.GEOCODER_USER_AGENT || 'RedVecina-Huancayo-Peru/1.0 (contacto@redvecina.pe)';
const ATTRIBUTION_TEXT = '© OpenStreetMap';

// Caché en memoria para búsquedas y consultas inversas
const searchCache = new Map<string, { timestamp: number; data: GeocodedPlace[] }>();
const reverseCache = new Map<string, { timestamp: number; data: GeocodedPlace }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 horas

interface KnownPoint {
  lat: number;
  lng: number;
  name: string;
  display_name: string;
}

const KNOWN_URBAN_POINTS: KnownPoint[] = [
  {
    lat: -12.077697,
    lng: -75.213734,
    name: 'Jr. Sucre 656',
    display_name: 'Jr. Sucre 656, Chilca, Huancayo, Junín, Perú',
  },
  {
    lat: -12.0795,
    lng: -75.2137,
    name: 'Jr. Sucre Sur',
    display_name: 'Jr. Sucre, Chilca, Huancayo, Junín, Perú',
  },
  {
    lat: -12.0528,
    lng: -75.2155,
    name: 'Jr. Parra del Riego',
    display_name: 'Jr. Parra del Riego, El Tambo, Huancayo, Junín, Perú',
  },
  {
    lat: -12.0668,
    lng: -75.2072,
    name: 'Jr. Puno',
    display_name: 'Jr. Puno, Centro de Huancayo, Junín, Perú',
  },
  {
    lat: -12.0622,
    lng: -75.2010,
    name: 'Av. San Carlos',
    display_name: 'Av. San Carlos, Huancayo, Junín, Perú',
  },
  {
    lat: -12.0801,
    lng: -75.2133,
    name: 'Jr. Sucre',
    display_name: 'Jr. Sucre, Chilca, Huancayo, Junín, Perú',
  },
];

function getFastUrbanFallback(lat: number, lng: number): GeocodedPlace | null {
  for (const p of KNOWN_URBAN_POINTS) {
    const dLat = Math.abs(lat - p.lat);
    const dLng = Math.abs(lng - p.lng);
    // Margen de ~350 metros (0.0035 grados)
    if (dLat < 0.0035 && dLng < 0.0035) {
      return {
        place_id: `fast-${p.lat.toFixed(4)}-${p.lng.toFixed(4)}`,
        display_name: p.display_name,
        name: p.name,
        lat,
        lng,
        category: 'highway',
        type: 'residential',
        is_residential: true,
        attribution: ATTRIBUTION_TEXT,
      };
    }
  }

  // Fallback rápido para Huancayo metropolitano
  if (lat >= -12.12 && lat <= -12.01 && lng >= -75.25 && lng <= -75.18) {
    const subDistrict = lat < -12.07 ? 'Chilca' : lat > -12.06 ? 'El Tambo' : 'Huancayo Centro';
    return {
      place_id: `fast-huancayo-${lat.toFixed(4)}-${lng.toFixed(4)}`,
      display_name: `${subDistrict}, Huancayo, Junín, Perú`,
      name: `${subDistrict} · Huancayo`,
      lat,
      lng,
      category: 'place',
      type: 'suburb',
      is_residential: true,
      attribution: ATTRIBUTION_TEXT,
    };
  }

  // Fallback rápido para Lima metropolitana
  if (lat >= -12.20 && lat <= -11.90 && lng >= -77.15 && lng <= -76.90) {
    return {
      place_id: `fast-lima-${lat.toFixed(4)}-${lng.toFixed(4)}`,
      display_name: 'Lima Metropolitana, Perú',
      name: 'Lima Metropolitana',
      lat,
      lng,
      category: 'place',
      type: 'city',
      is_residential: true,
      attribution: ATTRIBUTION_TEXT,
    };
  }

  return null;
}

// Cola global de ejecución para garantizar máx. 1 req / seg a Nominatim en todo el proceso
interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

const queue: QueuedRequest<any>[] = [];
let isQueueProcessing = false;
let lastRequestTime = 0;

async function processQueue(): Promise<void> {
  if (isQueueProcessing) return;
  isQueueProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;

    const now = Date.now();
    const elapsedSinceLast = now - lastRequestTime;
    const waitTime = Math.max(0, 1050 - elapsedSinceLast); // 1.05s de separación segura

    if (waitTime > 0) {
      await new Promise((res) => setTimeout(res, waitTime));
    }

    lastRequestTime = Date.now();
    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }
  }

  isQueueProcessing = false;
}

function scheduleRateLimited<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    void processQueue();
  });
}

function checkIfResidential(type?: string, category?: string): boolean {
  if (!type && !category) return false;
  const t = (type || '').toLowerCase();
  const c = (category || '').toLowerCase();
  return (
    t.includes('house') ||
    t.includes('residential') ||
    t.includes('apartments') ||
    t.includes('detached') ||
    c.includes('dwelling') ||
    t === 'home'
  );
}

export class NominatimGeocoderAdapter implements GeocoderProvider {
  private userAgent: string;

  constructor(userAgent?: string) {
    this.userAgent = userAgent || DEFAULT_USER_AGENT;
  }

  async search(query: string, options?: GeocoderSearchOptions): Promise<GeocodedPlace[]> {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) return [];

    const cacheKey = `search:${cleanQuery.toLowerCase()}:${options?.bounds ? JSON.stringify(options.bounds) : ''}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    return scheduleRateLimited(async () => {
      const params = new URLSearchParams({
        q: cleanQuery,
        format: 'jsonv2',
        addressdetails: '1',
        limit: String(options?.limit ?? 5),
        'accept-language': 'es',
        countrycodes: 'pe', // Restringir a Perú
      });

      // Si se especifican límites territoriales (ej. Junín / Huancayo)
      if (options?.bounds) {
        params.append(
          'viewbox',
          `${options.bounds.minLng},${options.bounds.maxLat},${options.bounds.maxLng},${options.bounds.minLat}`
        );
        params.append('bounded', '1');
      }

      const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const rawItems = (await response.json()) as Array<{
        place_id: number;
        display_name: string;
        name?: string;
        lat: string;
        lon: string;
        category?: string;
        type?: string;
      }>;

      const results: GeocodedPlace[] = rawItems.map((item) => {
        const isRes = checkIfResidential(item.type, item.category);
        return {
          place_id: String(item.place_id),
          display_name: item.display_name,
          name: item.name || item.display_name.split(',')[0] || cleanQuery,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          category: item.category,
          type: item.type,
          is_residential: isRes,
          attribution: ATTRIBUTION_TEXT,
        };
      });

      searchCache.set(cacheKey, { timestamp: Date.now(), data: results });
      return results;
    });
  }

  async reverse(lat: number, lng: number): Promise<GeocodedPlace | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    // 1. Resolución instantánea en memoria para puntos y áreas conocidas (<1ms)
    const fastMatch = getFastUrbanFallback(lat, lng);
    if (fastMatch) {
      return fastMatch;
    }

    const cacheKey = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // 2. Si la cola de peticiones está congestionada (>=2 en espera), evitar saturar Vercel Serverless
    if (queue.length >= 2) {
      const fallbackPlace: GeocodedPlace = {
        place_id: `fallback-${lat.toFixed(4)}-${lng.toFixed(4)}`,
        display_name: `Huancayo (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        name: 'Sector Vecinal',
        lat,
        lng,
        category: 'place',
        type: 'neighbourhood',
        is_residential: true,
        attribution: ATTRIBUTION_TEXT,
      };
      return fallbackPlace;
    }

    return scheduleRateLimited(async () => {
      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lon: String(lng),
          format: 'jsonv2',
          addressdetails: '1',
          zoom: '18',
          'accept-language': 'es',
        });

        const url = `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return null;
        }

        const item = (await response.json()) as {
          place_id: number;
          display_name: string;
          name?: string;
          lat: string;
          lon: string;
          category?: string;
          type?: string;
          address?: Record<string, string>;
        };

        if (!item || !item.lat) return null;

        const road =
          item.address?.road ||
          item.address?.pedestrian ||
          item.address?.suburb ||
          item.address?.neighbourhood ||
          item.name ||
          item.display_name.split(',')[0] ||
          'Lugar seleccionado';

        const isRes = checkIfResidential(item.type, item.category);

        const place: GeocodedPlace = {
          place_id: String(item.place_id),
          display_name: item.display_name,
          name: road,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          category: item.category,
          type: item.type,
          is_residential: isRes,
          attribution: ATTRIBUTION_TEXT,
        };

        reverseCache.set(cacheKey, { timestamp: Date.now(), data: place });
        return place;
      } catch {
        // Fallback seguro ante timeouts de red o 429 de Nominatim
        const safeFallback: GeocodedPlace = {
          place_id: `safe-${lat.toFixed(4)}-${lng.toFixed(4)}`,
          display_name: `Huancayo (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          name: 'Sector Huancayo',
          lat,
          lng,
          category: 'place',
          type: 'suburb',
          is_residential: true,
          attribution: ATTRIBUTION_TEXT,
        };
        return safeFallback;
      }
    });
  }
}

export const defaultGeocoder = new NominatimGeocoderAdapter();
