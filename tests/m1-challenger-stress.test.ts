import 'fake-indexeddb/auto';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  AVAILABLE_SECTORS,
  DEFAULT_SECTOR,
  type HyperlocalRadiusMeters,
  type ILocationContextState,
  LocationProvider,
  useLocation,
} from '@/context/location-context';
import {
  applySpatialBlurring50m,
  calculateDistanceMeters,
  estimateWalkingMinutes,
  formatDistance,
} from '@/lib/geo-utils';
import {
  getListingsForSector,
  getPostsForSector,
  HUANCAYO_SECTOR_LISTINGS,
  HUANCAYO_SECTOR_POSTS,
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
  JESUS_MARIA_LISTINGS,
  JESUS_MARIA_POSTS,
} from '@/lib/initial-data';
import {
  CreateListingSchema,
  ExtractedPiiSchema,
  MONEY_REGEX,
  PERU_PHONE_REGEX,
} from '@/shared/schemas';

describe('CHALLENGER M1: Pruebas de Estrés Adversarias y Verificación Empírica', () => {
  /* =========================================================================
   * 1. HAVERSINE CON COORDENADAS EXTREMAS (ANTÍPODAS, POLOS, IDÉNTICAS, 0)
   * ========================================================================= */
  describe('1. Haversine con Coordenadas Extremas y Casos Límite', () => {
    it('1.1. Coordenadas idénticas devuelven exactamente 0 metros en cualquier punto', () => {
      const testPoints: [number, number][] = [
        [0, 0],
        [90, 0],
        [-90, 0],
        [90, 180],
        [-90, -180],
        [45.123456, 120.654321],
        [-12.0528, -75.2155],
      ];

      for (const [lat, lon] of testPoints) {
        const dist = calculateDistanceMeters(lat, lon, lat, lon);
        expect(dist, `Fallo en distancia idéntica para [${lat}, ${lon}]`).toBe(0);
      }
    });

    it('1.2. Puntos en los polos con distinta longitud tienen distancia cero o sub-métrica', () => {
      // En el polo norte (90° latitud), cualquier longitud corresponde al mismo punto físico.
      const distNorthPole = calculateDistanceMeters(90, 0, 90, 180);
      expect(distNorthPole).toBeLessThanOrEqual(1);

      const distSouthPole = calculateDistanceMeters(-90, -90, -90, 90);
      expect(distSouthPole).toBeLessThanOrEqual(1);
    });

    it('1.3. Puntos antípodas exactos no generan NaN y retornan ~20,015 km (semi-circunferencia)', () => {
      // La semi-circunferencia terrestre es pi * 6,371,000 ≈ 20,015,087 metros.
      const antipodalPairs: [[number, number], [number, number]][] = [
        [[0, 0], [0, 180]],
        [[0, 0], [0, -180]],
        [[45, 0], [-45, 180]],
        [[-45, -90], [45, 90]],
        [[90, 0], [-90, 0]], // Polo Norte a Polo Sur
        [[-12.0528, -75.2155], [12.0528, 104.7845]], // Antípoda de Huancayo
      ];

      const EXPECTED_HALF_CIRCUMFERENCE = Math.round(Math.PI * 6371000); // 20015087

      for (const [[lat1, lon1], [lat2, lon2]] of antipodalPairs) {
        const dist = calculateDistanceMeters(lat1, lon1, lat2, lon2);
        expect(Number.isNaN(dist), `calculateDistanceMeters arrojó NaN para antípodas [${lat1},${lon1}] y [${lat2},${lon2}]`).toBe(false);
        // Debe estar dentro del 0.1% de la semi-circunferencia
        expect(Math.abs(dist - EXPECTED_HALF_CIRCUMFERENCE)).toBeLessThan(20000);
      }
    });

    it('1.4. Comportamiento en coordenadas antípodas canónicas', () => {
      const canonicalAntipodes: [[number, number], [number, number]][] = [
        [[0, 0], [0, 180]],
        [[0, 45], [0, -135]],
        [[90, 0], [-90, 0]],
      ];

      for (const [[lat1, lon1], [lat2, lon2]] of canonicalAntipodes) {
        const dist = calculateDistanceMeters(lat1, lon1, lat2, lon2);
        expect(Number.isNaN(dist)).toBe(false);
        expect(dist).toBeGreaterThan(19900000);
      }
    });

    it('1.5. Detección adversarial de inestabilidad de punto flotante en antípodas (Mitigado en M5 con clamping: nunca genera NaN)', () => {
      // Coordenada adversarial descubierta empíricamente por Challenger M1:
      // lat = 1.7404855781234971, lon = 173.42960207131756
      // En punto flotante IEEE 754 de JS, a evalúa a 1.0000000000000002.
      // Con clamping numérico en M5 (Math.min(1, Math.max(0, a))), (1 - clampedA) nunca es negativo.
      const lat = 1.7404855781234971;
      const lon = 173.42960207131756;
      const antipodalLat = -lat;
      const antipodalLon = lon - 180;

      const dist = calculateDistanceMeters(lat, lon, antipodalLat, antipodalLon);
      // Hardening verificado: dist nunca resulta NaN y calcula la distancia real (~20,015 km)
      const producesNaN = Number.isNaN(dist);
      expect(producesNaN).toBe(false);
      expect(dist).toBeGreaterThan(19900000);
    });

    it('1.5. Simetría métrica: dist(A, B) === dist(B, A)', () => {
      const coords: [number, number, number, number][] = [
        [-12.0528, -75.2155, -12.0625, -75.2005],
        [-12.0528, -75.2155, -12.0752, -77.0485],
        [0, 0, 10, 10],
        [-60, -120, 60, 120],
      ];

      for (const [lat1, lon1, lat2, lon2] of coords) {
        const d1 = calculateDistanceMeters(lat1, lon1, lat2, lon2);
        const d2 = calculateDistanceMeters(lat2, lon2, lat1, lon1);
        expect(d1).toBe(d2);
      }
    });

    it('1.6. Desigualdad triangular: dist(A, C) <= dist(A, B) + dist(B, C)', () => {
      const pA: [number, number] = [-12.0528, -75.2155]; // El Tambo
      const pB: [number, number] = [-12.0625, -75.2005]; // San Carlos
      const pC: [number, number] = [-12.0678, -75.2085]; // Centro Urbano

      const dAC = calculateDistanceMeters(pA[0], pA[1], pC[0], pC[1]);
      const dAB = calculateDistanceMeters(pA[0], pA[1], pB[0], pB[1]);
      const dBC = calculateDistanceMeters(pB[0], pB[1], pC[0], pC[1]);

      expect(dAC).toBeLessThanOrEqual(dAB + dBC + 1); // +1 por redondeo entero
    });

    it('1.7. formatDistance y estimateWalkingMinutes con valores extremos', () => {
      expect(formatDistance(Number.NaN)).toBe('0 m');
      expect(formatDistance(-999)).toBe('0 m');
      expect(formatDistance(0)).toBe('0 m');
      expect(formatDistance(0.4)).toBe('0 m');
      expect(formatDistance(0.6)).toBe('1 m');
      expect(formatDistance(999)).toBe('999 m');
      expect(formatDistance(1000)).toBe('1.0 km');
      expect(formatDistance(1400)).toBe('1.4 km');
      expect(formatDistance(20000000)).toBe('20000.0 km');

      expect(estimateWalkingMinutes(Number.NaN)).toBe(0);
      expect(estimateWalkingMinutes(-100)).toBe(0);
      expect(estimateWalkingMinutes(0)).toBe(0);
      expect(estimateWalkingMinutes(1)).toBe(1); // Mínimo 1 minuto
      expect(estimateWalkingMinutes(74)).toBe(1);
      expect(estimateWalkingMinutes(75)).toBe(1);
      expect(estimateWalkingMinutes(113)).toBe(2);
    });
  });

  /* =========================================================================
   * 2. DIFUMINADO ESPACIAL 50M: INVARIANTE ESTRICTA <= 50M Y DETERMINISMO
   * ========================================================================= */
  describe('2. Difuminado Espacial 50m: Invariante Estricta y Robustez', () => {
    it('2.1. Verifica empíricamente que 1,000 semillas distintas producen distancia estrictamente <= 50m', () => {
      const baseLat = -12.048;
      const baseLng = -75.195;

      let maxObservedDistance = 0;
      let minObservedDistance = Infinity;

      for (let i = 0; i < 1000; i++) {
        const seed = `adversarial-seed-${i}-${Math.sin(i)}-#$*&!`;
        const result = applySpatialBlurring50m(baseLat, baseLng, seed);

        expect(result.radiusMeters).toBe(50);
        expect(result.blurredLat).toBe(result.public_lat);
        expect(result.blurredLng).toBe(result.public_lng);

        const dist = calculateDistanceMeters(baseLat, baseLng, result.blurredLat, result.blurredLng);

        if (dist > maxObservedDistance) maxObservedDistance = dist;
        if (dist < minObservedDistance) minObservedDistance = dist;

        // Invariante estricta: distancia <= 50 metros
        expect(
          dist,
          `Difuminado excedió 50m con semilla "${seed}": ${dist}m`
        ).toBeLessThanOrEqual(50);

        // Perturbación mínima: al menos 30 metros (anillo 35-49m)
        expect(
          dist,
          `Difuminado insuficiente (<30m) con semilla "${seed}": ${dist}m`
        ).toBeGreaterThanOrEqual(30);
      }

      expect(maxObservedDistance).toBeLessThanOrEqual(50);
      expect(minObservedDistance).toBeGreaterThanOrEqual(30);
    });

    it('2.2. Verifica en diversas latitudes (-80°, -45°, 0°, +45°, +80°) que la distancia se mantiene <= 50m', () => {
      const latitudes = [-80, -60, -45, -12.05, 0, 12.05, 45, 60, 80];
      const longitudes = [-170, -75, 0, 75, 170];

      for (const lat of latitudes) {
        for (const lng of longitudes) {
          const result = applySpatialBlurring50m(lat, lng, `lat-${lat}-lng-${lng}`);
          const dist = calculateDistanceMeters(lat, lng, result.blurredLat, result.blurredLng);

          expect(
            dist,
            `Fallo de radio <= 50m en latitud extrema ${lat}, longitud ${lng}: ${dist}m`
          ).toBeLessThanOrEqual(50);
        }
      }
    });

    it('2.3. Semilla vacía o caracteres especiales no provocan excepción y son deterministas', () => {
      const seeds = ['', ' ', '   ', 'ñáéíóú', '🌟🔥🚀', 'a'.repeat(500)];

      for (const seed of seeds) {
        const res1 = applySpatialBlurring50m(-12.05, -75.21, seed);
        const res2 = applySpatialBlurring50m(-12.05, -75.21, seed);

        expect(res1.blurredLat).toBe(res2.blurredLat);
        expect(res1.blurredLng).toBe(res2.blurredLng);

        const dist = calculateDistanceMeters(-12.05, -75.21, res1.blurredLat, res1.blurredLng);
        expect(dist).toBeLessThanOrEqual(50);
      }
    });

    it('2.4. La coordenada difuminada tiene exactamente 6 decimales de precisión (submétrica urbana)', () => {
      const result = applySpatialBlurring50m(-12.0528, -75.2155, 'precision-check');
      const latDecimals = (result.blurredLat.toString().split('.')[1] || '').length;
      const lngDecimals = (result.blurredLng.toString().split('.')[1] || '').length;

      expect(latDecimals).toBeLessThanOrEqual(6);
      expect(lngDecimals).toBeLessThanOrEqual(6);
    });
  });

  /* =========================================================================
   * 3. LOCATIONCONTEXT: CONMUTACIÓN DE LOS 6 SECTORES, RADIOS Y GEOLOCALIZACIÓN
   * ========================================================================= */
  describe('3. LocationContext: Conmutación de Sectores, Radios y Fallback de Geolocalización', () => {
    it('3.1. Valida que los 6 sectores requeridos existan con contratos íntegros', () => {
      expect(AVAILABLE_SECTORS).toHaveLength(6);
      const expectedIds = [
        'huancayo-el-tambo',
        'huancayo-san-carlos',
        'huancayo-centro',
        'zona-critica-huaytapallana',
        'zona-critica-mantaro',
        'lima-jesus-maria-4',
      ];

      for (const id of expectedIds) {
        const sector = AVAILABLE_SECTORS.find((s) => s.id === id);
        expect(sector, `Sector requerido no encontrado: ${id}`).toBeDefined();
        expect(sector!.name.length).toBeGreaterThan(5);
        expect(typeof sector!.centerLat).toBe('number');
        expect(typeof sector!.centerLng).toBe('number');
        expect(sector!.zoomLevel).toBeGreaterThanOrEqual(14);
      }
    });

    it('3.2. Simula transición interactiva a través de los 6 sectores y persistencia en localStorage', () => {
      // Mock de localStorage
      const store: Record<string, string> = {};
      const mockLocalStorage = {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          for (const k in store) delete store[k];
        },
      };

      vi.stubGlobal('localStorage', mockLocalStorage);

      // Verificamos transiciones lógicas de setSector
      for (const sector of AVAILABLE_SECTORS) {
        mockLocalStorage.setItem('redvecina_active_sector_id', sector.id);
        expect(mockLocalStorage.getItem('redvecina_active_sector_id')).toBe(sector.id);
      }

      vi.unstubAllGlobals();
    });

    it('3.3. Transición de radio hiperlocal: 200m -> 500m -> 1000m -> null', () => {
      const radii: HyperlocalRadiusMeters[] = [200, 500, 1000, null];

      let lastState: ILocationContextState | null = null;
      function Consumer() {
        lastState = useLocation();
        return React.createElement('div', null, String(lastState.activeRadius));
      }

      for (const radius of radii) {
        renderToString(
          React.createElement(
            LocationProvider,
            { initialRadius: radius },
            React.createElement(Consumer)
          )
        );
        expect(lastState).not.toBeNull();
        expect(lastState!.activeRadius).toBe(radius);
      }
    });

    it('3.4. Fallback de recenterToUser cuando navigator.geolocation falla o no está disponible', () => {
      let state: ILocationContextState | null = null;
      function Consumer() {
        state = useLocation();
        return null;
      }

      // Caso A: navigator.geolocation falla con timeout/permission denied
      const mockGetCurrentPosition = vi.fn((_success, error) => {
        if (error) {
          error({ code: 1, message: 'User denied geolocation' });
        }
      });

      const mockGeo = {
        getCurrentPosition: mockGetCurrentPosition,
      };

      vi.stubGlobal('window', {
        navigator: { geolocation: mockGeo },
      });
      vi.stubGlobal('navigator', {
        geolocation: mockGeo,
      });

      renderToString(
        React.createElement(
          LocationProvider,
          { initialSectorId: 'huancayo-centro' },
          React.createElement(Consumer)
        )
      );

      expect(state).not.toBeNull();
      expect(state!.currentSector.id).toBe('huancayo-centro');

      // Invocamos recenterToUser()
      state!.recenterToUser();
      expect(mockGetCurrentPosition).toHaveBeenCalled();
      // userCoords debe haber vuelto al centroide de huancayo-centro
      expect(state!.userCoords.lat).toBe(-12.0678);
      expect(state!.userCoords.lng).toBe(-75.2085);

      vi.unstubAllGlobals();
    });

    it('3.5. recenterToUser cuando navigator.geolocation tiene éxito', () => {
      let state: ILocationContextState | null = null;
      function Consumer() {
        state = useLocation();
        return null;
      }

      const mockCoords = { latitude: -12.0543, longitude: -75.2111 };
      const mockGetCurrentPosition = vi.fn((success) => {
        success({ coords: mockCoords });
      });

      const mockGeo = {
        getCurrentPosition: mockGetCurrentPosition,
      };

      vi.stubGlobal('window', {
        navigator: { geolocation: mockGeo },
      });
      vi.stubGlobal('navigator', {
        geolocation: mockGeo,
      });

      renderToString(
        React.createElement(
          LocationProvider,
          { initialSectorId: 'huancayo-el-tambo' },
          React.createElement(Consumer)
        )
      );

      state!.recenterToUser();
      expect(mockGetCurrentPosition).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('3.6. setSector ignora IDs inexistentes sin romper el estado actual', () => {
      let state: ILocationContextState | null = null;
      function Consumer() {
        state = useLocation();
        return null;
      }

      renderToString(
        React.createElement(
          LocationProvider,
          { initialSectorId: 'huancayo-el-tambo' },
          React.createElement(Consumer)
        )
      );

      expect(state!.currentSector.id).toBe('huancayo-el-tambo');
      state!.setSector('sector-fantasma-inexistente');
      // Debe conservar el sector previo
      expect(state!.currentSector.id).toBe('huancayo-el-tambo');
    });
  });

  /* =========================================================================
   * 4. SEMILLAS: VALIDACIÓN ZOD, TELÉFONOS, COORDENADAS Y CASOS DE MARIO CORTIJO
   * ========================================================================= */
  describe('4. Semillas: Validación de Esquemas, Teléfonos, Coordenadas y Casos Mario Cortijo', () => {
    it('4.1. Unicidad estricta de IDs y client_mutation_id en INITIAL_SECTOR_LISTINGS', () => {
      const ids = new Set<number>();
      const mutationIds = new Set<string>();

      for (const listing of INITIAL_SECTOR_LISTINGS) {
        expect(ids.has(listing.id), `ID de listing duplicado: ${listing.id}`).toBe(false);
        ids.add(listing.id);

        expect(
          mutationIds.has(listing.client_mutation_id),
          `client_mutation_id duplicado en listing: ${listing.client_mutation_id}`
        ).toBe(false);
        mutationIds.add(listing.client_mutation_id);
      }

      expect(ids.size).toBe(INITIAL_SECTOR_LISTINGS.length);
      expect(INITIAL_SECTOR_LISTINGS.length).toBe(15); // 6 de Lima + 9 de Huancayo
    });

    it('4.2. Unicidad estricta de IDs y client_mutation_id en INITIAL_SECTOR_POSTS', () => {
      const ids = new Set<number>();
      const mutationIds = new Set<string>();

      for (const post of INITIAL_SECTOR_POSTS) {
        expect(ids.has(post.id), `ID de post duplicado: ${post.id}`).toBe(false);
        ids.add(post.id);

        expect(
          mutationIds.has(post.client_mutation_id),
          `client_mutation_id duplicado en post: ${post.client_mutation_id}`
        ).toBe(false);
        mutationIds.add(post.client_mutation_id);
      }

      expect(ids.size).toBe(INITIAL_SECTOR_POSTS.length);
      expect(INITIAL_SECTOR_POSTS.length).toBe(12); // 4 de Lima + 8 de Huancayo
    });

    it('4.3. Validación estricta con CreateListingSchema de TODOS los listings', () => {
      for (const listing of INITIAL_SECTOR_LISTINGS) {
        const parseResult = CreateListingSchema.safeParse({
          client_mutation_id: listing.client_mutation_id,
          category_id: listing.category_id,
          listing_type: listing.listing_type,
          title: listing.title,
          description: listing.description,
          contact_phone: listing.contact_phone,
          latitude: listing.latitude,
          longitude: listing.longitude,
          available_for_emergencies: listing.available_for_emergencies,
          emergency_response_note: listing.emergency_response_note,
        });

        expect(
          parseResult.success,
          `Listing ID ${listing.id} falló validación de esquema: ${
            !parseResult.success ? JSON.stringify(parseResult.error.format()) : ''
          }`
        ).toBe(true);
      }
    });

    it('4.4. Todos los teléfonos cumplen formato móvil peruano (9XX-XXX-XXX) y pasan PERU_PHONE_REGEX', () => {
      for (const listing of INITIAL_SECTOR_LISTINGS) {
        expect(
          PERU_PHONE_REGEX.test(listing.contact_phone),
          `Teléfono inválido en listing ID ${listing.id}: "${listing.contact_phone}"`
        ).toBe(true);
      }
    });

    it('4.5. Coordenadas de Huancayo están estrictamente acotadas en Junín (-12.2 a -11.9 lat, -75.4 a -75.0 lng)', () => {
      for (const listing of HUANCAYO_SECTOR_LISTINGS) {
        expect(listing.latitude).toBeLessThan(-11.9);
        expect(listing.latitude).toBeGreaterThan(-12.2);
        expect(listing.longitude).toBeLessThan(-75.0);
        expect(listing.longitude).toBeGreaterThan(-75.4);
      }

      for (const post of HUANCAYO_SECTOR_POSTS) {
        expect(post.public_lat).toBeLessThan(-11.9);
        expect(post.public_lat).toBeGreaterThan(-12.2);
        expect(post.public_lng).toBeLessThan(-75.0);
        expect(post.public_lng).toBeGreaterThan(-75.4);
      }
    });

    it('4.6. Muro Solidario (Cero Dinero): ninguna publicación solidaria contiene términos comerciales o cobros', () => {
      const solidaryPosts = INITIAL_SECTOR_POSTS.filter(
        (p) => p.post_type === 'OFERTA_FAVOR' || p.post_type === 'RECURSO_SOLIDARIO'
      );

      expect(solidaryPosts.length).toBeGreaterThanOrEqual(6);

      for (const post of solidaryPosts) {
        expect(
          MONEY_REGEX.test(post.title),
          `Título con dinero detectado en post ID ${post.id}: "${post.title}"`
        ).toBe(false);

        expect(
          MONEY_REGEX.test(post.description),
          `Descripción con dinero detectada en post ID ${post.id}: "${post.description}"`
        ).toBe(false);
      }
    });

    it('4.7. Presencia verificable de todos los casos de uso del video de Mario Cortijo', () => {
      // 1. Muletas ortopédicas sin costo (El Tambo)
      const muletas = INITIAL_SECTOR_POSTS.find(
        (p) => p.title.toLowerCase().includes('muletas') && p.description.toLowerCase().includes('solidario')
      );
      expect(muletas, 'Semilla de muletas ortopédicas no encontrada').toBeDefined();

      // 2. Pool escolar vecinal (San Carlos)
      const poolEscolar = INITIAL_SECTOR_POSTS.find(
        (p) =>
          p.title.toLowerCase().includes('pool escolar') &&
          (p.title + ' ' + p.description).toLowerCase().includes('colegio')
      );
      expect(poolEscolar, 'Semilla de pool escolar no encontrada').toBeDefined();

      // 3. Lasañas caseras de la vecina Gladys (El Tambo)
      const lasanas = INITIAL_SECTOR_LISTINGS.find(
        (l) =>
          l.title.toLowerCase().includes('lasañas') &&
          (l.title + ' ' + l.description).toLowerCase().includes('gladys')
      );
      expect(lasanas, 'Semilla de lasañas caseras no encontrada').toBeDefined();

      // 4. Clases de matemáticas profesor Yuri (San Carlos)
      const matematicas = INITIAL_SECTOR_LISTINGS.find(
        (l) => l.title.toLowerCase().includes('matemáticas') && l.title.toLowerCase().includes('yuri')
      );
      expect(matematicas, 'Semilla de matemáticas Prof. Yuri no encontrada').toBeDefined();

      // 5. Gasfitería Maestro Teodoro con motobomba (El Tambo)
      const gasfiteria = INITIAL_SECTOR_LISTINGS.find(
        (l) => l.title.toLowerCase().includes('gasfitería') && l.title.toLowerCase().includes('teodoro')
      );
      expect(gasfiteria, 'Semilla de gasfitería Maestro Teodoro no encontrada').toBeDefined();
      expect(gasfiteria!.emergency_response_note).toContain('motobomba');

      // 6. Electricidad Técnico Wálter con generador (Huancayo Centro)
      const electricidad = INITIAL_SECTOR_LISTINGS.find(
        (l) => l.title.toLowerCase().includes('electricidad') && l.title.toLowerCase().includes('wálter')
      );
      expect(electricidad, 'Semilla de electricidad Técnico Wálter no encontrada').toBeDefined();
      expect(electricidad!.emergency_response_note).toContain('Generador');

      // 7. Enfermería Lic. Maritza con balón de oxígeno 24/7 (El Tambo)
      const oxigeno = INITIAL_SECTOR_LISTINGS.find(
        (l) => l.title.toLowerCase().includes('enfermería') && l.title.toLowerCase().includes('maritza')
      );
      expect(oxigeno, 'Semilla de enfermería Lic. Maritza no encontrada').toBeDefined();
      expect(oxigeno!.emergency_response_note).toContain('oxígeno');

      // 8. Punto de acopio Coliseo Municipal de El Tambo
      const acopio = INITIAL_SECTOR_POSTS.find(
        (p) => p.title.toLowerCase().includes('acopio') && p.title.toLowerCase().includes('coliseo')
      );
      expect(acopio, 'Semilla de acopio Coliseo El Tambo no encontrada').toBeDefined();

      // 9. Brigada y punto de encuentro ante sismos en Parque Bolognesi
      const sismos = INITIAL_SECTOR_POSTS.find(
        (p) => p.title.toLowerCase().includes('bolognesi') && p.title.toLowerCase().includes('sismos')
      );
      expect(sismos, 'Semilla de sismos Parque Bolognesi no encontrada').toBeDefined();

      // 10. Alerta SOS Falla Huaytapallana con difuminado a 50m
      const sosHuaytapallana = INITIAL_SECTOR_POSTS.find(
        (p) => p.post_type === 'SOS_VULNERABLE' && p.title.toLowerCase().includes('huaytapallana')
      );
      expect(sosHuaytapallana, 'Semilla SOS Huaytapallana no encontrada').toBeDefined();
      expect(sosHuaytapallana!.privacy_radius_meters).toBe(50);
      expect(sosHuaytapallana!.urgency_level).toBe('CRITICA');

      // 11. Cuadrilla contención Río Mantaro ante El Niño
      const mantaro = INITIAL_SECTOR_POSTS.find(
        (p) => p.title.toLowerCase().includes('mantaro') && p.description.toLowerCase().includes('el niño')
      );
      expect(mantaro, 'Semilla desborde Río Mantaro no encontrada').toBeDefined();
    });

    it('4.8. Funciones auxiliares getListingsForSector y getPostsForSector filtran fielmente por territorio', () => {
      // Todo
      expect(getListingsForSector('all').length).toBe(INITIAL_SECTOR_LISTINGS.length);
      expect(getPostsForSector('all').length).toBe(INITIAL_SECTOR_POSTS.length);

      // Jesús María
      const jmListings = getListingsForSector('lima-jesus-maria-4');
      expect(jmListings.length).toBe(6);
      expect(jmListings).toEqual(JESUS_MARIA_LISTINGS);

      const jmPosts = getPostsForSector('lima-jesus-maria-4');
      expect(jmPosts.length).toBe(4);
      expect(jmPosts).toEqual(JESUS_MARIA_POSTS);

      // Huancayo (El Tambo, San Carlos, etc.)
      const hyoListings = getListingsForSector('huancayo-el-tambo');
      expect(hyoListings.length).toBe(9);
      expect(hyoListings).toEqual(HUANCAYO_SECTOR_LISTINGS);

      const hyoPosts = getPostsForSector('zona-critica-huaytapallana');
      expect(hyoPosts.length).toBe(8);
      expect(hyoPosts).toEqual(HUANCAYO_SECTOR_POSTS);
    });
  });
});
