import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_SECTORS,
  DEFAULT_SECTOR,
} from '@/context/location-context';
import { parseNeighborIntent } from '@/lib/ai/ai-orchestrator';
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
} from '@/lib/initial-data';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import { SyncManager } from '@/lib/offline/sync-manager';
import { MONEY_REGEX } from '@/shared/schemas';
import type { IListingLocal } from '@/shared/types';
import {
  deriveTimerStatusColor,
  executePiiVaultUnlock,
  filterItemsByHyperlocalRadius,
  formatTimerMmSs,
  PitchTimerController,
} from './e2e-test-helpers';

describe('R5: Escenarios de Aplicación en el Mundo Real (Tier 4)', () => {
  /* =========================================================================
   * ESCENARIO 1: SISMO EN FALLA HUAYTAPALLANA (HUANCAYO)
   * ========================================================================= */
  it('Escenario 1: Sismo en Falla Huaytapallana — Conmutación a Huancayo, corte de luz/red, navegación offline de balones de oxígeno y brigadas vecinales (F1, F4, F5, F12)', async () => {
    // 1. Conmutación territorial a Zona Crítica de Sismos en Huancayo
    const huaytapallanaSector = AVAILABLE_SECTORS.find(
      (s) => s.id === 'zona-critica-huaytapallana'
    );
    expect(huaytapallanaSector).toBeDefined();
    expect(huaytapallanaSector?.isCatastropheZone).toBe(true);
    expect(huaytapallanaSector?.department).toBe('Junín');

    const epicenterCoords = {
      lat: huaytapallanaSector!.centerLat,
      lng: huaytapallanaSector!.centerLng,
    };

    // 2. Pérdida total de conectividad por el movimiento telúrico (Modo Avión)
    const db = new RedVecinaLocalDB(`TestDb_Escenario1_${Date.now()}`);
    await db.bulkCacheListings([...INITIAL_SECTOR_LISTINGS, ...HUANCAYO_SECTOR_LISTINGS]);
    await db.bulkCachePosts([...INITIAL_SECTOR_POSTS, ...HUANCAYO_SECTOR_POSTS]);

    const syncMgr = new SyncManager(db);
    syncMgr.setOnlineStatus(false);
    expect(syncMgr.getState().isOnline).toBe(false);

    // 3. Consulta y navegación offline: localizar brigadas y soporte de oxígeno
    const cachedListings = await db.listings.toArray();
    const emergencyResources = cachedListings.filter(
      (l) => l.available_for_emergencies === true
    );
    expect(emergencyResources.length).toBeGreaterThanOrEqual(4);

    // Encontrar la brigada de rescate y oxígeno más cercana al epicentro
    const resourcesWithDistance = emergencyResources.map((item) => {
      const distance = calculateDistanceMeters(
        epicenterCoords.lat,
        epicenterCoords.lng,
        item.latitude,
        item.longitude
      );
      return {
        ...item,
        distanceMeters: distance,
        walkingMinutes: estimateWalkingMinutes(distance),
        distanceText: formatDistance(distance),
      };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);

    const closestBrigade = resourcesWithDistance[0]!;
    expect(closestBrigade).toBeDefined();
    expect(closestBrigade.distanceMeters).toBeGreaterThan(0);
    expect(closestBrigade.walkingMinutes).toBeGreaterThanOrEqual(1);

    // 4. Registro local de necesidad de brigada en la cola outbox mientras continúa sin red
    const outboxId = await db.enqueueMutation('/api/v1/posts', 'POST', {
      title: 'Auxilio Sismo Falla Huaytapallana',
      description: 'Derrumbe parcial de pirca en zona alta, se requiere apoyo de brigada.',
      urgency_level: 'ALTA',
      operational_mode: 'EMERGENCIA',
      lat: epicenterCoords.lat,
      lng: epicenterCoords.lng,
    });

    const pendingMutations = await db.getPendingMutations();
    expect(pendingMutations.length).toBe(1);
    expect(pendingMutations[0]?.client_mutation_id).toBe(outboxId);
  });

  /* =========================================================================
   * ESCENARIO 2: EMERGENCIA SOS ADULTO MAYOR ELECTRODEPENDIENTE EN EL TAMBO
   * ========================================================================= */
  it('Escenario 2: Emergencia SOS Adulto Mayor electrodependiente en El Tambo con solicitud de oxígeno, difuminado a 50m y rescate auditado por Brigadista (F4, F6, F7, F13, F14)', async () => {
    const elTamboCoords = {
      lat: DEFAULT_SECTOR.centerLat,
      lng: DEFAULT_SECTOR.centerLng,
    };

    // 1. Vecino reporta por voz solicitud de oxígeno para paciente de 82 años
    const voiceAudioText =
      'Auxilio urgente por favor, mi abuelita de 82 años es electrodependiente y se cortó la luz en Jr. Parra del Riego 742 El Tambo, su balón de oxígeno se acaba en 20 minutos, llamar al 964-888-777';

    const intent = await parseNeighborIntent(voiceAudioText, 'EMERGENCIA');
    expect(intent.post_type).toBe('SOS_VULNERABLE');
    expect(intent.urgency).toBe('CRITICA');
    expect(intent.is_pii_redacted).toBe(true);

    // 2. Perturbación geográfica de 50 metros para proteger la vivienda
    const exactLat = -12.0522;
    const exactLng = -75.2148;
    const blurred = applySpatialBlurring50m(exactLat, exactLng, 'el-tambo-oxigeno-sos');
    expect(blurred.radiusMeters).toBe(50);

    const distanceBlur = calculateDistanceMeters(
      exactLat,
      exactLng,
      blurred.blurredLat,
      blurred.blurredLng
    );
    expect(distanceBlur).toBeLessThanOrEqual(50);

    // 3. Persistir post SOS difuminado en base local
    const db = new RedVecinaLocalDB(`TestDb_Escenario2_${Date.now()}`);
    const postId = await db.posts.put({
      client_mutation_id: 'sos-electrodependiente-el-tambo-1',
      sector_id: 1,
      category_id: 4,
      operational_mode: 'EMERGENCIA',
      post_type: 'SOS_VULNERABLE',
      title: 'SOS Oxígeno Adulto Mayor Electrodependiente',
      description:
        'Vecina de 82 años requiere soporte de oxígeno por corte de energía eléctrica en [DIRECCIÓN EXACTA PROTEGIDA - LEY 29733].',
      urgency_level: 'CRITICA',
      public_lat: blurred.blurredLat,
      public_lng: blurred.blurredLng,
      privacy_radius_meters: 50,
      status: 'ACTIVO',
      client_created_at: new Date().toISOString(),
      is_pending_sync: false,
    });

    // 4. Intento fallido de usuario ordinario (VECINO)
    const neighborAttempt = executePiiVaultUnlock({
      postId,
      userRole: 'VECINO',
      userName: 'Vecino del frente',
      accessReason: 'Quiero saber qué casa es para mirar.',
      protectedAddress: 'Jr. Parra del Riego 742, El Tambo',
      protectedPhone: '964-888-777',
    });
    expect(neighborAttempt.success).toBe(false);

    // 5. Desbloqueo auditado por Brigadista Certificado
    const brigadistaUnlock = executePiiVaultUnlock({
      postId,
      userRole: 'BRIGADISTA_CERTIFICADO',
      userName: 'Lic. Maritza (Brigadista de Salud El Tambo)',
      accessReason:
        'Despliegue inmediato de cuadrilla con balón de oxígeno de 10m3 y oxímetro pediátrico/adulto.',
      protectedAddress: 'Jr. Parra del Riego 742, El Tambo',
      protectedPhone: '964-888-777',
    });

    expect(brigadistaUnlock.success).toBe(true);
    expect(brigadistaUnlock.data?.exact_address).toBe('Jr. Parra del Riego 742, El Tambo');
    expect(brigadistaUnlock.data?.contact_phone).toBe('964-888-777');
    expect(brigadistaUnlock.auditRecord?.compliance_legal).toBe('LEY_29733_ART_17');

    // 6. Tiempos de rescate estimados a pie
    const walkingMinutes = estimateWalkingMinutes(
      calculateDistanceMeters(elTamboCoords.lat, elTamboCoords.lng, exactLat, exactLng)
    );
    expect(walkingMinutes).toBeGreaterThanOrEqual(1);
  });

  /* =========================================================================
   * ESCENARIO 3: RUTINA VECINAL MATUTINA (ECONOMÍA SOLIDARIA Y COMUNITARIA)
   * ========================================================================= */
  it('Escenario 3: Rutina vecinal matutina — Solicitud de muletas ortopédicas sin costo, coordinación de carpooling escolar y pedido de lasañas de la vecina (F1, F2, F3, F9, F10)', () => {
    const elTamboCoords = {
      lat: DEFAULT_SECTOR.centerLat,
      lng: DEFAULT_SECTOR.centerLng,
    };

    // 1. Muro Solidario: Localizar préstamo gratuito de muletas ortopédicas
    const allPosts = [...INITIAL_SECTOR_POSTS, ...HUANCAYO_SECTOR_POSTS];
    const muletasPost = allPosts.find(
      (p) =>
        p.title.toLowerCase().includes('muletas') &&
        p.post_type === 'OFERTA_FAVOR'
    );
    expect(muletasPost).toBeDefined();
    expect(MONEY_REGEX.test(muletasPost!.description)).toBe(false);

    // 2. Coordinación de Carpooling / Pool escolar vecinal verificado
    const poolPost = allPosts.find((p) =>
      p.title.toLowerCase().includes('pool escolar')
    );
    expect(poolPost).toBeDefined();
    expect(poolPost?.post_type).toBe('OFERTA_FAVOR');

    // 3. Catálogo de Proximidad: Lasañas caseras y postres de la vecina Gladys
    const allListings = [...INITIAL_SECTOR_LISTINGS, ...HUANCAYO_SECTOR_LISTINGS];
    const lasanaListing = allListings.find(
      (l) =>
        l.title.toLowerCase().includes('lasañas') &&
        (l.title.includes('Gladys') || l.title.includes('Elena'))
    );
    expect(lasanaListing).toBeDefined();
    expect(lasanaListing?.listing_type).toBe('PRODUCTO_LOCAL');

    // 4. Aplicar selector de radio hiperlocal (500m · Mi barrio)
    const in500m = filterItemsByHyperlocalRadius(
      allListings,
      elTamboCoords.lat,
      elTamboCoords.lng,
      500
    );

    expect(in500m.length).toBeGreaterThan(0);
    for (const item of in500m) {
      const dist = calculateDistanceMeters(
        elTamboCoords.lat,
        elTamboCoords.lng,
        item.latitude,
        item.longitude
      );
      expect(dist).toBeLessThanOrEqual(500);
      expect(estimateWalkingMinutes(dist)).toBeLessThanOrEqual(8);
    }
  });

  /* =========================================================================
   * ESCENARIO 4: BÚSQUEDA POR PROXIMIDAD ESTRICTA (200M) POR HELADA EN EL TAMBO
   * ========================================================================= */
  it('Escenario 4: Búsqueda por proximidad estricta en Mi Cuadra (200m) filtrando gasfitería ante tubería rota por heladas en El Tambo (F1, F3, F6, F9, F10)', () => {
    // 6:00 a.m. en El Tambo: helada andina revienta tubería en Jr. Parra del Riego
    const neighborCoords = {
      lat: -12.0528,
      lng: -75.2155,
    };

    const allListings = [...INITIAL_SECTOR_LISTINGS, ...HUANCAYO_SECTOR_LISTINGS];

    // 1. Vecino activa filtro estricto de proximidad: "200m · Mi cuadra"
    const listingsWithin200m = filterItemsByHyperlocalRadius(
      allListings,
      neighborCoords.lat,
      neighborCoords.lng,
      200
    );

    // 2. Filtrar por oficio de gasfitería para emergencias (category_id = 1)
    const gasfiterosInBlock = listingsWithin200m.filter(
      (l) => l.category_id === 1 && l.available_for_emergencies === true
    );

    expect(gasfiterosInBlock.length).toBeGreaterThanOrEqual(1);
    const chosenGasfitero = gasfiterosInBlock[0]!;

    expect(chosenGasfitero.title).toContain('Gasfitería');
    expect(chosenGasfitero.contact_phone).toBeDefined();

    // 3. Confirmar que la distancia calculada es hiperlocal (< 200m)
    const distanceMeters = calculateDistanceMeters(
      neighborCoords.lat,
      neighborCoords.lng,
      chosenGasfitero.latitude,
      chosenGasfitero.longitude
    );
    expect(distanceMeters).toBeLessThanOrEqual(200);

    // 4. Tiempo de llegada a pie para el vecino
    const walkingMinutes = estimateWalkingMinutes(distanceMeters);
    expect(walkingMinutes).toBeLessThanOrEqual(3);
    expect(formatDistance(distanceMeters)).toContain('m');
  });

  /* =========================================================================
   * ESCENARIO 5: PITCH EN VIVO DE 180 SEGUNDOS ANTE EL JURADO
   * ========================================================================= */
  it('Escenario 5: Pitch en vivo de 180 segundos ante el jurado ejecutando las 3 simulaciones secuencialmente sin recargar la app (F11, F12, F13, F14)', async () => {
    // 1. Iniciar el cronómetro de 180 segundos (3 minutos)
    const timer = new PitchTimerController();
    timer.start();
    expect(timer.getState().remainingSeconds).toBe(180);
    expect(timer.getState().statusColor).toBe('NORMAL');

    // Transcurren 15 segundos de introducción
    timer.tick(15);
    expect(timer.getState().remainingSeconds).toBe(165);

    // 2. Disparar Simulación 1: Modo Avión / Sin Red en 1 Clic
    const db = new RedVecinaLocalDB(`TestDb_PitchScenario_${Date.now()}`);
    const syncMgr = new SyncManager(db);
    syncMgr.setOnlineStatus(false);
    expect(syncMgr.getState().isOnline).toBe(false);

    // Transcurren 25 segundos demostrando navegación offline
    timer.tick(25);
    expect(timer.getState().remainingSeconds).toBe(140);

    // 3. Disparar Simulación 2: SOS Voz con Difuminado a 50m
    const voiceDemo =
      'Auxilio urgente en Jr. Huiracocha 1488, se necesita balón de oxígeno medicinal para vecino con asma severa';
    const intent = await parseNeighborIntent(voiceDemo, 'EMERGENCIA');
    expect(intent.post_type).toBe('SOS_VULNERABLE');

    const blurredCoords = applySpatialBlurring50m(-12.0528, -75.2155, 'jury-live-pitch');
    expect(blurredCoords.radiusMeters).toBe(50);

    // Transcurren 35 segundos demostrando el círculo de privacidad difuminado
    timer.tick(35);
    expect(timer.getState().remainingSeconds).toBe(105);

    // 4. Disparar Simulación 3: Desbloqueo auditado de Bóveda PII por Brigadista
    const unlockDemo = executePiiVaultUnlock({
      postId: 10,
      userRole: 'BRIGADISTA_CERTIFICADO',
      userName: 'Brigadista Expositor Pitch',
      accessReason:
        'Demostración en vivo ante jurado del desbloqueo forense auditado bajo Ley N° 29733.',
      protectedAddress: 'Jr. Huiracocha 1488 Dpto 201',
      protectedPhone: '987-111-222',
    });

    expect(unlockDemo.success).toBe(true);
    expect(unlockDemo.auditRecord?.compliance_legal).toBe('LEY_29733_ART_17');

    // Transcurren 20 segundos de cierre de la presentación
    timer.tick(20);
    expect(timer.getState().remainingSeconds).toBe(85);

    // 5. Pausar el cronómetro antes de que se agoten los 180 segundos
    timer.pause();
    expect(timer.getState().isRunning).toBe(false);
    expect(timer.getState().remainingSeconds).toBe(85);
    expect(formatTimerMmSs(timer.getState().remainingSeconds)).toBe('01:25');
    expect(deriveTimerStatusColor(timer.getState().remainingSeconds)).toBe('NORMAL');
  });
});
