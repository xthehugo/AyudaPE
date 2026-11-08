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

    const cacheKey = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    return scheduleRateLimited(async () => {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'jsonv2',
        addressdetails: '1',
        zoom: '18',
        'accept-language': 'es',
      });

      const url = `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

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
    });
  }
}

export const defaultGeocoder = new NominatimGeocoderAdapter();
