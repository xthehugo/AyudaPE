/**
 * @file tests/m3-m4-challenger-stress.test.ts
 * @description Suite de Pruebas de Estrés y Verificación Empírica Adversarial
 * para los Hitos Milestone 3 & 4 (Filtro de Radio Hiperlocal y Modo Presentación Jurado 180s).
 *
 * Ejecutado por: Challenger M3-M4-2 (Adversarial Critic & Domain Specialist)
 */

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  AVAILABLE_SECTORS,
  DEFAULT_SECTOR,
  LocationProvider,
  type HyperlocalRadiusMeters,
} from '@/context/location-context';
import { ModeProvider } from '@/context/mode-context';
import { AppShell } from '@/components/layout/app-shell';
import HomePage from '@/app/page';
import {
  calculateDistanceMeters,
  ProximityCatalogView,
} from '@/components/views/proximity-catalog-view';
import {
  deriveTimerStatusColor,
  executePiiVaultUnlock,
  formatTimerMmSs,
  PitchJuryPanel,
  PitchTimerController,
} from '@/components/presentation/pitch-jury-panel';
import {
  applySpatialBlurring50m,
  calculateDistanceMeters as geoCalculateDistanceMeters,
  filterItemsByHyperlocalRadius,
} from '@/lib/geo-utils';
import {
  HUANCAYO_SECTOR_LISTINGS,
  HUANCAYO_SECTOR_POSTS,
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
  JESUS_MARIA_LISTINGS,
} from '@/lib/initial-data';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import { SyncManager } from '@/lib/offline/sync-manager';
import type { IListingLocal, IPostLocal, SystemRole } from '@/shared/types';

/**
 * Validador estricto AST con TypeScript compiler API para verificar
 * que todo elemento JSX <button> defina min-h-[48px] (WCAG AAA).
 */
function verifyAllJsxButtonsHaveMinH48(filePath: string): { totalButtons: number; violations: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const violations: string[] = [];
  let totalButtons = 0;

  function visit(node: ts.Node) {
    let isButton = false;
    let attributes: ts.JsxAttributes | undefined;

    if (ts.isJsxOpeningElement(node) && node.tagName.getText(sourceFile) === 'button') {
      isButton = true;
      attributes = node.attributes;
    } else if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === 'button') {
      isButton = true;
      attributes = node.attributes;
    }

    if (isButton && attributes) {
      totalButtons++;
      const classAttr = attributes.properties.find(
        (p) => ts.isJsxAttribute(p) && p.name.getText(sourceFile) === 'className'
      ) as ts.JsxAttribute | undefined;

      const classText = classAttr ? classAttr.getText(sourceFile) : '';
      const hasMinH =
        classText.includes('min-h-[48px]') ||
        classText.includes('min-h-[52px]') ||
        classText.includes('min-h-[56px]');

      if (!hasMinH) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        violations.push(`Línea ${line}: ${node.getText(sourceFile).slice(0, 80)}...`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { totalButtons, violations };
}

describe('CHALLENGER M3-M4: Verificación Empírica y Pruebas de Estrés Adversarias (R3 & R4)', () => {
  const huancayoCoords = {
    lat: DEFAULT_SECTOR.centerLat, // -12.0528
    lng: DEFAULT_SECTOR.centerLng, // -75.2155
  };

  /* =========================================================================
   * 1. VERIFICACIÓN ESTÁTICA Y DE RENDER: ÁREAS TÁCTILES >= 48px EN TODOS LOS BOTONES
   * ========================================================================= */
  describe('1. Verificación Estricta WCAG AAA: Botones >= 48px (min-h-[48px])', () => {
    it('1.1. Inspección estática AST de proximity-catalog-view.tsx: 100% de los <button> incluyen min-h-[48px]', () => {
      const filePath = path.join(
        process.cwd(),
        'src',
        'components',
        'views',
        'proximity-catalog-view.tsx'
      );
      const { totalButtons, violations } = verifyAllJsxButtonsHaveMinH48(filePath);

      expect(totalButtons).toBeGreaterThanOrEqual(4);
      expect(
        violations,
        `Se encontraron botones sin min-h-[48px] en proximity-catalog-view.tsx:\n${violations.join('\n')}`
      ).toEqual([]);
    });

    it('1.2. Inspección estática AST de pitch-jury-panel.tsx: 100% de los <button> incluyen min-h-[48px]', () => {
      const filePath = path.join(
        process.cwd(),
        'src',
        'components',
        'presentation',
        'pitch-jury-panel.tsx'
      );
      const { totalButtons, violations } = verifyAllJsxButtonsHaveMinH48(filePath);

      expect(totalButtons).toBeGreaterThanOrEqual(7);
      expect(
        violations,
        `Se encontraron botones sin min-h-[48px] en pitch-jury-panel.tsx:\n${violations.join('\n')}`
      ).toEqual([]);
    });

    it('1.3. ProximityCatalogView renderizado en HTML: 100% de los elementos <button> tienen min-h-[48px]', () => {
      const html = renderToStaticMarkup(
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

      const renderedButtons = html.match(/<button\b[^>]*>/g) ?? [];
      expect(renderedButtons.length).toBeGreaterThanOrEqual(5);

      for (const btn of renderedButtons) {
        const isTouchAccessible =
          btn.includes('min-h-[48px]') ||
          btn.includes('min-h-[52px]') ||
          btn.includes('min-h-[56px]');
        expect(isTouchAccessible, `Botón renderizado no cumple min-h-[48px]: ${btn}`).toBe(true);
      }
    });

    it('1.4. PitchJuryPanel renderizado en HTML: botón flotante tiene min-h-[48px]', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModeProvider,
          null,
          React.createElement(PitchJuryPanel)
        )
      );

      const renderedButtons = html.match(/<button\b[^>]*>/g) ?? [];
      expect(renderedButtons.length).toBeGreaterThanOrEqual(1);

      for (const btn of renderedButtons) {
        const isTouchAccessible =
          btn.includes('min-h-[48px]') ||
          btn.includes('min-h-[52px]') ||
          btn.includes('min-h-[56px]');
        expect(isTouchAccessible, `Botón flotante no cumple min-h-[48px]: ${btn}`).toBe(true);
      }
    });
  });

  /* =========================================================================
   * 2. VERIFICACIÓN DE RESILIENCIA SSR EN NODE.JS
   * ========================================================================= */
  describe('2. Resiliencia de Renderizado SSR en Node.js (Sin entorno de navegador)', () => {
    it('2.1. AppShell completo con PitchJuryPanel y HomePage se renderiza en SSR sin excepciones', () => {
      expect(() => {
        const markup = renderToStaticMarkup(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(
              LocationProvider,
              null,
              React.createElement(
                AppShell,
                {
                  activeTab: 'EXPLORAR',
                  onSelectTab: () => {},
                  onOpenQuickPublish: () => {},
                },
                React.createElement(HomePage)
              )
            )
          )
        );

        expect(markup.length).toBeGreaterThan(500);
        expect(markup).toContain('RedVecina');
        expect(markup).toContain('Pitch Jurado (180s)');
        expect(markup).toContain('03:00');
      }).not.toThrow();
    });

    it('2.2. ProximityCatalogView con lista vacía inicial no produce crash en SSR', () => {
      expect(() => {
        const markup = renderToStaticMarkup(
          React.createElement(
            ModeProvider,
            null,
            React.createElement(
              LocationProvider,
              null,
              React.createElement(ProximityCatalogView, {
                initialListings: [],
              })
            )
          )
        );
        expect(markup).toContain('No se encontraron oficios o productos');
      }).not.toThrow();
    });

    it('2.3. PitchJuryPanel con estado de syncManager offline u online no lanza excepciones', () => {
      const testDb = new RedVecinaLocalDB(`TestDb_SsrSync_${Date.now()}`);
      const testSync = new SyncManager(testDb);

      testSync.setOnlineStatus(false);
      expect(() => {
        const markup = renderToStaticMarkup(
          React.createElement(ModeProvider, null, React.createElement(PitchJuryPanel))
        );
        expect(markup).toContain('Pitch Jurado (180s)');
      }).not.toThrow();
    });
  });

  /* =========================================================================
   * 3. PRUEBAS DE ESTRÉS ADVERSARIAL: MILESTONE 3 (FILTRO DE RADIO HIPERLOCAL)
   * ========================================================================= */
  describe('3. Estrés Adversarial M3: Filtro de Radio Hiperlocal y Monotonía Geodésica', () => {
    it('3.1. Invariante Universal de Monotonía en 50 coordenadas aleatorias de prueba', () => {
      // Para CUALQUIER centroide, count(200m) <= count(500m) <= count(1000m) <= count(null)
      const allSampleItems: IListingLocal[] = [
        ...INITIAL_SECTOR_LISTINGS,
        ...HUANCAYO_SECTOR_LISTINGS,
        ...JESUS_MARIA_LISTINGS,
      ];

      for (let i = 0; i < 50; i++) {
        // Coordenadas aleatorias dentro del valle del Mantaro / Lima
        const testLat = -12.0528 + (Math.random() - 0.5) * 0.1;
        const testLng = -75.2155 + (Math.random() - 0.5) * 0.1;

        const count200 = filterItemsByHyperlocalRadius(allSampleItems, testLat, testLng, 200).length;
        const count500 = filterItemsByHyperlocalRadius(allSampleItems, testLat, testLng, 500).length;
        const count1000 = filterItemsByHyperlocalRadius(allSampleItems, testLat, testLng, 1000).length;
        const countNull = filterItemsByHyperlocalRadius(allSampleItems, testLat, testLng, null).length;

        expect(
          count200 <= count500,
          `Violación de monotonía: 200m (${count200}) > 500m (${count500})`
        ).toBe(true);
        expect(
          count500 <= count1000,
          `Violación de monotonía: 500m (${count500}) > 1000m (${count1000})`
        ).toBe(true);
        expect(
          count1000 <= countNull,
          `Violación de monotonía: 1000m (${count1000}) > null (${countNull})`
        ).toBe(true);
        expect(countNull).toBe(allSampleItems.length);
      }
    });

    it('3.2. Límites BVA estrictos: delta de 1 metro en la frontera geodésica', () => {
      // 1 grado latitud ~ 111,139 metros
      // 200 metros ~ 0.0017995 grados
      const baseLat = -12.0528;
      const baseLng = -75.2155;

      const deltaLat200 = 0.001798;
      const itemAt200m: IListingLocal = {
        client_mutation_id: 'adv-200m-exact',
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Oficio en el borde 200m',
        description: 'En el borde exacto.',
        contact_phone: '999',
        latitude: baseLat + deltaLat200,
        longitude: baseLng,
        available_for_emergencies: true,
        endorsement_count: 1,
        weighted_trust_score: 5,
        is_pending_sync: false,
      };

      const deltaLat202 = 0.001815;
      const itemAt202m: IListingLocal = {
        ...itemAt200m,
        client_mutation_id: 'adv-202m-out',
        latitude: baseLat + deltaLat202,
      };

      const d200 = geoCalculateDistanceMeters(baseLat, baseLng, itemAt200m.latitude, itemAt200m.longitude);
      const d202 = geoCalculateDistanceMeters(baseLat, baseLng, itemAt202m.latitude, itemAt202m.longitude);

      expect(d200).toBeLessThanOrEqual(200);
      expect(d202).toBeGreaterThan(200);

      const in200 = filterItemsByHyperlocalRadius([itemAt200m, itemAt202m], baseLat, baseLng, 200);
      expect(in200.length).toBe(1);
      expect(in200[0]?.client_mutation_id).toBe('adv-200m-exact');

      const in500 = filterItemsByHyperlocalRadius([itemAt200m, itemAt202m], baseLat, baseLng, 500);
      expect(in500.length).toBe(2);
    });

    it('3.3. Robustez ante coordenadas inválidas (NaN, null, undefined) en el filtrado', () => {
      const corruptItems = [
        { client_mutation_id: 'c1', title: 'NaN lat', latitude: NaN, longitude: -75.21 } as unknown as IListingLocal,
        { client_mutation_id: 'c2', title: 'null lng', latitude: -12.05, longitude: null as unknown as number } as unknown as IListingLocal,
        { client_mutation_id: 'c3', title: 'no coords' } as unknown as IListingLocal,
      ];

      expect(() => {
        const filtered = filterItemsByHyperlocalRadius(corruptItems, huancayoCoords.lat, huancayoCoords.lng, 500);
        expect(filtered.length).toBe(0);
      }).not.toThrow();

      // En radio null no filtra coordenadas
      const filteredNull = filterItemsByHyperlocalRadius(corruptItems, huancayoCoords.lat, huancayoCoords.lng, null);
      expect(filteredNull.length).toBe(3);
    });

    it('3.4. Conmutación dinámica de sectores territoriales (Huancayo El Tambo -> San Carlos -> Jesús María)', () => {
      const elTamboSector = AVAILABLE_SECTORS.find((s) => s.id === 'huancayo-el-tambo')!;
      const sanCarlosSector = AVAILABLE_SECTORS.find((s) => s.id === 'huancayo-san-carlos')!;
      const jesusMariaSector = AVAILABLE_SECTORS.find((s) => s.id === 'lima-jesus-maria-4')!;

      expect(elTamboSector).toBeDefined();
      expect(sanCarlosSector).toBeDefined();
      expect(jesusMariaSector).toBeDefined();

      const sampleListing = HUANCAYO_SECTOR_LISTINGS[0]!;

      const distElTambo = geoCalculateDistanceMeters(
        elTamboSector.centerLat,
        elTamboSector.centerLng,
        sampleListing.latitude,
        sampleListing.longitude
      );
      const distSanCarlos = geoCalculateDistanceMeters(
        sanCarlosSector.centerLat,
        sanCarlosSector.centerLng,
        sampleListing.latitude,
        sampleListing.longitude
      );
      const distJesusMaria = geoCalculateDistanceMeters(
        jesusMariaSector.centerLat,
        jesusMariaSector.centerLng,
        sampleListing.latitude,
        sampleListing.longitude
      );

      // La distancia a Jesús María (otra región) debe ser > 150 km
      expect(distJesusMaria).toBeGreaterThan(150000);
      // Las distancias locales en Huancayo deben ser < 10 km
      expect(distElTambo).toBeLessThan(10000);
      expect(distSanCarlos).toBeLessThan(10000);
    });
  });

  /* =========================================================================
   * 4. PRUEBAS DE ESTRÉS ADVERSARIAL: MILESTONE 4 (PITCH JURY PANEL 180S)
   * ========================================================================= */
  describe('4. Estrés Adversarial M4: Cronómetro 180s y Simulaciones de Jurado', () => {
    it('4.1. PitchTimerController: sobre-decremento no baja de 00:00 y detiene la marcha', () => {
      const timer = new PitchTimerController();
      timer.start();
      // Tick de 500 segundos (supera los 180s con creces)
      timer.tick(500);

      const state = timer.getState();
      expect(state.remainingSeconds).toBe(0);
      expect(state.isRunning).toBe(false);
      expect(state.statusColor).toBe('CRITICAL');
      expect(formatTimerMmSs(state.remainingSeconds)).toBe('00:00');
    });

    it('4.2. formatTimerMmSs es robusto ante entradas negativas, flotantes y límites superiores', () => {
      expect(formatTimerMmSs(-50)).toBe('00:00');
      expect(formatTimerMmSs(0)).toBe('00:00');
      expect(formatTimerMmSs(179.9)).toBe('02:59');
      expect(formatTimerMmSs(180)).toBe('03:00');
      expect(formatTimerMmSs(3600)).toBe('60:00');
    });

    it('4.3. Transición de color deriveTimerStatusColor en todos los umbrales críticos', () => {
      expect(deriveTimerStatusColor(181)).toBe('NORMAL');
      expect(deriveTimerStatusColor(61)).toBe('NORMAL');
      expect(deriveTimerStatusColor(60)).toBe('WARNING');
      expect(deriveTimerStatusColor(45)).toBe('WARNING');
      expect(deriveTimerStatusColor(30)).toBe('WARNING');
      expect(deriveTimerStatusColor(29)).toBe('CRITICAL');
      expect(deriveTimerStatusColor(1)).toBe('CRITICAL');
      expect(deriveTimerStatusColor(0)).toBe('CRITICAL');
      expect(deriveTimerStatusColor(-5)).toBe('CRITICAL');
    });

    it('4.4. Ciclo completo de controles: Start -> Tick -> Pause -> Tick (ignorado) -> Start -> Reset', () => {
      const timer = new PitchTimerController();
      timer.start();
      timer.tick(30);
      expect(timer.getState().remainingSeconds).toBe(150);

      timer.pause();
      timer.tick(20); // No debe decrementar en pausa
      expect(timer.getState().remainingSeconds).toBe(150);

      timer.start();
      timer.tick(10);
      expect(timer.getState().remainingSeconds).toBe(140);

      timer.reset();
      expect(timer.getState().remainingSeconds).toBe(180);
      expect(timer.getState().isRunning).toBe(false);
      expect(timer.getState().statusColor).toBe('NORMAL');
    });

    it('4.5. Simulación 2: applySpatialBlurring50m garantiza difuminado estricto en [25m, 50m]', () => {
      const lat = -12.0528;
      const lng = -75.2155;

      for (let i = 0; i < 50; i++) {
        const seed = `adversarial-pitch-seed-${i}`;
        const blurred = applySpatialBlurring50m(lat, lng, seed);
        const dist = geoCalculateDistanceMeters(lat, lng, blurred.blurredLat, blurred.blurredLng);

        expect(dist).toBeLessThanOrEqual(50);
        expect(dist).toBeGreaterThanOrEqual(25);
        expect(blurred.radiusMeters).toBe(50);
      }
    });

    it('4.6. Simulación 3 (Bóveda PII): Rechazo riguroso por roles no autorizados', () => {
      const unauthorizedRoles: SystemRole[] = ['VECINO'];

      for (const role of unauthorizedRoles) {
        const res = executePiiVaultUnlock({
          postId: 10,
          userRole: role,
          userName: 'Usuario No Autorizado',
          accessReason: 'Razón de prueba válida de más de 10 caracteres',
          protectedAddress: 'Jr. Puno 420 Huancayo',
          protectedPhone: '964-111-222',
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain('ACCESO_DENEGADO');
        expect(res.data).toBeUndefined();
      }
    });

    it('4.7. Simulación 3 (Bóveda PII): Rechazo riguroso por justificaciones inválidas (espacios, <10 caracteres)', () => {
      const invalidReasons = [
        '',
        '   ',
        'Ayuda',
        '123456789', // 9 caracteres
        '   123456789   ', // 9 caracteres tras trim
      ];

      for (const reason of invalidReasons) {
        const res = executePiiVaultUnlock({
          postId: 10,
          userRole: 'BRIGADISTA_CERTIFICADO',
          userName: 'Brigadista Mario',
          accessReason: reason,
          protectedAddress: 'Jr. Puno 420 Huancayo',
          protectedPhone: '964-111-222',
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain('JUSTIFICACION_INSUFICIENTE');
        expect(res.data).toBeUndefined();
      }
    });

    it('4.8. Simulación 3 (Bóveda PII): Aprobación con constancia legal Ley N° 29733 Art. 17 para Brigadista y Operador', () => {
      const authorizedRoles: SystemRole[] = ['BRIGADISTA_CERTIFICADO', 'OPERADOR_MUNICIPAL'];

      for (const role of authorizedRoles) {
        const res = executePiiVaultUnlock({
          postId: 10,
          userRole: role,
          userName: `Oficial Acreditado (${role})`,
          accessReason: 'Suministro urgente de concentrador de oxígeno para paciente con EPOC severo.',
          protectedAddress: 'Jr. Puno 420 Huancayo',
          protectedPhone: '964-111-222',
        });

        expect(res.success).toBe(true);
        expect(res.data).toBeDefined();
        expect(res.data?.exact_address).toBe('Jr. Puno 420 Huancayo');
        expect(res.data?.contact_phone).toBe('964-111-222');
        expect(res.auditRecord?.compliance_legal).toBe('LEY_29733_ART_17');
        expect(res.auditRecord?.requester_role).toBe(role);
      }
    });
  });
});
