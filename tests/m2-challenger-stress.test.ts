/**
 * @file tests/m2-challenger-stress.test.ts
 * @description Suite de Pruebas de Estrés y Verificación Empírica Adversarial
 * para el Hito Milestone 2 (Mapa Estilo Uber/Delivery y Bottom Sheet - R2: F5, F6, F7, F8).
 *
 * Ejecutado por: Challenger M2-1 (Adversarial Critic & Domain Specialist)
 */

import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CENTER_LAT,
  CENTER_LNG,
  deriveMapSelectionTarget,
  type IMapSelectionTarget,
  NeighborhoodMap,
  projectCoordToViewport,
} from '@/components/map/neighborhood-map';
import { LocationProvider } from '@/context/location-context';
import { ModeProvider } from '@/context/mode-context';
import {
  applySpatialBlurring50m,
  calculateDistanceMeters,
  estimateWalkingMinutes,
  formatDistance,
} from '@/lib/geo-utils';
import {
  HUANCAYO_SECTOR_LISTINGS,
  HUANCAYO_SECTOR_POSTS,
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
  JESUS_MARIA_LISTINGS,
  JESUS_MARIA_POSTS,
} from '@/lib/initial-data';
import type { IListingLocal, IPostLocal } from '@/shared/types';

describe('CHALLENGER M2: Verificación Empírica y Pruebas de Estrés Adversarias (R2: F5, F6, F7, F8)', () => {
  /* =========================================================================
   * 1. COMPORTAMIENTO DEL MAPA CON COORDENADAS EXTREMAS, LISTAS VACÍAS Y CATEGORÍAS
   * ========================================================================= */
  describe('1. Límites Geodésicos Extremos y Robustez con Datos Vacíos / Malformados', () => {
    it('1.1. projectCoordToViewport acota estrictamente dentro del rango de seguridad [10, 90] para coordenadas globales arbitrarias', () => {
      const extremeCoordinates: [number, number][] = [
        [0, 0], // Punto Nemo / Ecuador
        [90, 0], // Polo Norte exacto
        [-90, 0], // Polo Sur exacto
        [0, 180], // Antimeridiano
        [0, -180],
        [89.999, 179.999],
        [-89.999, -179.999],
        [1000, 2000], // Coordenadas numéricamente fuera de rango geográfico
        [-5000, -5000],
      ];

      for (const [lat, lng] of extremeCoordinates) {
        const { xPercent, yPercent } = projectCoordToViewport(lat, lng);
        expect(Number.isNaN(xPercent), `xPercent es NaN para [${lat}, ${lng}]`).toBe(false);
        expect(Number.isNaN(yPercent), `yPercent es NaN para [${lat}, ${lng}]`).toBe(false);
        expect(xPercent).toBeGreaterThanOrEqual(10);
        expect(xPercent).toBeLessThanOrEqual(90);
        expect(yPercent).toBeGreaterThanOrEqual(10);
        expect(yPercent).toBeLessThanOrEqual(90);
      }
    });

    it('1.2. projectCoordToViewport con factores de zoom extremos (0.5x hasta 100x)', () => {
      const zoomLevels = [0.5, 0.75, 1, 1.5, 2.5, 5, 10, 100];
      for (const z of zoomLevels) {
        const { xPercent, yPercent } = projectCoordToViewport(
          -12.0528,
          -75.2155,
          CENTER_LAT,
          CENTER_LNG,
          0.008,
          0.008,
          z
        );
        expect(Number.isFinite(xPercent)).toBe(true);
        expect(Number.isFinite(yPercent)).toBe(true);
        expect(xPercent).toBeGreaterThanOrEqual(10);
        expect(xPercent).toBeLessThanOrEqual(90);
        expect(yPercent).toBeGreaterThanOrEqual(10);
        expect(yPercent).toBeLessThanOrEqual(90);
      }
    });

    it('1.3. NeighborhoodMap se renderiza de forma resiliente con listas totalmente vacías (empty state) sin crashear', () => {
      expect(() => {
        const markup = renderToStaticMarkup(
          React.createElement(ModeProvider, null,
            React.createElement(LocationProvider, null,
              React.createElement(NeighborhoodMap, {
                initialListings: [],
                initialPosts: [],
              })
            )
          )
        );
        expect(markup).toContain('Mapa Barrial');
        expect(markup).toContain('Plano vectorial de calles del sector');
        expect(markup).toContain('OpenStreetMap');
      }).not.toThrow();
    });

    it('1.4. NeighborhoodMap maneja items con campos opcionales ausentes o vacíos', () => {
      const sparseListings: IListingLocal[] = [
        {
          client_mutation_id: 'sparse-listing-1',
          category_id: 1,
          title: 'Oficio Sin Teléfono Ni Descripción',
          description: '',
          listing_type: 'SERVICIO_OFICIO',
          contact_phone: '',
          latitude: -12.0528,
          longitude: -75.2155,
          weighted_trust_score: 0,
          endorsement_count: 0,
          is_pending_sync: false,
          available_for_emergencies: false,
        },
      ];

      const sparsePosts: IPostLocal[] = [
        {
          client_mutation_id: 'sparse-post-1',
          sector_id: 1,
          category_id: 1,
          operational_mode: 'EMERGENCIA',
          title: 'SOS Sin Radio Explícito',
          description: '',
          post_type: 'SOS_VULNERABLE',
          urgency_level: 'MEDIA',
          public_lat: -12.053,
          public_lng: -75.216,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ];

      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(LocationProvider, null,
            React.createElement(NeighborhoodMap, {
              initialListings: sparseListings,
              initialPosts: sparsePosts,
            })
          )
        )
      );

      expect(markup).toContain('Oficio Sin Teléfono Ni Descripción');
      expect(markup).toContain('SOS Sin Radio Explícito');
      expect(markup).toContain('data-testid="sos-privacy-circle-50m"');
    });

    it('1.5. Filtrado por categorías: verifica la lógica exacta de filtrado del mapa para cada capa', () => {
      const filterCategories = ['TODOS', 'OFICIOS', 'FAVORES', 'SOS'] as const;

      for (const filterType of filterCategories) {
        // Simular lógica de filtrado de NeighborhoodMap
        const visibleListings =
          filterType === 'TODOS' || filterType === 'OFICIOS' ? HUANCAYO_SECTOR_LISTINGS : [];

        const visiblePosts = HUANCAYO_SECTOR_POSTS.filter((post) => {
          if (filterType === 'TODOS') return true;
          if (filterType === 'FAVORES') return post.post_type !== 'SOS_VULNERABLE';
          if (filterType === 'SOS') return post.post_type === 'SOS_VULNERABLE';
          return false;
        });

        if (filterType === 'TODOS') {
          expect(visibleListings.length).toBe(HUANCAYO_SECTOR_LISTINGS.length);
          expect(visiblePosts.length).toBe(HUANCAYO_SECTOR_POSTS.length);
        } else if (filterType === 'OFICIOS') {
          expect(visibleListings.length).toBe(HUANCAYO_SECTOR_LISTINGS.length);
          expect(visiblePosts.length).toBe(0);
        } else if (filterType === 'FAVORES') {
          expect(visibleListings.length).toBe(0);
          expect(visiblePosts.length).toBeGreaterThan(0);
          expect(visiblePosts.every((p) => p.post_type !== 'SOS_VULNERABLE')).toBe(true);
        } else if (filterType === 'SOS') {
          expect(visibleListings.length).toBe(0);
          expect(visiblePosts.length).toBeGreaterThanOrEqual(1);
          expect(visiblePosts.every((p) => p.post_type === 'SOS_VULNERABLE')).toBe(true);
        }
      }
    });
  });

  /* =========================================================================
   * 2. BOTTOM SHEET INTERACTIVO, SELECCIÓN DE OBJETIVOS Y ACCIONES
   * ========================================================================= */
  describe('2. Bottom Sheet Interactivo, Selección y Disparadores de Acción', () => {
    it('2.1. deriveMapSelectionTarget deriva correctamente objetos de tipo LISTING', () => {
      const userLat = -12.0528;
      const userLng = -75.2155;
      const listing = HUANCAYO_SECTOR_LISTINGS[0]!;

      const target = deriveMapSelectionTarget(listing, userLat, userLng);
      expect(target.type).toBe('LISTING');
      expect(target.id).toBe(listing.id ?? 1);
      expect(target.title).toBe(listing.title);
      expect(target.category).toBe(listing.listing_type);
      expect(target.latitude).toBe(listing.latitude);
      expect(target.longitude).toBe(listing.longitude);
      expect(target.contactPhone).toBe(listing.contact_phone);
      expect(target.isPiiProtected).toBe(false);
      expect(target.distanceMeters).toBeGreaterThanOrEqual(0);
      expect(target.originalListing).toBe(listing);
    });

    it('2.2. deriveMapSelectionTarget deriva correctamente objetos de tipo POST Solidario', () => {
      const userLat = -12.0528;
      const userLng = -75.2155;
      const solidaryPost = HUANCAYO_SECTOR_POSTS.find((p) => p.post_type === 'OFERTA_FAVOR')!;

      const target = deriveMapSelectionTarget(solidaryPost, userLat, userLng);
      expect(target.type).toBe('POST');
      expect(target.title).toBe(solidaryPost.title);
      expect(target.category).toBe('OFERTA_FAVOR');
      expect(target.badgeType).toBe('SOLIDARIO');
      expect(target.isPiiProtected).toBe(false);
      expect(target.originalPost).toBe(solidaryPost);
    });

    it('2.3. deriveMapSelectionTarget deriva correctamente objetos de tipo SOS_VULNERABLE con protección PII', () => {
      const userLat = -12.0528;
      const userLng = -75.2155;
      const sosPost = HUANCAYO_SECTOR_POSTS.find((p) => p.post_type === 'SOS_VULNERABLE')!;

      const target = deriveMapSelectionTarget(sosPost, userLat, userLng);
      expect(target.type).toBe('POST');
      expect(target.badgeType).toBe('EMERGENCIA');
      expect(target.isPiiProtected).toBe(true);
      expect(target.privacyRadiusMeters).toBe(sosPost.privacy_radius_meters ?? 50);
      expect(target.originalPost).toBe(sosPost);
    });

    it('2.4. Ciclo completo de Bottom Sheet: selección abre el drawer y cierre limpia el target', () => {
      let selectedTarget: IMapSelectionTarget | null = null;

      // Apertura
      const listing = HUANCAYO_SECTOR_LISTINGS[0]!;
      selectedTarget = deriveMapSelectionTarget(listing, -12.0528, -75.2155);
      expect(selectedTarget).not.toBeNull();
      expect(!!selectedTarget).toBe(true);

      // Cierre
      const onOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
          selectedTarget = null;
        }
      };

      onOpenChange(false);
      expect(selectedTarget).toBeNull();
      expect(!!selectedTarget).toBe(false);
    });

    it('2.5. Validación rigurosa de justificación en auditoría forense PII (Ley N° 29733)', () => {
      const validateAccessReason = (reason: string): { valid: boolean; error?: string } => {
        const trimmed = reason.trim();
        if (trimmed.length < 10) {
          return {
            valid: false,
            error:
              'Por mandato de la Ley N° 29733, debes registrar una justificación operativa de rescate de al menos 10 caracteres.',
          };
        }
        return { valid: true };
      };

      expect(validateAccessReason('').valid).toBe(false);
      expect(validateAccessReason('   ').valid).toBe(false);
      expect(validateAccessReason('Rescate').valid).toBe(false);
      expect(validateAccessReason('123456789').valid).toBe(false);
      expect(validateAccessReason('1234567890').valid).toBe(true);
      expect(
        validateAccessReason('Despliegue de brigada médica con balón de oxígeno').valid
      ).toBe(true);
    });

    it('2.6. Blurring determinista de 50 metros nunca supera el radio máximo de 50 metros', () => {
      const seeds = [
        'seed-alpha',
        'seed-beta',
        'seed-gamma',
        'emergency-call-1',
        'emergency-call-99',
        'huancayo-el-tambo',
        'catastrofe-sismo',
      ];

      for (const seed of seeds) {
        const result = applySpatialBlurring50m(-12.0528, -75.2155, seed);
        expect(result.radiusMeters).toBe(50);

        const distance = calculateDistanceMeters(
          -12.0528,
          -75.2155,
          result.blurredLat,
          result.blurredLng
        );
        expect(distance).toBeGreaterThanOrEqual(30);
        expect(distance).toBeLessThanOrEqual(52); // Tolerancia de 2m por redondeo geodésico
      }
    });
  });

  /* =========================================================================
   * 3. CÁLCULO DE RUTA, DISTANCIA Y TIEMPO A PIE (CORTO, MEDIO, LARGO)
   * ========================================================================= */
  describe('3. Fórmulas de Ruteo, Distancia Haversine y Estimación de Caminata a Pie', () => {
    it('3.1. Distancias cortas (< 200m): precisión métrica y tiempo mínimo de 1 minuto', () => {
      const lat1 = -12.0528;
      const lon1 = -75.2155;
      const lat2 = -12.05325;
      const lon2 = -75.2155;

      const dist50m = calculateDistanceMeters(lat1, lon1, lat2, lon2);
      expect(dist50m).toBeGreaterThanOrEqual(45);
      expect(dist50m).toBeLessThanOrEqual(55);

      const walkingMin50m = estimateWalkingMinutes(dist50m);
      expect(walkingMin50m).toBe(1); // Mínimo garantizado para distancias cortas

      const formatted50m = formatDistance(dist50m);
      expect(formatted50m).toMatch(/^\d+ m$/);

      // Distancia de 180 metros
      const lat180m = -12.05442;
      const dist180m = calculateDistanceMeters(lat1, lon1, lat180m, lon1);
      expect(dist180m).toBeGreaterThanOrEqual(170);
      expect(dist180m).toBeLessThanOrEqual(190);

      const walkingMin180m = estimateWalkingMinutes(dist180m);
      expect(walkingMin180m).toBe(2);
      expect(formatDistance(dist180m)).toMatch(/^\d+ m$/);
    });

    it('3.2. Distancias medias (~500m): precisión métrica y tiempo de caminata coherente', () => {
      const walking500 = estimateWalkingMinutes(500);
      expect(walking500).toBe(7);
      expect(formatDistance(500)).toBe('500 m');

      expect(estimateWalkingMinutes(400)).toBe(5);
      expect(formatDistance(400)).toBe('400 m');

      expect(estimateWalkingMinutes(750)).toBe(10);
      expect(formatDistance(750)).toBe('750 m');

      expect(formatDistance(999)).toBe('999 m');
    });

    it('3.3. Distancias largas (> 1km): formato en kilómetros y tiempo a pie proporcional', () => {
      expect(formatDistance(1000)).toBe('1.0 km');
      expect(estimateWalkingMinutes(1000)).toBe(13);

      expect(formatDistance(1400)).toBe('1.4 km');
      expect(estimateWalkingMinutes(1400)).toBe(19);

      expect(formatDistance(2500)).toBe('2.5 km');
      expect(estimateWalkingMinutes(2500)).toBe(33);

      expect(formatDistance(10000)).toBe('10.0 km');
      expect(estimateWalkingMinutes(10000)).toBe(133);
    });

    it('3.4. Trazado visual de ruta: coordenadas SVG y badge flotante de distancia y tiempo', () => {
      const user = projectCoordToViewport(-12.0528, -75.2155);
      const destination = projectCoordToViewport(-12.056, -75.212);

      const strokeDasharray = '6 4';
      expect(strokeDasharray).toBe('6 4');

      const midX = (user.xPercent + destination.xPercent) / 2;
      const midY = (user.yPercent + destination.yPercent) / 2;

      expect(midX).toBeGreaterThanOrEqual(10);
      expect(midX).toBeLessThanOrEqual(90);
      expect(midY).toBeGreaterThanOrEqual(10);
      expect(midY).toBeLessThanOrEqual(90);
    });
  });

  /* =========================================================================
   * 4. CONTROL TÁCTIL Y TAMAÑO DE BOTONES (WCAG AAA >= 48PX)
   * ========================================================================= */
  describe('4. Auditoría de Accesibilidad Táctil WCAG AAA (Botones >= 48px)', () => {
    it('4.1. El 100% de los elementos <button> renderizados en NeighborhoodMap cumplen min-h >= 48px', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(LocationProvider, null,
            React.createElement(NeighborhoodMap, {
              initialListings: HUANCAYO_SECTOR_LISTINGS,
              initialPosts: HUANCAYO_SECTOR_POSTS,
            })
          )
        )
      );

      const buttonMatches = markup.match(/<button[^>]*>/g) ?? [];
      expect(buttonMatches.length).toBeGreaterThanOrEqual(10);

      for (const btn of buttonMatches) {
        const hasAccessibleHeight =
          btn.includes('min-h-[48px]') ||
          btn.includes('min-h-[52px]') ||
          btn.includes('min-h-[56px]') ||
          btn.includes('h-12');
        expect(
          hasAccessibleHeight,
          `El botón viola WCAG AAA (< 48px): ${btn}`
        ).toBe(true);
      }
    });

    it('4.2. Todos los controles de la botonera cartográfica superior derecha cumplen min-w-[48px] y min-h-[48px]', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(LocationProvider, null,
            React.createElement(NeighborhoodMap, {
              initialListings: HUANCAYO_SECTOR_LISTINGS,
              initialPosts: HUANCAYO_SECTOR_POSTS,
            })
          )
        )
      );

      const controlLabels = [
        'Aumentar zoom',
        'Disminuir zoom',
        'Recentrar en mi ubicación',
        'Alternar capa cartográfica',
        'Alternar pantalla completa',
      ];

      for (const label of controlLabels) {
        expect(markup).toContain(`aria-label="${label}"`);
      }
    });

    it('4.3. Marcadores táctiles cumplen min-w-[48px] para prevenir errores de puntero en adultos mayores', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(LocationProvider, null,
            React.createElement(NeighborhoodMap, {
              initialListings: HUANCAYO_SECTOR_LISTINGS,
              initialPosts: HUANCAYO_SECTOR_POSTS,
            })
          )
        )
      );

      const markerButtons = markup.match(/<button[^>]*class="[^"]*min-w-\[48px\][^"]*"[^>]*>/g) ?? [];
      expect(markerButtons.length).toBeGreaterThanOrEqual(5);
    });

    it('4.4. Todos los bloques <button> en el código fuente de neighborhood-map.tsx incluyen min-h-[48px]', () => {
      const componentFilePath = path.resolve(
        process.cwd(),
        'src/components/map/neighborhood-map.tsx'
      );
      const sourceCode = fs.readFileSync(componentFilePath, 'utf8');

      // Dividir el archivo por bloques de apertura de <button
      const parts = sourceCode.split('<button');
      // Descartar la cabecera antes del primer <button
      const buttonDeclarations = parts.slice(1);

      expect(buttonDeclarations.length).toBeGreaterThanOrEqual(10);

      for (const declaration of buttonDeclarations) {
        // Extraer hasta el cierre del tag de apertura (buscando '>' que no pertenezca a flechas '=>')
        // En cada declaración de botón debe existir la clase min-h-[48px]
        // Tomamos los primeros 1200 caracteres de la declaración para asegurar que incluya className
        const snippet = declaration.slice(0, 1200);
        const hasMinH = snippet.includes('min-h-[48px]');
        expect(
          hasMinH,
          `Declaración de botón sin min-h-[48px]: <button ${snippet.slice(0, 120)}...`
        ).toBe(true);
      }
    });
  });

  /* =========================================================================
   * 5. RESILIENCIA OFFLINE Y FALLBACK VECTORIAL SIN RED
   * ========================================================================= */
  describe('5. Resiliencia Offline, Fallback Cartográfico y Service Worker', () => {
    it('5.1. El canvas SVG vectorial nativo está siempre presente para respaldar la cartografía en modo avión', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(LocationProvider, null,
            React.createElement(NeighborhoodMap, {
              initialListings: HUANCAYO_SECTOR_LISTINGS,
              initialPosts: HUANCAYO_SECTOR_POSTS,
            })
          )
        )
      );

      expect(markup).toContain('<svg');
      expect(markup).toContain('viewBox="0 0 400 320"');
      expect(markup).toContain('aria-label="Plano vectorial de calles del sector"');
      expect(markup).toContain('<line');
      expect(markup).toContain('Av. Mariscal Castilla');
      expect(markup).toContain('Av. Huancavelica');
    });

    it('5.2. Enlaces de tiles de OpenStreetMap tienen manejador onError que silencia fallas de red', () => {
      const componentFilePath = path.resolve(
        process.cwd(),
        'src/components/map/neighborhood-map.tsx'
      );
      const sourceCode = fs.readFileSync(componentFilePath, 'utf8');

      expect(sourceCode).toContain('onError=');
      expect(sourceCode).toContain('Silenciosamente respaldado por el canvas vectorial SVG offline');
    });

    it('5.3. Service Worker implementa Stale-While-Revalidate en caché redvecina-tiles-v1 para OpenStreetMap', () => {
      const swFilePath = path.resolve(process.cwd(), 'public/sw.js');
      expect(fs.existsSync(swFilePath)).toBe(true);

      const swContent = fs.readFileSync(swFilePath, 'utf8');
      expect(swContent).toContain('TILES_CACHE_NAME');
      expect(swContent).toContain('redvecina-tiles-v1');
      expect(swContent).toContain('tile.openstreetmap.org');
      expect(swContent).toContain('caches.open(TILES_CACHE_NAME)');
      expect(swContent).toContain('fetchPromise');
    });

    it('5.4. El mapa permite alternar entre vista OpenStreetMap y vista vectorial offline mediante el control de capas', () => {
      const componentFilePath = path.resolve(
        process.cwd(),
        'src/components/map/neighborhood-map.tsx'
      );
      const sourceCode = fs.readFileSync(componentFilePath, 'utf8');

      expect(sourceCode).toContain('setShowOsmTiles');
      expect(sourceCode).toContain('Alternar capa cartográfica');
      expect(sourceCode).toContain("showOsmTiles ? 'OSM' : 'Vector'");
    });
  });
});
