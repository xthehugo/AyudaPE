/**
 * @file src/lib/geo-utils.ts
 * @description Utilidades geodésicas unificadas para RedVecina:
 * - Cálculo de distancia Haversine en metros.
 * - Formato legible de distancias ("180 m", "1.4 km").
 * - Estimación de tiempo a pie (4.5 km/h).
 * - Difuminado espacial determinista de 50 metros para protección PII (Ley N° 29733 / RN-04).
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calcula la distancia geodésica en metros entre dos coordenadas geográficas
 * utilizando la fórmula del semiverseno (Haversine).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(Math.max(0, 1 - clampedA)));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Formatea una distancia en metros a un texto legible para vecinos y adultos mayores.
 * Ejemplo: 180 -> "180 m", 1400 -> "1.4 km".
 */
export function formatDistance(meters: number): string {
  if (meters == null || isNaN(meters) || meters < 0) {
    return '0 m';
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Estima el tiempo a pie en minutos para recorrer una distancia dada,
 * basado en una velocidad promedio de caminata urbana de 4.5 km/h (75 metros por minuto).
 */
export function estimateWalkingMinutes(meters: number): number {
  if (meters == null || isNaN(meters) || meters <= 0) {
    return 0;
  }
  // 4.5 km/h = 4500 m / 60 min = 75 m/min
  return Math.max(1, Math.round(meters / 75));
}

export interface SpatialBlurringResult {
  blurredLat: number;
  blurredLng: number;
  public_lat: number;
  public_lng: number;
  radiusMeters: 50;
}

/**
 * Aplica una perturbación espacial controlada y determinista a una coordenada exacta
 * dentro de un anillo de 35 a 49 metros (máximo 50 metros).
 * Protege la privacidad de pacientes y adultos mayores vulnerables en alertas SOS.
 */
export function applySpatialBlurring50m(
  lat: number,
  lng: number,
  seed: string = 'redvecina-spatial-seed'
): SpatialBlurringResult {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  // Perturbación determinista entre 35 y 49 metros (estrictamente <= 50m)
  const radiusMeters = 35 + (hash % 15);
  const angleRad = ((hash % 360) * Math.PI) / 180;

  // 1 grado de latitud equivale aprox a 111,111 metros
  const deltaLat = (radiusMeters * Math.cos(angleRad)) / 111111;
  const cosLat = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const deltaLng = (radiusMeters * Math.sin(angleRad)) / (111111 * cosLat);

  const blurredLat = Number((lat + deltaLat).toFixed(6));
  const blurredLng = Number((lng + deltaLng).toFixed(6));

  return {
    blurredLat,
    blurredLng,
    public_lat: blurredLat,
    public_lng: blurredLng,
    radiusMeters: 50,
  };
}

/**
 * Función canónica pura de filtrado hiperlocal Haversine
 * según PROJECT.md § Interface Contracts (F9 / F10).
 */
export function filterItemsByHyperlocalRadius<
  T extends { latitude?: number; public_lat?: number; longitude?: number; public_lng?: number }
>(
  items: T[],
  userLat: number,
  userLng: number,
  radiusMeters: 200 | 500 | 1000 | null
): T[] {
  if (radiusMeters === null) {
    return items;
  }

  return items.filter((item) => {
    const lat = item.latitude ?? item.public_lat;
    const lng = item.longitude ?? item.public_lng;
    if (lat === undefined || lng === undefined) return false;

    const distance = calculateDistanceMeters(userLat, userLng, lat, lng);
    return distance <= radiusMeters;
  });
}

interface KnownUrbanZone {
  lat: number;
  lng: number;
  radiusMeters: number;
  label: string;
  district: string;
}

const KNOWN_URBAN_ZONES: KnownUrbanZone[] = [
  {
    lat: -12.0752,
    lng: -77.0485,
    radiusMeters: 3500,
    label: 'Jr. Huiracocha · Jesús María (Lima)',
    district: 'Jesús María · Lima',
  },
  {
    lat: -12.048,
    lng: -75.195,
    radiusMeters: 1600,
    label: 'Sector Palián · Falla Huaytapallana',
    district: 'Huancayo',
  },
  {
    lat: -12.058,
    lng: -75.228,
    radiusMeters: 1600,
    label: 'Ribera Oeste · Cuenca del Mantaro',
    district: 'El Tambo',
  },
  {
    lat: -12.0528,
    lng: -75.2155,
    radiusMeters: 1200,
    label: 'Av. Mariscal Castilla · El Tambo',
    district: 'El Tambo',
  },
  {
    lat: -12.0625,
    lng: -75.2005,
    radiusMeters: 1200,
    label: 'Urb. San Carlos · Huancayo',
    district: 'Huancayo',
  },
  {
    lat: -12.0678,
    lng: -75.2085,
    radiusMeters: 1100,
    label: 'Parque Constitución · Huancayo Centro',
    district: 'Huancayo Centro',
  },
  {
    lat: -12.0765,
    lng: -75.2172,
    radiusMeters: 650,
    label: 'Av. Los Incas / Jr. Ica · Huancayo',
    district: 'Huancayo',
  },
  {
    lat: -12.0777,
    lng: -75.2137,
    radiusMeters: 650,
    label: 'Av. Ferrocarril / Jr. Tarapacá · Huancayo',
    district: 'Huancayo',
  },
  {
    lat: -12.0848,
    lng: -75.208,
    radiusMeters: 1500,
    label: 'Av. Próceres / Calle Real · Chilca',
    district: 'Chilca · Huancayo',
  },
  {
    lat: -12.1127,
    lng: -75.186,
    radiusMeters: 2200,
    label: 'Av. Ramón Castilla / Calle Real · Sector Sur',
    district: 'Huancayo Sur',
  },
];

const reverseGeocodeMemoryCache = new Map<string, string>();
const reverseGeocodeInflight = new Map<string, Promise<string | null>>();
const REVERSE_CACHE_STORAGE_KEY = 'redvecina_reverse_zone_cache_v2';

function readCachedZone(coordKey: string): string | null {
  if (reverseGeocodeMemoryCache.has(coordKey)) {
    return reverseGeocodeMemoryCache.get(coordKey)!;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REVERSE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed[coordKey]) {
      reverseGeocodeMemoryCache.set(coordKey, parsed[coordKey]);
      return parsed[coordKey];
    }
  } catch {
    // Ignorar
  }
  return null;
}

function writeCachedZone(coordKey: string, label: string): void {
  reverseGeocodeMemoryCache.set(coordKey, label);
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(REVERSE_CACHE_STORAGE_KEY);
    const parsed: Record<string, string> = raw ? JSON.parse(raw) : {};
    parsed[coordKey] = label;
    localStorage.setItem(REVERSE_CACHE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignorar
  }
}

/**
 * Extrae una calle o referencia explícita si el título o descripción del anuncio la menciona
 * (ej. "Jr. Huiracocha", "Av. Ferrocarril", "Jr. Sucre 640").
 */
function extractExplicitStreet(text: string): string | null {
  if (!text) return null;
  const match = text.match(
    /\b((?:Jr\.|Jirón|Av\.|Avenida|Calle|Pasaje|Psje\.|Urb\.|Urbanización|Parque|Mercado)\s+[A-ZÁÉÍÓÚÑa-záéíóúñ0-9]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ0-9]+){0,2})/i
  );
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Calcula de forma síncrona la zona aproximada real de un anuncio a partir de sus coordenadas
 * (`lat`, `lng`) y su texto descriptivo, evitando mostrar una calle fija incorrecta.
 */
export function resolveApproximateZoneLabel(
  lat?: number,
  lng?: number,
  title?: string,
  description?: string
): string {
  const validLat = typeof lat === 'number' && Number.isFinite(lat) ? lat : null;
  const validLng = typeof lng === 'number' && Number.isFinite(lng) ? lng : null;

  if (validLat !== null && validLng !== null) {
    const coordKey = `${validLat.toFixed(4)},${validLng.toFixed(4)}`;
    const cached = readCachedZone(coordKey);
    if (cached) {
      return cached;
    }
  }

  const combinedText = `${title ?? ''} ${description ?? ''}`;
  const explicitStreet = extractExplicitStreet(combinedText);

  if (validLat !== null && validLng !== null) {
    let closestZone: KnownUrbanZone | null = null;
    let minDistance = Infinity;

    for (const zone of KNOWN_URBAN_ZONES) {
      const d = calculateDistanceMeters(validLat, validLng, zone.lat, zone.lng);
      if (d < minDistance) {
        minDistance = d;
        closestZone = zone;
      }
    }

    if (explicitStreet && closestZone && minDistance <= 15000) {
      return `${explicitStreet} · ${closestZone.district}`;
    }

    if (closestZone && minDistance <= closestZone.radiusMeters) {
      return closestZone.label;
    }

    if (closestZone && minDistance <= 12000) {
      return `${closestZone.district} (Lat ${validLat.toFixed(4)}, Lng ${validLng.toFixed(4)})`;
    }

    if (validLng < -76.5) {
      return explicitStreet
        ? `${explicitStreet} · Lima`
        : `Lima Metropolitana (${validLat.toFixed(4)}, ${validLng.toFixed(4)})`;
    }

    return explicitStreet
      ? `${explicitStreet} · Huancayo`
      : `Huancayo (${validLat.toFixed(4)}, ${validLng.toFixed(4)})`;
  }

  if (explicitStreet) {
    return `${explicitStreet} · Huancayo`;
  }

  return 'Huancayo · Sector Barrial';
}

/**
 * Consulta en segundo plano la calle y barrio exactos en OpenStreetMap Nominatim
 * para una coordenada `(lat, lng)` y la guarda en caché local.
 */
export async function fetchReverseGeocodeZone(
  lat?: number,
  lng?: number
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = readCachedZone(coordKey);
  if (cached) return cached;

  if (reverseGeocodeInflight.has(coordKey)) {
    return reverseGeocodeInflight.get(coordKey)!;
  }

  const promise = (async (): Promise<string | null> => {
    try {
      const isBrowser = typeof window !== 'undefined';
      const url = isBrowser
        ? `/api/v1/geocoder/reverse?lat=${lat}&lng=${lng}`
        : `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&accept-language=es`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      const raw = await res.json();
      const data = (raw?.data?.place ?? raw) as {
        address?: {
          road?: string;
          pedestrian?: string;
          suburb?: string;
          neighbourhood?: string;
          city_district?: string;
          town?: string;
          city?: string;
          municipality?: string;
        };
        displayName?: string;
      };
      const addr = data?.address;
      if (!addr) return null;

      const street = addr.road || addr.pedestrian || addr.neighbourhood || addr.suburb;
      const district =
        addr.suburb ||
        addr.city_district ||
        addr.town ||
        addr.city ||
        addr.municipality ||
        'Huancayo';

      if (street && district && street.toLowerCase() !== district.toLowerCase()) {
        const formatted = `${street} · ${district}`;
        writeCachedZone(coordKey, formatted);
        return formatted;
      }
      if (street) {
        writeCachedZone(coordKey, street);
        return street;
      }
      return null;
    } catch {
      return null;
    } finally {
      reverseGeocodeInflight.delete(coordKey);
    }
  })();

  reverseGeocodeInflight.set(coordKey, promise);
  return promise;
}


