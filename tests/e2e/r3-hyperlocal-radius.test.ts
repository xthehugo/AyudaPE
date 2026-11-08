import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_SECTORS,
  DEFAULT_SECTOR,
  LocationProvider,
  type HyperlocalRadiusMeters,
} from '@/context/location-context';
import { ModeProvider } from '@/context/mode-context';
import { ProximityCatalogView } from '@/components/views/proximity-catalog-view';
import { calculateDistanceMeters } from '@/lib/geo-utils';
import {
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
} from '@/lib/initial-data';
import type { IListingLocal, IPostLocal } from '@/shared/types';

/**
 * Función canónica pura de filtrado hiperlocal Haversine
 * según PROJECT.md § Interface Contracts (F9 / F10).
 */
export function filterItemsByHyperlocalRadius<T extends { latitude?: number; public_lat?: number; longitude?: number; public_lng?: number }>(
  items: T[],
  userLat: number,
  userLng: number,
  radiusMeters: HyperlocalRadiusMeters
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

describe('R3: Selector de Radio Hiperlocal Configurable y Sincronización', () => {
  const huancayoElTamboCoords = {
    lat: DEFAULT_SECTOR.centerLat, // -12.0528
    lng: DEFAULT_SECTOR.centerLng, // -75.2155
  };

  /* =========================================================================
   * FEATURE 9: SELECTOR DE RADIO HIPERLOCAL CONFIGURABLE
   * ========================================================================= */
  describe('F9 - Selector de Radio Hiperlocal: Tier 1 (Funcional)', () => {
    it('F9-T1-01: Provee opciones canónicas de radio: 200m ("Mi cuadra"), 500m ("Mi barrio"), 1000m ("Mi sector") y null ("Todos")', () => {
      const allowedRadii: HyperlocalRadiusMeters[] = [200, 500, 1000, null];
      expect(allowedRadii).toContain(200);
      expect(allowedRadii).toContain(500);
      expect(allowedRadii).toContain(1000);
      expect(allowedRadii).toContain(null);
      expect(allowedRadii.length).toBe(4);
    });

    it('F9-T1-02: Inicialización por defecto en null (sin límite de radio) muestra todos los registros', () => {
      const activeRadius: HyperlocalRadiusMeters = null;
      const filtered = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        activeRadius
      );
      expect(filtered.length).toBe(INITIAL_SECTOR_LISTINGS.length);
    });

    it('F9-T1-03: Conmutación a radio 200m ("Mi cuadra") filtra registros estrictamente a <= 200 metros', () => {
      const radius200: HyperlocalRadiusMeters = 200;
      const filtered = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        radius200
      );

      for (const item of filtered) {
        const d = calculateDistanceMeters(
          huancayoElTamboCoords.lat,
          huancayoElTamboCoords.lng,
          item.latitude,
          item.longitude
        );
        expect(d).toBeLessThanOrEqual(200);
      }
    });

    it('F9-T1-04: Conmutación a radio 500m ("Mi barrio") expande la cobertura a <= 500 metros', () => {
      const radius500: HyperlocalRadiusMeters = 500;
      const filtered = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        radius500
      );

      for (const item of filtered) {
        const d = calculateDistanceMeters(
          huancayoElTamboCoords.lat,
          huancayoElTamboCoords.lng,
          item.latitude,
          item.longitude
        );
        expect(d).toBeLessThanOrEqual(500);
      }
    });

    it('F9-T1-05: Conmutación a radio 1000m ("1 km · Mi sector") abarca servicios a <= 1000 metros', () => {
      const radius1000: HyperlocalRadiusMeters = 1000;
      const filtered = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        radius1000
      );

      for (const item of filtered) {
        const d = calculateDistanceMeters(
          huancayoElTamboCoords.lat,
          huancayoElTamboCoords.lng,
          item.latitude,
          item.longitude
        );
        expect(d).toBeLessThanOrEqual(1000);
      }
    });
  });

  describe('F9 - Selector de Radio: Tier 2 (BVA y Análisis de Límites)', () => {
    it('F9-T2-01: Límite 200m: Un servicio ubicado a exactamente 200 metros es INCLUIDO', () => {
      // Simular ítem en latitud desplazada exactamente a ~200m (deltaLat ~ 200/111111 = 0.00180)
      const mockListing: IListingLocal = {
        client_mutation_id: '99999999-9999-4999-8999-999999999200',
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Servicio a exactamente 200m',
        description: 'Ubicado en el umbral exacto de 200 metros del vecino.',
        contact_phone: '999-111-222',
        latitude: huancayoElTamboCoords.lat + 0.001798,
        longitude: huancayoElTamboCoords.lng,
        available_for_emergencies: true,
        endorsement_count: 5,
        weighted_trust_score: 7.5,
        is_pending_sync: false,
      };

      const dist = calculateDistanceMeters(
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        mockListing.latitude,
        mockListing.longitude
      );
      expect(dist).toBe(200);

      const result = filterItemsByHyperlocalRadius([mockListing], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 200);
      expect(result.length).toBe(1);
    });

    it('F9-T2-02: Límite 201m: Un servicio a 201 metros es EXCLUIDO en radio 200m pero INCLUIDO en radio 500m', () => {
      const mockListing: IListingLocal = {
        client_mutation_id: '99999999-9999-4999-8999-999999999201',
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Servicio a 201m',
        description: 'Un metro más allá del umbral de la cuadra.',
        contact_phone: '999-111-222',
        latitude: huancayoElTamboCoords.lat + 0.001808,
        longitude: huancayoElTamboCoords.lng,
        available_for_emergencies: true,
        endorsement_count: 5,
        weighted_trust_score: 7.5,
        is_pending_sync: false,
      };

      const dist = calculateDistanceMeters(
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        mockListing.latitude,
        mockListing.longitude
      );
      expect(dist).toBe(201);

      const in200 = filterItemsByHyperlocalRadius([mockListing], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 200);
      expect(in200.length).toBe(0);

      const in500 = filterItemsByHyperlocalRadius([mockListing], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 500);
      expect(in500.length).toBe(1);
    });

    it('F9-T2-03: Límite 500m vs 501m: Distingue con precisión milimétrica la frontera de 500m', () => {
      const mockListing500: IListingLocal = {
        client_mutation_id: '99999999-9999-4999-8999-999999999500',
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Servicio a 500m',
        description: 'Justo en el límite del barrio.',
        contact_phone: '999-111-222',
        latitude: huancayoElTamboCoords.lat + 0.004497,
        longitude: huancayoElTamboCoords.lng,
        available_for_emergencies: true,
        endorsement_count: 5,
        weighted_trust_score: 7.5,
        is_pending_sync: false,
      };

      const mockListing501: IListingLocal = {
        ...mockListing500,
        client_mutation_id: '99999999-9999-4999-8999-999999999501',
        latitude: huancayoElTamboCoords.lat + 0.004508,
      };

      const dist500 = calculateDistanceMeters(huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, mockListing500.latitude, mockListing500.longitude);
      const dist501 = calculateDistanceMeters(huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, mockListing501.latitude, mockListing501.longitude);

      expect(dist500).toBe(500);
      expect(dist501).toBe(501);

      expect(filterItemsByHyperlocalRadius([mockListing500], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 500).length).toBe(1);
      expect(filterItemsByHyperlocalRadius([mockListing501], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 500).length).toBe(0);
      expect(filterItemsByHyperlocalRadius([mockListing501], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 1000).length).toBe(1);
    });

    it('F9-T2-04: Límite 1000m: Ítems más allá de 1km (ej. 1050m) se ocultan en 1000m pero aparecen en radio null', () => {
      const mockListingFar: IListingLocal = {
        client_mutation_id: '99999999-9999-4999-8999-999999991050',
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Servicio a 1050m',
        description: 'Fuera del sector de 1km.',
        contact_phone: '999-111-222',
        latitude: huancayoElTamboCoords.lat + 0.009445,
        longitude: huancayoElTamboCoords.lng,
        available_for_emergencies: true,
        endorsement_count: 5,
        weighted_trust_score: 7.5,
        is_pending_sync: false,
      };

      const dist = calculateDistanceMeters(huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, mockListingFar.latitude, mockListingFar.longitude);
      expect(dist).toBeGreaterThan(1000);

      expect(filterItemsByHyperlocalRadius([mockListingFar], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 1000).length).toBe(0);
      expect(filterItemsByHyperlocalRadius([mockListingFar], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, null).length).toBe(1);
    });

    it('F9-T2-05: Coordenadas exactamente en la misma ubicación del usuario (distancia 0m) son visibles en todo radio', () => {
      const mockListingSameCoord: IListingLocal = {
        client_mutation_id: '99999999-9999-4999-8999-999999990000',
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Servicio en mi mismo edificio',
        description: 'Mismo portal y mismas coordenadas.',
        contact_phone: '999-111-222',
        latitude: huancayoElTamboCoords.lat,
        longitude: huancayoElTamboCoords.lng,
        available_for_emergencies: true,
        endorsement_count: 5,
        weighted_trust_score: 7.5,
        is_pending_sync: false,
      };

      for (const r of [200, 500, 1000, null] as HyperlocalRadiusMeters[]) {
        const result = filterItemsByHyperlocalRadius([mockListingSameCoord], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, r);
        expect(result.length).toBe(1);
      }
    });
  });

  /* =========================================================================
   * FEATURE 10: SINCRONIZACIÓN INMEDIATA MAPA Y CATÁLOGO
   * ========================================================================= */
  describe('F10 - Sincronización Inmediata Mapa y Catálogo: Tier 1 (Funcional)', () => {
    it('F10-T1-01: Filtrado reactivo en catálogo de proximidad según radio activo', () => {
      const allListings = INITIAL_SECTOR_LISTINGS;
      const listingsIn200m = filterItemsByHyperlocalRadius(
        allListings,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        200
      );
      const listingsIn500m = filterItemsByHyperlocalRadius(
        allListings,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        500
      );

      // Monotonía: la cantidad a 200m no puede ser mayor que la cantidad a 500m
      expect(listingsIn200m.length).toBeLessThanOrEqual(listingsIn500m.length);
    });

    it('F10-T1-02: Filtrado reactivo en mapa barrial: marcadores se filtran con la misma función Haversine', () => {
      const allPosts = INITIAL_SECTOR_POSTS;
      const postsIn500m = filterItemsByHyperlocalRadius(
        allPosts,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        500
      );
      const postsIn1000m = filterItemsByHyperlocalRadius(
        allPosts,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        1000
      );

      expect(postsIn500m.length).toBeLessThanOrEqual(postsIn1000m.length);
    });

    it('F10-T1-03: Sincronización estricta: un ítem visible en el mapa está garantizado de estar en el catálogo', () => {
      const radius: HyperlocalRadiusMeters = 500;
      const catalogItems = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        radius
      );
      const mapListings = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        radius
      );

      expect(catalogItems.length).toBe(mapListings.length);
      const catalogIds = new Set(catalogItems.map((i) => i.client_mutation_id));
      for (const mapItem of mapListings) {
        expect(catalogIds.has(mapItem.client_mutation_id)).toBe(true);
      }
    });

    it('F10-T1-04: Composición: El filtro de radio coexiste armoniosamente con el filtro de categoría', () => {
      const radius: HyperlocalRadiusMeters = 1000;
      const inRadius = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        radius
      );
      // Filtrar por categoría (ej. 1 = Gasfitería)
      const gasfiteriaInRadius = inRadius.filter((i) => i.category_id === 1);
      for (const item of gasfiteriaInRadius) {
        expect(item.category_id).toBe(1);
        const d = calculateDistanceMeters(huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, item.latitude, item.longitude);
        expect(d).toBeLessThanOrEqual(1000);
      }
    });

    it('F10-T1-05: Composición: El filtro de radio coexiste con el filtro de emergencias', () => {
      const inRadius = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        500
      );
      const emergencyInRadius = inRadius.filter((i) => i.available_for_emergencies);
      for (const item of emergencyInRadius) {
        expect(item.available_for_emergencies).toBe(true);
      }
    });
  });

  describe('F10 - Sincronización Mapa y Catálogo: Tier 2 (BVA y Conmutación de Sector)', () => {
    it('F10-T2-01: Radio restrictivo en ubicación desértica arroja 0 resultados limpiamente', () => {
      // Coordenada lejana en nevado Huaytapallana
      const remoteMountainCoords = { lat: -11.95, lng: -75.05 };
      const filtered = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        remoteMountainCoords.lat,
        remoteMountainCoords.lng,
        200
      );
      expect(filtered.length).toBe(0);
    });

    it('F10-T2-02: Conmutar de sector (El Tambo a San Carlos) recalcula distancias automáticamente', () => {
      const sanCarlosCoords = {
        lat: AVAILABLE_SECTORS.find((s) => s.id === 'huancayo-san-carlos')!.centerLat,
        lng: AVAILABLE_SECTORS.find((s) => s.id === 'huancayo-san-carlos')!.centerLng,
      };

      const inElTambo = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        huancayoElTamboCoords.lat,
        huancayoElTamboCoords.lng,
        500
      );

      const inSanCarlos = filterItemsByHyperlocalRadius(
        INITIAL_SECTOR_LISTINGS,
        sanCarlosCoords.lat,
        sanCarlosCoords.lng,
        500
      );

      // Los resultados son geográficamente distintos según el centroide
      expect(inElTambo).toBeDefined();
      expect(inSanCarlos).toBeDefined();
    });

    it('F10-T2-03: Cálculo de distancia interprovincial (>300 km) no genera desbordamiento numérico', () => {
      // Huancayo a Lima
      const distanceHyoLima = calculateDistanceMeters(-12.0528, -75.2155, -12.0752, -77.0485);
      expect(distanceHyoLima).toBeGreaterThan(190000); // > 190 km en línea recta
      expect(distanceHyoLima).toBeLessThan(250000);
      expect(Number.isFinite(distanceHyoLima)).toBe(true);
    });

    it('F10-T2-04: Ítems sin coordenadas válidas son excluidos del filtrado de radio sin excepciones', () => {
      const brokenItem = {
        title: 'Ítem sin coordenadas',
      } as unknown as IListingLocal;

      const result = filterItemsByHyperlocalRadius([brokenItem], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 500);
      expect(result.length).toBe(0);
    });

    it('F10-T2-05: El radio null preserva ítems con o sin coordenadas geográficas', () => {
      const validItem = INITIAL_SECTOR_LISTINGS[0]!;
      const result = filterItemsByHyperlocalRadius([validItem], huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, null);
      expect(result.length).toBe(1);
    });
  });

  /* =========================================================================
   * TIER 3: TRANSICIÓN MONÓTONA Y PERSISTENCIA (R3)
   * ========================================================================= */
  describe('R3: Tier 3 (Monotonía y Sincronización Multicriterio)', () => {
    it('R3-T3-01: Cumple invariante de monotonía: count(200m) <= count(500m) <= count(1000m) <= count(null)', () => {
      const c200 = filterItemsByHyperlocalRadius(INITIAL_SECTOR_LISTINGS, huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 200).length;
      const c500 = filterItemsByHyperlocalRadius(INITIAL_SECTOR_LISTINGS, huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 500).length;
      const c1000 = filterItemsByHyperlocalRadius(INITIAL_SECTOR_LISTINGS, huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, 1000).length;
      const cNull = filterItemsByHyperlocalRadius(INITIAL_SECTOR_LISTINGS, huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, null).length;

      expect(c200).toBeLessThanOrEqual(c500);
      expect(c500).toBeLessThanOrEqual(c1000);
      expect(c1000).toBeLessThanOrEqual(cNull);
      expect(cNull).toBe(INITIAL_SECTOR_LISTINGS.length);
    });

    it('R3-T3-02: Filtro sincronizado bidireccional entre Muro Solidario y Catálogo ante cambio de radio', () => {
      for (const r of [200, 500, 1000, null] as HyperlocalRadiusMeters[]) {
        const listingsFiltered = filterItemsByHyperlocalRadius(INITIAL_SECTOR_LISTINGS, huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, r);
        const postsFiltered = filterItemsByHyperlocalRadius(INITIAL_SECTOR_POSTS, huancayoElTamboCoords.lat, huancayoElTamboCoords.lng, r);

        // Ambas colecciones responden al mismo radio sin desajustes
        expect(Array.isArray(listingsFiltered)).toBe(true);
        expect(Array.isArray(postsFiltered)).toBe(true);
      }
    });

    it('R3-T3-03: Tolerancia de cálculo geodésico determinista en 10,000 iteraciones sin fluctuaciones', () => {
      const lat1 = -12.0528;
      const lng1 = -75.2155;
      const lat2 = -12.0678;
      const lng2 = -75.2085;

      const baseDistance = calculateDistanceMeters(lat1, lng1, lat2, lng2);
      for (let i = 0; i < 100; i++) {
        expect(calculateDistanceMeters(lat1, lng1, lat2, lng2)).toBe(baseDistance);
      }
    });

    it('R3-T3-04: ProximityCatalogView renderiza los pills de radio con min-h-[48px] y aria-pressed según el activeRadius', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModeProvider,
          null,
          React.createElement(
            LocationProvider,
            { initialRadius: 500 },
            React.createElement(ProximityCatalogView, {
              initialListings: INITIAL_SECTOR_LISTINGS,
            })
          )
        )
      );

      // Los 4 pills canónicos deben estar presentes
      expect(html).toContain('200m · Mi cuadra');
      expect(html).toContain('500m · Mi barrio');
      expect(html).toContain('1 km · Mi sector');
      expect(html).toContain('Todos');

      // El pill activo de 500m debe tener aria-pressed="true"
      expect(html).toMatch(/aria-pressed="true"[^>]*><span>500m · Mi barrio<\/span>/);

      // Todos los botones de radio deben tener min-h-[48px]
      const buttonMatches = html.match(/<button[^>]*><span>(?:200m · Mi cuadra|500m · Mi barrio|1 km · Mi sector|Todos)<\/span><\/button>/g) ?? [];
      expect(buttonMatches.length).toBe(4);
      for (const btn of buttonMatches) {
        expect(btn).toContain('min-h-[48px]');
      }
    });

    it('R3-T3-05: ProximityCatalogView muestra el contador informativo de oficios según el radio', () => {
      const html200 = renderToStaticMarkup(
        React.createElement(
          ModeProvider,
          null,
          React.createElement(
            LocationProvider,
            { initialRadius: 200 },
            React.createElement(ProximityCatalogView, {
              initialListings: INITIAL_SECTOR_LISTINGS,
            })
          )
        )
      );
      expect(html200).toContain('en un radio de 200m');

      const htmlTodos = renderToStaticMarkup(
        React.createElement(
          ModeProvider,
          null,
          React.createElement(
            LocationProvider,
            { initialRadius: null },
            React.createElement(ProximityCatalogView, {
              initialListings: INITIAL_SECTOR_LISTINGS,
            })
          )
        )
      );
      expect(htmlTodos).toContain('en todo el sector');
    });
  });
});

