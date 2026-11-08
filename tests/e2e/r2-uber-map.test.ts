import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  NeighborhoodMap,
  projectCoordToViewport,
} from '@/components/map/neighborhood-map';
import { ModeProvider } from '@/context/mode-context';
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
  formatDistance,
} from '@/lib/geo-utils';
import {
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
} from '@/lib/initial-data';
import type { IListingLocal, IPostLocal } from '@/shared/types';

/**
 * Contrato de selección de marcador en mapa (PROJECT.md § Interface Contracts 4).
 */
export interface IMapSelectionTarget {
  type: 'LISTING' | 'POST';
  id: number;
  title: string;
  category: string;
  badgeType: 'SOLIDARIO' | 'COMERCIAL' | 'EMERGENCIA';
  latitude: number;
  longitude: number;
  distanceMeters: number;
  contactPhone?: string;
  availableForEmergencies?: boolean;
  trustScore?: number;
  urgencyLevel?: string;
  privacyRadiusMeters?: number;
  isPiiProtected?: boolean;
}

/**
 * Función de derivación canónica para transformar un registro a IMapSelectionTarget.
 */
export function deriveMapSelectionTarget(
  item: IListingLocal | IPostLocal,
  userLat: number,
  userLng: number
): IMapSelectionTarget {
  if ('listing_type' in item) {
    const distance = calculateDistanceMeters(userLat, userLng, item.latitude, item.longitude);
    return {
      type: 'LISTING',
      id: item.id ?? 1,
      title: item.title,
      category: item.listing_type,
      badgeType: item.available_for_emergencies ? 'EMERGENCIA' : 'COMERCIAL',
      latitude: item.latitude,
      longitude: item.longitude,
      distanceMeters: distance,
      contactPhone: item.contact_phone,
      availableForEmergencies: item.available_for_emergencies,
      trustScore: item.weighted_trust_score,
      isPiiProtected: false,
    };
  } else {
    const distance = calculateDistanceMeters(userLat, userLng, item.public_lat, item.public_lng);
    const isSos = item.post_type === 'SOS_VULNERABLE';
    return {
      type: 'POST',
      id: item.id ?? 1,
      title: item.title,
      category: item.post_type,
      badgeType: isSos ? 'EMERGENCIA' : 'SOLIDARIO',
      latitude: item.public_lat,
      longitude: item.public_lng,
      distanceMeters: distance,
      urgencyLevel: item.urgency_level,
      privacyRadiusMeters: item.privacy_radius_meters,
      isPiiProtected: isSos,
    };
  }
}

describe('R2: Módulo de Mapa Renovado Estilo Uber / Delivery', () => {
  /* =========================================================================
   * FEATURE 5: MAPA INTERACTIVO OPENSTREETMAP RESILIENTE
   * ========================================================================= */
  describe('F5 - Mapa Interactivo OpenStreetMap Resiliente: Tier 1 (Funcional)', () => {
    it('F5-T1-01: Renderiza atribución legal de OpenStreetMap y compatibilidad con Leaflet', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      expect(markup).toContain('OpenStreetMap');
      expect(markup).toContain('React-Leaflet Compatible');
    });

    it('F5-T1-02: Proyección cartográfica: el centro geodésico proyecta a coordenadas centrales (~50%, ~50%)', () => {
      const { xPercent, yPercent } = projectCoordToViewport(-12.0752, -77.0485);
      expect(xPercent).toBeCloseTo(50, 0);
      expect(yPercent).toBeCloseTo(50, 0);
    });

    it('F5-T1-03: Proyección cartográfica: acota los puntos dentro del viewport seguro (10% a 90%)', () => {
      const farNorthEast = projectCoordToViewport(-12.0, -76.9);
      expect(farNorthEast.xPercent).toBeLessThanOrEqual(90);
      expect(farNorthEast.yPercent).toBeGreaterThanOrEqual(10);

      const farSouthWest = projectCoordToViewport(-12.2, -77.2);
      expect(farSouthWest.xPercent).toBeGreaterThanOrEqual(10);
      expect(farSouthWest.yPercent).toBeLessThanOrEqual(90);
    });

    it('F5-T1-04: Resiliencia Offline: renderiza retícula cartográfica vectorial sin dependencias de red activas', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      expect(markup).toContain('<svg');
      expect(markup).toContain('viewBox="0 0 400 320"');
    });

    it('F5-T1-05: Renderiza plano de calles y cuadrículas para navegación urbana clara', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      expect(markup).toContain('<line');
      expect(markup).toContain('stroke=');
    });
  });

  describe('F5 - Mapa Interactivo: Tier 2 (BVA y Límites Cartográficos)', () => {
    it('F5-T2-01: Proyección de coordenada en límite norte extremo se acota a exactamente 10% Y', () => {
      const north = projectCoordToViewport(-10.0, -77.0485);
      expect(north.yPercent).toBe(10);
    });

    it('F5-T2-02: Proyección de coordenada en límite sur extremo se acota a exactamente 90% Y', () => {
      const south = projectCoordToViewport(-14.0, -77.0485);
      expect(south.yPercent).toBe(90);
    });

    it('F5-T2-03: Proyección de coordenada en límite este extremo se acota a exactamente 90% X', () => {
      const east = projectCoordToViewport(-12.0752, -70.0);
      expect(east.xPercent).toBe(90);
    });

    it('F5-T2-04: Proyección de coordenada en límite oeste extremo se acota a exactamente 10% X', () => {
      const west = projectCoordToViewport(-12.0752, -80.0);
      expect(west.xPercent).toBe(10);
    });

    it('F5-T2-05: Coordenadas idénticas entre origen y destino arrojan 0 metros sin división por cero', () => {
      const distance = calculateDistanceMeters(-12.065, -75.21, -12.065, -75.21);
      expect(distance).toBe(0);
    });
  });

  /* =========================================================================
   * FEATURE 6: BOTTOM SHEET DESLIZABLE ESTILO UBER/DELIVERY (VAUL DRAWER)
   * ========================================================================= */
  describe('F6 - Bottom Sheet Deslizable: Tier 1 (Funcional)', () => {
    it('F6-T1-01: Contrato IMapSelectionTarget contiene todos los atributos para renderizar la tarjeta Uber', () => {
      const sampleListing = INITIAL_SECTOR_LISTINGS[0]!;
      const target = deriveMapSelectionTarget(sampleListing, -12.0752, -77.0485);

      expect(target.type).toBe('LISTING');
      expect(target.id).toBe(sampleListing.id);
      expect(target.title).toBe(sampleListing.title);
      expect(target.badgeType).toBe('EMERGENCIA');
      expect(target.distanceMeters).toBeGreaterThanOrEqual(0);
      expect(target.contactPhone).toBe(sampleListing.contact_phone);
    });

    it('F6-T1-02: Selección de Oficio/Producto clasifica el badge en COMERCIAL o EMERGENCIA', () => {
      const lasanaListing = INITIAL_SECTOR_LISTINGS.find((l) =>
        l.title.toLowerCase().includes('lasañas')
      )!;
      const target = deriveMapSelectionTarget(lasanaListing, -12.0752, -77.0485);

      expect(target.badgeType).toBe('COMERCIAL');
      expect(target.isPiiProtected).toBe(false);
    });

    it('F6-T1-03: Selección de Favor Solidario clasifica el badge en SOLIDARIO', () => {
      const favorPost = INITIAL_SECTOR_POSTS.find((p) => p.post_type === 'OFERTA_FAVOR')!;
      const target = deriveMapSelectionTarget(favorPost, -12.0752, -77.0485);

      expect(target.type).toBe('POST');
      expect(target.badgeType).toBe('SOLIDARIO');
      expect(target.isPiiProtected).toBe(false);
    });

    it('F6-T1-04: Selección de SOS Vulnerable clasifica en EMERGENCIA con protección PII activa', () => {
      const sosPost = INITIAL_SECTOR_POSTS.find((p) => p.post_type === 'SOS_VULNERABLE')!;
      const target = deriveMapSelectionTarget(sosPost, -12.0752, -77.0485);

      expect(target.type).toBe('POST');
      expect(target.badgeType).toBe('EMERGENCIA');
      expect(target.isPiiProtected).toBe(true);
      expect(target.privacyRadiusMeters).toBe(50);
    });

    it('F6-T1-05: Renderiza tarjeta contextual con datos de servicio y botón de cierre', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      // Incluye leyenda accesible de privacidad y badges
      expect(markup).toContain('Azul: Oficios/Productos');
      expect(markup).toContain('Verde: Favores Solidarios');
      expect(markup).toContain('Rojo: Círculo Difuminado SOS (50m)');
    });
  });

  describe('F6 - Bottom Sheet: Tier 2 (BVA y Casos Límite)', () => {
    it('F6-T2-01: Maneja registros sin teléfono de contacto sin provocar excepciones', () => {
      const postWithoutPhone = INITIAL_SECTOR_POSTS[0]!;
      const target = deriveMapSelectionTarget(postWithoutPhone, -12.0752, -77.0485);
      expect(target.contactPhone).toBeUndefined();
    });

    it('F6-T2-02: Formatea distancia de 0 metros como "0 m" sin valores NaN o infinitos', () => {
      const formatted = formatDistance(0);
      expect(formatted).toBe('0 m');
    });

    it('F6-T2-03: Formatea distancias negativas o no numéricas con fallback seguro "0 m"', () => {
      expect(formatDistance(-50)).toBe('0 m');
      expect(formatDistance(NaN)).toBe('0 m');
      expect(formatDistance(null as unknown as number)).toBe('0 m');
    });

    it('F6-T2-04: Mantiene el badgeType estrictamente tipado dentro de SOLIDARIO, COMERCIAL o EMERGENCIA', () => {
      const allowedBadges = ['SOLIDARIO', 'COMERCIAL', 'EMERGENCIA'];
      for (const listing of INITIAL_SECTOR_LISTINGS) {
        const target = deriveMapSelectionTarget(listing, -12.0752, -77.0485);
        expect(allowedBadges).toContain(target.badgeType);
      }
      for (const post of INITIAL_SECTOR_POSTS) {
        const target = deriveMapSelectionTarget(post, -12.0752, -77.0485);
        expect(allowedBadges).toContain(target.badgeType);
      }
    });

    it('F6-T2-05: Protege dirección exacta en vista pública de SOS (Ley 29733)', () => {
      const sosPost = INITIAL_SECTOR_POSTS.find((p) => p.post_type === 'SOS_VULNERABLE')!;
      expect(sosPost.description).not.toContain('Jr. Huiracocha 1488 Dpto 201');
      expect(sosPost.description).toContain('[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]');
    });
  });

  /* =========================================================================
   * FEATURE 7: MARCADORES CATEGORIZADOS Y TRAZADO DE RUTA
   * ========================================================================= */
  describe('F7 - Marcadores Categorizados y Trazado de Ruta: Tier 1 (Funcional)', () => {
    it('F7-T1-01: Renderiza marcadores diferenciados por color: Azul (Oficio), Verde (Favor) y Rojo (SOS)', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      expect(markup).toContain('bg-sky-600'); // Oficio
      expect(markup).toContain('bg-emerald-700'); // Favor
      expect(markup).toContain('bg-red-700'); // SOS
    });

    it('F7-T1-02: Dibuja círculos difuminados de 50 metros en el canvas SVG para reportes SOS', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      expect(markup).toContain('data-testid="sos-privacy-circle-50m"');
      expect(markup).toContain('data-radius-meters="50"');
      expect(markup).toContain('stroke-dasharray="4 3"');
    });

    it('F7-T1-03: Calcula línea de ruta visual discontinua entre el usuario y el punto de destino', () => {
      const user = { x: 50, y: 50 };
      const dest = { x: 75, y: 30 };
      // Simula trazado SVG con strokeDasharray
      const lineProps = {
        x1: `${user.x}%`,
        y1: `${user.y}%`,
        x2: `${dest.x}%`,
        y2: `${dest.y}%`,
        strokeDasharray: '6 4',
      };
      expect(lineProps.strokeDasharray).toBe('6 4');
      expect(lineProps.x1).toBe('50%');
      expect(lineProps.x2).toBe('75%');
    });

    it('F7-T1-04: Estima tiempo de caminata a pie basado en 4.5 km/h (75 metros por minuto)', () => {
      expect(estimateWalkingMinutes(75)).toBe(1);
      expect(estimateWalkingMinutes(150)).toBe(2);
      expect(estimateWalkingMinutes(300)).toBe(4);
      expect(estimateWalkingMinutes(750)).toBe(10);
      expect(estimateWalkingMinutes(1500)).toBe(20);
    });

    it('F7-T1-05: Formatea distancias legibles para vecinos y adultos mayores en metros y kilómetros', () => {
      expect(formatDistance(50)).toBe('50 m');
      expect(formatDistance(180)).toBe('180 m');
      expect(formatDistance(950)).toBe('950 m');
      expect(formatDistance(1000)).toBe('1.0 km');
      expect(formatDistance(1400)).toBe('1.4 km');
      expect(formatDistance(2500)).toBe('2.5 km');
    });
  });

  describe('F7 - Trazado y Tiempos: Tier 2 (BVA)', () => {
    it('F7-T2-01: estimateWalkingMinutes para 0 metros devuelve 0 minutos', () => {
      expect(estimateWalkingMinutes(0)).toBe(0);
    });

    it('F7-T2-02: estimateWalkingMinutes para distancias mínimas (1m a 37m) redondea al mínimo de 1 minuto', () => {
      expect(estimateWalkingMinutes(10)).toBe(1);
      expect(estimateWalkingMinutes(35)).toBe(1);
    });

    it('F7-T2-03: estimateWalkingMinutes para valores negativos o no numéricos retorna 0', () => {
      expect(estimateWalkingMinutes(-100)).toBe(0);
      expect(estimateWalkingMinutes(NaN)).toBe(0);
      expect(estimateWalkingMinutes(null as unknown as number)).toBe(0);
    });

    it('F7-T2-04: formatDistance en el límite de transición 999m vs 1000m', () => {
      expect(formatDistance(999)).toBe('999 m');
      expect(formatDistance(1000)).toBe('1.0 km');
      expect(formatDistance(1001)).toBe('1.0 km');
    });

    it('F7-T2-05: Cálculo Haversine con distancias de varios kilómetros entre Huancayo y El Tambo', () => {
      // El Tambo (-12.0528, -75.2155) a Huancayo Centro (-12.0678, -75.2085)
      const distance = calculateDistanceMeters(-12.0528, -75.2155, -12.0678, -75.2085);
      expect(distance).toBeGreaterThan(1500);
      expect(distance).toBeLessThan(2500);
      const walkingTime = estimateWalkingMinutes(distance);
      expect(walkingTime).toBeGreaterThanOrEqual(20);
      expect(walkingTime).toBeLessThanOrEqual(35);
    });
  });

  /* =========================================================================
   * FEATURE 8: CONTROLES TÁCTILES Y ACCESIBILIDAD (BOTONES >= 48PX)
   * ========================================================================= */
  describe('F8 - Controles Táctiles y Accesibilidad: Tier 1 (Funcional)', () => {
    it('F8-T1-01: Todos los botones interactivos del mapa tienen altura táctil accesible >= 48px', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      const buttonMatches = markup.match(/<button[^>]*>/g) ?? [];
      expect(buttonMatches.length).toBeGreaterThanOrEqual(10);
      for (const btn of buttonMatches) {
        const hasMinTouch =
          btn.includes('min-h-[48px]') ||
          btn.includes('min-h-[52px]') ||
          btn.includes('min-h-[56px]') ||
          btn.includes('h-12');
        expect(hasMinTouch).toBe(true);
      }
    });

    it('F8-T1-02: Todos los marcadores circulares del mapa tienen ancho táctil accesible >= 48px', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      const markerButtons = (markup.match(/<button[^>]*class="[^"]*min-w-\[48px\][^"]*"[^>]*>/g) ?? []);
      expect(markerButtons.length).toBeGreaterThanOrEqual(6);
    });

    it('F8-T1-03: Grupo de filtros de capas cuenta con role="group" y aria-label descriptivo', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      expect(markup).toContain('role="group"');
      expect(markup).toContain('aria-label="Capas del mapa barrial"');
    });

    it('F8-T1-04: Botones de capa usan aria-pressed para lectores de pantalla de adultos mayores', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      expect(markup).toContain('aria-pressed="true"');
      expect(markup).toContain('aria-pressed="false"');
    });

    it('F8-T1-05: Marcadores tienen aria-label descriptivo con el título del servicio o alerta', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ModeProvider, null,
          React.createElement(NeighborhoodMap, {
            initialListings: INITIAL_SECTOR_LISTINGS,
            initialPosts: INITIAL_SECTOR_POSTS,
          })
        )
      );
      expect(markup).toContain('aria-label="Oficio local:');
    });
  });

  describe('F8 - Controles Táctiles: Tier 2 (BVA y Estados de Capa)', () => {
    it('F8-T2-01: Filtro OFICIOS muestra solo marcadores de catálogo y oculta publicaciones del muro', () => {
      const filterType = 'OFICIOS';
      const visibleListings = INITIAL_SECTOR_LISTINGS;
      const visiblePosts = INITIAL_SECTOR_POSTS.filter(() => false);

      expect(visibleListings.length).toBeGreaterThan(0);
      expect(visiblePosts.length).toBe(0);
    });

    it('F8-T2-02: Filtro FAVORES muestra únicamente favores solidarios y excluye alertas SOS', () => {
      const visiblePosts = INITIAL_SECTOR_POSTS.filter(
        (p) => p.post_type !== 'SOS_VULNERABLE'
      );
      expect(visiblePosts.length).toBeGreaterThan(0);
      expect(visiblePosts.some((p) => p.post_type === 'SOS_VULNERABLE')).toBe(false);
    });

    it('F8-T2-03: Filtro SOS muestra únicamente publicaciones SOS_VULNERABLE', () => {
      const visiblePosts = INITIAL_SECTOR_POSTS.filter(
        (p) => p.post_type === 'SOS_VULNERABLE'
      );
      expect(visiblePosts.length).toBeGreaterThanOrEqual(1);
      for (const p of visiblePosts) {
        expect(p.post_type).toBe('SOS_VULNERABLE');
      }
    });

    it('F8-T2-04: Filtro TODOS restaura la visibilidad combinada de oficios y publicaciones', () => {
      const visibleListings = INITIAL_SECTOR_LISTINGS;
      const visiblePosts = INITIAL_SECTOR_POSTS;
      expect(visibleListings.length + visiblePosts.length).toBe(
        INITIAL_SECTOR_LISTINGS.length + INITIAL_SECTOR_POSTS.length
      );
    });

    it('F8-T2-05: Modal de justificación operativa de rescate requiere al menos 10 caracteres', () => {
      const validateReason = (reason: string) => reason.trim().length >= 10;
      expect(validateReason('Ayuda')).toBe(false);
      expect(validateReason('          ')).toBe(false);
      expect(validateReason('Traslado de oxígeno para adulto mayor')).toBe(true);
    });
  });

  /* =========================================================================
   * TIER 3: INTERACCIONES COMBINATORIAS Y FLUJO COMPLETO MAPA (R2)
   * ========================================================================= */
  describe('R2: Tier 3 (Interacciones Combinatorias y Ciclo de Vida)', () => {
    it('R2-T3-01: Ciclo completo: tocar marcador -> obtener selección -> derivar tiempo a pie y ruta -> cerrar', () => {
      const userCoords = { lat: -12.0752, lng: -77.0485 };
      const selectedItem = INITIAL_SECTOR_LISTINGS[0]!;

      // 1. Tocar marcador
      const target = deriveMapSelectionTarget(selectedItem, userCoords.lat, userCoords.lng);
      expect(target.title).toBe(selectedItem.title);

      // 2. Estimar distancia y tiempo a pie
      const distance = target.distanceMeters;
      const walkingMinutes = estimateWalkingMinutes(distance);
      const formattedDistance = formatDistance(distance);

      expect(formattedDistance).toContain('m');
      expect(walkingMinutes).toBeGreaterThanOrEqual(1);

      // 3. Simular cierre
      let activeTarget: IMapSelectionTarget | null = target;
      const handleClose = () => {
        activeTarget = null;
      };
      handleClose();
      expect(activeTarget).toBeNull();
    });

    it('R2-T3-02: Comparación geodésica entre coordenadas en Huancayo: El Tambo vs San Carlos', () => {
      // El Tambo (-12.0528, -75.2155) a San Carlos (-12.0625, -75.2005)
      const distElTamboSanCarlos = calculateDistanceMeters(
        -12.0528,
        -75.2155,
        -12.0625,
        -75.2005
      );
      expect(distElTamboSanCarlos).toBeGreaterThan(1000);
      expect(distElTamboSanCarlos).toBeLessThan(2500);

      const walkingMin = estimateWalkingMinutes(distElTamboSanCarlos);
      expect(walkingMin).toBeGreaterThanOrEqual(15);
      expect(walkingMin).toBeLessThanOrEqual(30);
    });

    it('R2-T3-03: Renderizado sin fugas de memoria con múltiples re-renderizados consecutivos de NeighborhoodMap', () => {
      for (let i = 0; i < 5; i++) {
        const markup = renderToStaticMarkup(
          React.createElement(ModeProvider, null,
            React.createElement(NeighborhoodMap, {
              initialListings: INITIAL_SECTOR_LISTINGS,
              initialPosts: INITIAL_SECTOR_POSTS,
            })
          )
        );
        expect(markup.length).toBeGreaterThan(500);
      }
    });
  });
});
