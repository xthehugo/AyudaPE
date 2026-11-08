import { describe, expect, it } from 'vitest';
import {
  applySpatialBlurring50m,
  calculateDistanceMeters,
  estimateWalkingMinutes,
  formatDistance,
} from '../geo-utils';

describe('GeoUtils: Cálculos Geodésicos, Tiempos de Caminata y Difuminado Espacial 50m', () => {
  it('1. Calcula distancia geodésica Haversine precisa entre dos puntos', () => {
    // Mismo punto exacto: distancia 0m
    const samePointDist = calculateDistanceMeters(-12.0528, -75.2155, -12.0528, -75.2155);
    expect(samePointDist).toBe(0);

    // Huancayo El Tambo (-12.0528, -75.2155) a Huancayo San Carlos (-12.0625, -75.2005)
    const distElTamboToSanCarlos = calculateDistanceMeters(-12.0528, -75.2155, -12.0625, -75.2005);
    // Distancia real aproximada: entre 1900m y 2100m
    expect(distElTamboToSanCarlos).toBeGreaterThan(1800);
    expect(distElTamboToSanCarlos).toBeLessThan(2200);

    // Huancayo El Tambo a Lima Jesús María (-12.0752, -77.0485)
    const distHuancayoToLima = calculateDistanceMeters(-12.0528, -75.2155, -12.0752, -77.0485);
    // Distancia real aproximada: ~199 km (198,000m - 202,000m)
    expect(distHuancayoToLima).toBeGreaterThan(190000);
    expect(distHuancayoToLima).toBeLessThan(210000);
  });

  it('2. Formatea distancias métricas de forma accesible y legible ("180 m", "1.4 km")', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(45)).toBe('45 m');
    expect(formatDistance(180)).toBe('180 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1400)).toBe('1.4 km');
    expect(formatDistance(2500)).toBe('2.5 km');
    expect(formatDistance(-10)).toBe('0 m');
  });

  it('3. Estima tiempo a pie en minutos basado en velocidad urbana de 4.5 km/h (75 m/min)', () => {
    expect(estimateWalkingMinutes(0)).toBe(0);
    expect(estimateWalkingMinutes(-50)).toBe(0);
    expect(estimateWalkingMinutes(30)).toBe(1); // Mínimo 1 minuto para distancias cortas > 0
    expect(estimateWalkingMinutes(75)).toBe(1);
    expect(estimateWalkingMinutes(150)).toBe(2);
    expect(estimateWalkingMinutes(375)).toBe(5);
    expect(estimateWalkingMinutes(750)).toBe(10);
    expect(estimateWalkingMinutes(1500)).toBe(20);
  });

  it('4. Aplica difuminado espacial de 50 metros determinista para resguardo de privacidad (Ley N° 29733)', () => {
    const originalLat = -12.048;
    const originalLng = -75.195;
    const seed = 'alerta-sos-huaytapallana-01';

    const result = applySpatialBlurring50m(originalLat, originalLng, seed);

    expect(result.radiusMeters).toBe(50);
    expect(result.blurredLat).toBeDefined();
    expect(result.blurredLng).toBeDefined();
    expect(result.public_lat).toBe(result.blurredLat);
    expect(result.public_lng).toBe(result.blurredLng);

    // La distancia entre la coordenada exacta y la coordenada difuminada debe ser <= 50 metros
    const distanceMeters = calculateDistanceMeters(
      originalLat,
      originalLng,
      result.blurredLat,
      result.blurredLng
    );
    expect(distanceMeters).toBeGreaterThanOrEqual(30);
    expect(distanceMeters).toBeLessThanOrEqual(50);

    // Debe ser determinista: misma entrada con misma semilla arroja exactamente el mismo resultado
    const repeatResult = applySpatialBlurring50m(originalLat, originalLng, seed);
    expect(repeatResult.blurredLat).toBe(result.blurredLat);
    expect(repeatResult.blurredLng).toBe(result.blurredLng);

    // Diferente semilla arroja diferente desplazamiento
    const differentResult = applySpatialBlurring50m(originalLat, originalLng, 'otra-semilla-diferente');
    expect(differentResult.blurredLat).not.toBe(result.blurredLat);
  });
});
