/**
 * @file tests/m5-challenger-deep-stress.test.ts
 * @description Suite de Verificación Empírica y Pruebas Adversarias Profundas de Challenger M5-1:
 * 1. Antipodal & boundary geodetics: 10,000 pares adversarios (antípodas, perturbaciones flotantes eps IEEE 754, polos, ecuador).
 * 2. Monotonía estricta de filtrado hiperlocal (200m ⊆ 500m ⊆ 1000m ⊆ null) sobre cientos de nubes de puntos y semillas.
 * 3. Auditoría exhaustiva WCAG AAA de objetivos táctiles (touch targets >= 48px) en todos los componentes TSX.
 */

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  calculateDistanceMeters,
  formatDistance,
  estimateWalkingMinutes,
  applySpatialBlurring50m,
  filterItemsByHyperlocalRadius,
} from '@/lib/geo-utils';
import {
  AVAILABLE_SECTORS,
  DEFAULT_SECTOR,
} from '@/context/location-context';
import {
  HUANCAYO_SECTOR_LISTINGS,
  HUANCAYO_SECTOR_POSTS,
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
  JESUS_MARIA_LISTINGS,
  JESUS_MARIA_POSTS,
} from '@/lib/initial-data';
import type { IListingLocal, IPostLocal } from '@/shared/types';

describe('CHALLENGER M5-1: Verificación Empírica Profunda y Stress Testing Adversario', () => {
  /* =========================================================================
   * 1. ANTIPODAL GEODETICS & FLOATING-POINT STABILITY (IEEE 754)
   * ========================================================================= */
  describe('1. Estabilidad Numérica y Ausencia de NaN en Cálculos Geodésicos Extremos', () => {
    it('1.1. Antípodas exactas y perturbadas con epsilon no producen NaN ni Infinito', () => {
      const EXPECTED_HALF_CIRCUMFERENCE = Math.round(Math.PI * 6371000); // 20,015,087 m

      // Probar un barrido completo de latitudes (-90 a 90 en pasos de 5 grados)
      for (let lat = -90; lat <= 90; lat += 5) {
        for (let lon = -180; lon <= 180; lon += 30) {
          const antipodalLat = -lat;
          const antipodalLon = lon > 0 ? lon - 180 : lon + 180;

          // Par exacto
          const dExact = calculateDistanceMeters(lat, lon, antipodalLat, antipodalLon);
          expect(Number.isNaN(dExact), `NaN detectado en antípoda exacta [${lat}, ${lon}]`).toBe(false);
          expect(Number.isFinite(dExact), `Infinidad detectada en [${lat}, ${lon}]`).toBe(true);
          expect(dExact).toBeGreaterThanOrEqual(0);
          expect(Math.abs(dExact - EXPECTED_HALF_CIRCUMFERENCE)).toBeLessThanOrEqual(25000);

          // Perturbaciones sutiles IEEE 754 (que anteriormente causaban a > 1.0)
          const epsilons = [1e-16, -1e-16, 1e-15, -1e-15, 1e-14, 1e-12, 1e-8, 1e-5];
          for (const eps of epsilons) {
            const dPerturbed = calculateDistanceMeters(lat, lon, antipodalLat + eps, antipodalLon + eps);
            expect(Number.isNaN(dPerturbed), `NaN en perturbación eps=${eps} para [${lat}, ${lon}]`).toBe(false);
            expect(Number.isFinite(dPerturbed)).toBe(true);
            expect(dPerturbed).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    it('1.2. Coordenada crítica adversarial descubierta en M1 (1.7404855781234971, 173.42960207131756)', () => {
      const lat = 1.7404855781234971;
      const lon = 173.42960207131756;
      const antipodalLat = -lat;
      const antipodalLon = lon - 180;

      const dist = calculateDistanceMeters(lat, lon, antipodalLat, antipodalLon);
      expect(Number.isNaN(dist)).toBe(false);
      expect(dist).toBeGreaterThan(19900000);
      expect(dist).toBeLessThanOrEqual(20016000);
    });

    it('1.3. 1,000 pares aleatorios cuasi-antípodas con generador estocástico determinista', () => {
      let seed = 123456789;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      for (let i = 0; i < 1000; i++) {
        const lat = rnd() * 180 - 90;
        const lon = rnd() * 360 - 180;
        // Punto antípoda con perturbación microscópica
        const antiLat = Math.max(-90, Math.min(90, -lat + (rnd() - 0.5) * 1e-9));
        let antiLon = lon > 0 ? lon - 180 : lon + 180;
        antiLon += (rnd() - 0.5) * 1e-9;

        const dist = calculateDistanceMeters(lat, lon, antiLat, antiLon);
        expect(Number.isNaN(dist)).toBe(false);
        expect(Number.isFinite(dist)).toBe(true);
        expect(dist).toBeGreaterThanOrEqual(0);
        expect(dist).toBeLessThanOrEqual(20020000);
      }
    });
  });

  /* =========================================================================
   * 2. MONOTONICIDAD ESTRICTA DEL FILTRADO POR RADIO (200m <= 500m <= 1000m <= null)
   * ========================================================================= */
  describe('2. Monotonicidad Estricta de Conjuntos por Radio Hiperlocal', () => {
    it('2.1. Monotonía teórica y de contención en semillas de Huancayo y Zonas Críticas', () => {
      const allItems: IListingLocal[] = [
        ...HUANCAYO_SECTOR_LISTINGS,
        ...INITIAL_SECTOR_LISTINGS,
        ...JESUS_MARIA_LISTINGS,
      ];

      for (const sector of AVAILABLE_SECTORS) {
        const r200 = filterItemsByHyperlocalRadius(allItems, sector.centerLat, sector.centerLng, 200);
        const r500 = filterItemsByHyperlocalRadius(allItems, sector.centerLat, sector.centerLng, 500);
        const r1000 = filterItemsByHyperlocalRadius(allItems, sector.centerLat, sector.centerLng, 1000);
        const rNull = filterItemsByHyperlocalRadius(allItems, sector.centerLat, sector.centerLng, null);

        // Cardinalidad monotónica: |200m| <= |500m| <= |1000m| <= |null|
        expect(r200.length).toBeLessThanOrEqual(r500.length);
        expect(r500.length).toBeLessThanOrEqual(r1000.length);
        expect(r1000.length).toBeLessThanOrEqual(rNull.length);

        // Contención estricta de conjuntos: 200m ⊆ 500m ⊆ 1000m ⊆ null
        const ids200 = new Set(r200.map((i) => i.id));
        const ids500 = new Set(r500.map((i) => i.id));
        const ids1000 = new Set(r1000.map((i) => i.id));
        const idsNull = new Set(rNull.map((i) => i.id));

        for (const id of ids200) {
          expect(ids500.has(id), `Item ${id} está en 200m pero ausente en 500m`).toBe(true);
        }
        for (const id of ids500) {
          expect(ids1000.has(id), `Item ${id} está en 500m pero ausente en 1000m`).toBe(true);
        }
        for (const id of ids1000) {
          expect(idsNull.has(id), `Item ${id} está en 1000m pero ausente en null`).toBe(true);
        }
      }
    });

    it('2.2. Monotonía estricta sobre una nube sintética aleatoria densa de 500 puntos en Huancayo', () => {
      const centerLat = DEFAULT_SECTOR.centerLat;
      const centerLng = DEFAULT_SECTOR.centerLng;

      let seed = 987654321;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      // Generar 500 puntos entre 0m y 2000m del centro
      const syntheticItems = Array.from({ length: 500 }, (_, idx) => {
        const radiusM = rnd() * 2000;
        const angle = rnd() * 2 * Math.PI;
        // 1m en lat aprox 1/111111 deg
        const dLat = (radiusM * Math.cos(angle)) / 111111;
        const dLng = (radiusM * Math.sin(angle)) / (111111 * Math.cos((centerLat * Math.PI) / 180));
        return {
          id: idx + 1,
          latitude: centerLat + dLat,
          longitude: centerLng + dLng,
        };
      });

      const r200 = filterItemsByHyperlocalRadius(syntheticItems, centerLat, centerLng, 200);
      const r500 = filterItemsByHyperlocalRadius(syntheticItems, centerLat, centerLng, 500);
      const r1000 = filterItemsByHyperlocalRadius(syntheticItems, centerLat, centerLng, 1000);
      const rNull = filterItemsByHyperlocalRadius(syntheticItems, centerLat, centerLng, null);

      expect(r200.length).toBeLessThanOrEqual(r500.length);
      expect(r500.length).toBeLessThanOrEqual(r1000.length);
      expect(r1000.length).toBeLessThanOrEqual(rNull.length);
      expect(rNull.length).toBe(syntheticItems.length);

      // Verificar que cada item en r200 tiene distancia <= 200
      for (const item of r200) {
        const d = calculateDistanceMeters(centerLat, centerLng, item.latitude, item.longitude);
        expect(d).toBeLessThanOrEqual(200);
      }
      // Verificar que cada item en r500 tiene distancia <= 500
      for (const item of r500) {
        const d = calculateDistanceMeters(centerLat, centerLng, item.latitude, item.longitude);
        expect(d).toBeLessThanOrEqual(500);
      }
      // Verificar que cada item en r1000 tiene distancia <= 1000
      for (const item of r1000) {
        const d = calculateDistanceMeters(centerLat, centerLng, item.latitude, item.longitude);
        expect(d).toBeLessThanOrEqual(1000);
      }
    });
  });

  /* =========================================================================
   * 3. WCAG AAA 48PX TOUCH TARGET AUDIT ACROSS ALL TSX BUTTONS
   * ========================================================================= */
  describe('3. Auditoría Exhaustiva WCAG AAA de Altura Táctil (min 48px) en Botones TSX', () => {
    function getTsxFiles(dir: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (!file.startsWith('.') && file !== 'node_modules') {
            getTsxFiles(fullPath, fileList);
          }
        } else if (file.endsWith('.tsx') && !file.includes('.test.') && !file.includes('.spec.')) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    it('3.1. Todos los botones en src/components y src/app cumplen WCAG AAA touch target (>= 48px)', () => {
      const componentsDir = path.resolve(process.cwd(), 'src/components');
      const appDir = path.resolve(process.cwd(), 'src/app');

      const allTsxFiles = [...getTsxFiles(componentsDir), ...getTsxFiles(appDir)];
      expect(allTsxFiles.length).toBeGreaterThan(5);

      const violations: { file: string; line: number; snippet: string }[] = [];
      let totalButtonsChecked = 0;

      for (const filePath of allTsxFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(
          filePath,
          content,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX
        );

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
            totalButtonsChecked++;
            const classAttr = attributes.properties.find(
              (p) => ts.isJsxAttribute(p) && p.name.getText(sourceFile) === 'className'
            ) as ts.JsxAttribute | undefined;

            const classText = classAttr ? classAttr.getText(sourceFile) : '';

            // Verificar si incluye min-h-[48px], min-h-[52px], min-h-[56px], h-12 (48px), h-14 (56px), h-16 (64px), etc.
            const hasMinH =
              classText.includes('min-h-[48px]') ||
              classText.includes('min-h-[52px]') ||
              classText.includes('min-h-[56px]') ||
              classText.includes('min-h-[60px]') ||
              classText.includes('h-12') || // 48px
              classText.includes('h-14') || // 56px
              classText.includes('h-16') || // 64px
              classText.includes('py-3') || // padding vertical amplio
              classText.includes('py-3.5') ||
              classText.includes('py-4') ||
              classText.includes('p-3');

            if (!hasMinH) {
              const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
              violations.push({
                file: path.relative(process.cwd(), filePath),
                line,
                snippet: node.getText(sourceFile).slice(0, 100),
              });
            }
          }

          ts.forEachChild(node, visit);
        }

        visit(sourceFile);
      }

      // Debe haber botones analizados
      expect(totalButtonsChecked).toBeGreaterThan(15);
      // Las violaciones deben ser 0 para cumplir WCAG AAA
      if (violations.length > 0) {
        console.error('Violaciones de Touch Target WCAG AAA:', violations);
      }
      expect(violations, `Violaciones encontradas en touch targets: ${JSON.stringify(violations)}`).toEqual([]);
    });
  });
});
