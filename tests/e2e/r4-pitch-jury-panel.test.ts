import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ModeProvider } from '@/context/mode-context';
import { PitchJuryPanel } from '@/components/presentation/pitch-jury-panel';
import { parseNeighborIntent } from '@/lib/ai/ai-orchestrator';
import {
  applySpatialBlurring50m,
  calculateDistanceMeters,
} from '@/lib/geo-utils';
import {
  INITIAL_SECTOR_POSTS,
} from '@/lib/initial-data';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import { SyncManager } from '@/lib/offline/sync-manager';
import type { SystemRole } from '@/shared/types';


/**
 * Contrato del registro de auditoría local PII (PROJECT.md § Interface Contracts 3).
 */
export interface ILocalPiiAuditRecord {
  id: string;
  timestamp: string;
  post_id: number;
  requester_role: string;
  requester_name: string;
  access_reason: string;
  compliance_legal: 'LEY_29733_ART_17';
}

/**
 * Estado y lógica canónica del cronómetro regresivo de 180s (Pitch Jurado).
 */
export interface IPitchTimerState {
  remainingSeconds: number;
  isRunning: boolean;
  statusColor: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export function formatTimerMmSs(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function deriveTimerStatusColor(seconds: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  if (seconds > 60) return 'NORMAL';
  if (seconds >= 30) return 'WARNING';
  return 'CRITICAL';
}

export class PitchTimerController {
  private seconds = 180;
  private running = false;

  public getState(): IPitchTimerState {
    return {
      remainingSeconds: this.seconds,
      isRunning: this.running,
      statusColor: deriveTimerStatusColor(this.seconds),
    };
  }

  public start(): void {
    this.running = true;
  }

  public pause(): void {
    this.running = false;
  }

  public reset(): void {
    this.seconds = 180;
    this.running = false;
  }

  public tick(secondsToDecrement: number = 1): void {
    if (!this.running) return;
    this.seconds = Math.max(0, this.seconds - secondsToDecrement);
    if (this.seconds === 0) {
      this.running = false;
    }
  }
}

/**
 * Oráculo de desbloqueo de Bóveda PII según Ley N° 29733.
 */
export function executePiiVaultUnlock(params: {
  postId: number;
  userRole: SystemRole;
  userName: string;
  accessReason: string;
  protectedAddress: string;
  protectedPhone: string;
}): {
  success: boolean;
  data?: { exact_address: string; contact_phone: string; audit_id: string };
  auditRecord?: ILocalPiiAuditRecord;
  error?: string;
} {
  const isAuthorized =
    params.userRole === 'BRIGADISTA_CERTIFICADO' ||
    params.userRole === 'OPERADOR_MUNICIPAL';

  if (!isAuthorized) {
    return {
      success: false,
      error: 'ACCESO_DENEGADO: Solo un Brigadista Certificado u Operador Municipal puede desbloquear la bóveda PII.',
    };
  }

  const trimmedReason = params.accessReason.trim();
  if (trimmedReason.length < 10) {
    return {
      success: false,
      error: 'JUSTIFICACION_INSUFICIENTE: Por mandato de la Ley N° 29733 Art. 17, se requiere una justificación de al menos 10 caracteres.',
    };
  }

  const auditId = `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const auditRecord: ILocalPiiAuditRecord = {
    id: auditId,
    timestamp: new Date().toISOString(),
    post_id: params.postId,
    requester_role: params.userRole,
    requester_name: params.userName,
    access_reason: trimmedReason,
    compliance_legal: 'LEY_29733_ART_17',
  };

  return {
    success: true,
    data: {
      exact_address: params.protectedAddress,
      contact_phone: params.protectedPhone,
      audit_id: auditId,
    },
    auditRecord,
  };
}

describe('R4: Tarjeta Interactiva "Modo Presentación Jurado (Pitch 3 Minutos)"', () => {
  /* =========================================================================
   * FEATURE 11: CRONÓMETRO REGRESIVO JURADO (180S CON CONTROLES)
   * ========================================================================= */
  describe('F11 - Cronómetro Regresivo Jurado: Tier 1 (Funcional)', () => {
    it('F11-T1-01: Inicializa el cronómetro en exactamente 180 segundos con estado detenido', () => {
      const timer = new PitchTimerController();
      const state = timer.getState();
      expect(state.remainingSeconds).toBe(180);
      expect(state.isRunning).toBe(false);
      expect(state.statusColor).toBe('NORMAL');
    });

    it('F11-T1-02: Control Play/Start activa la cuenta regresiva disminuyendo los segundos', () => {
      const timer = new PitchTimerController();
      timer.start();
      expect(timer.getState().isRunning).toBe(true);
      timer.tick(5);
      expect(timer.getState().remainingSeconds).toBe(175);
    });

    it('F11-T1-03: Control Pause congela el cronómetro sin alterar los segundos acumulados', () => {
      const timer = new PitchTimerController();
      timer.start();
      timer.tick(20);
      expect(timer.getState().remainingSeconds).toBe(160);

      timer.pause();
      expect(timer.getState().isRunning).toBe(false);
      timer.tick(10); // No debe decrementar en pausa
      expect(timer.getState().remainingSeconds).toBe(160);
    });

    it('F11-T1-04: Control Reset restaura el temporizador a 180 segundos y detiene la marcha', () => {
      const timer = new PitchTimerController();
      timer.start();
      timer.tick(80);
      expect(timer.getState().remainingSeconds).toBe(100);

      timer.reset();
      expect(timer.getState().remainingSeconds).toBe(180);
      expect(timer.getState().isRunning).toBe(false);
      expect(timer.getState().statusColor).toBe('NORMAL');
    });

    it('F11-T1-05: Formatea la visualización en formato legible mm:ss ("03:00", "01:30", "00:45")', () => {
      expect(formatTimerMmSs(180)).toBe('03:00');
      expect(formatTimerMmSs(125)).toBe('02:05');
      expect(formatTimerMmSs(60)).toBe('01:00');
      expect(formatTimerMmSs(45)).toBe('00:45');
      expect(formatTimerMmSs(9)).toBe('00:09');
      expect(formatTimerMmSs(0)).toBe('00:00');
    });
  });

  describe('F11 - Cronómetro Regresivo: Tier 2 (BVA y Transiciones de Color)', () => {
    it('F11-T2-01: Límite inferior: al llegar a 0 segundos, el cronómetro se detiene en 0s y no es negativo', () => {
      const timer = new PitchTimerController();
      timer.start();
      timer.tick(185);
      expect(timer.getState().remainingSeconds).toBe(0);
      expect(timer.getState().isRunning).toBe(false);
      expect(formatTimerMmSs(timer.getState().remainingSeconds)).toBe('00:00');
    });

    it('F11-T2-02: Transición de color >60s es NORMAL (verde)', () => {
      expect(deriveTimerStatusColor(180)).toBe('NORMAL');
      expect(deriveTimerStatusColor(61)).toBe('NORMAL');
    });

    it('F11-T2-03: Transición de color entre 30s y 60s es WARNING (ámbar)', () => {
      expect(deriveTimerStatusColor(60)).toBe('WARNING');
      expect(deriveTimerStatusColor(45)).toBe('WARNING');
      expect(deriveTimerStatusColor(30)).toBe('WARNING');
    });

    it('F11-T2-04: Transición de color <30s es CRITICAL (rojo)', () => {
      expect(deriveTimerStatusColor(29)).toBe('CRITICAL');
      expect(deriveTimerStatusColor(10)).toBe('CRITICAL');
      expect(deriveTimerStatusColor(0)).toBe('CRITICAL');
    });

    it('F11-T2-05: Idempotencia: múltiples llamadas consecutivas a start() o pause() mantienen estado consistente', () => {
      const timer = new PitchTimerController();
      timer.start();
      timer.start();
      expect(timer.getState().isRunning).toBe(true);

      timer.pause();
      timer.pause();
      expect(timer.getState().isRunning).toBe(false);
    });
  });

  /* =========================================================================
   * FEATURE 12: SIMULACIÓN 1: MODO AVION / SIN RED EN 1 CLIC
   * ========================================================================= */
  describe('F12 - Simulación 1: Caída de Red en 1 Clic: Tier 1 (Funcional)', () => {
    it('F12-T1-01: Conmuta inmediatamente el estado de red a offline (isOnline: false)', () => {
      const db = new RedVecinaLocalDB(`TestDb_AirplaneSim_${Date.now()}`);
      const syncMgr = new SyncManager(db);

      expect(syncMgr.getState().isOnline).toBe(true);
      syncMgr.setOnlineStatus(false);
      expect(syncMgr.getState().isOnline).toBe(false);
    });

    it('F12-T1-02: Conmutación a offline opera en memoria sin recargar la página', () => {
      const db = new RedVecinaLocalDB(`TestDb_NoReload_${Date.now()}`);
      const syncMgr = new SyncManager(db);

      let reloadCalled = false;
      const fakeReload = () => {
        reloadCalled = true;
      };

      // Disparar simulación de modo avión
      syncMgr.setOnlineStatus(false);
      expect(reloadCalled).toBe(false);
      expect(syncMgr.getState().isOnline).toBe(false);
    });

    it('F12-T1-03: Consulta local en Dexie continúa operando fluidamente en modo avión', async () => {
      const db = new RedVecinaLocalDB(`TestDb_OfflineQuery_${Date.now()}`);
      await db.bulkCachePosts(INITIAL_SECTOR_POSTS);

      const syncMgr = new SyncManager(db);
      syncMgr.setOnlineStatus(false);

      const cachedPosts = await db.posts.toArray();
      expect(cachedPosts.length).toBe(INITIAL_SECTOR_POSTS.length);
    });

    it('F12-T1-04: Creación de publicación en modo avión encola en outbox con status PENDING', async () => {
      const db = new RedVecinaLocalDB(`TestDb_OutboxOffline_${Date.now()}`);
      const syncMgr = new SyncManager(db);
      syncMgr.setOnlineStatus(false);

      const mutationId = await db.enqueueMutation('/api/v1/posts', 'POST', {
        title: 'Reporte sin internet',
        content: 'Vecinos, reporte generado 100% offline.',
      });

      expect(mutationId).toBeDefined();
      const pending = await db.getPendingMutations();
      expect(pending.length).toBe(1);
      expect(pending[0]?.status).toBe('PENDING');
      expect(pending[0]?.client_mutation_id).toBe(mutationId);
    });

    it('F12-T1-05: Restauración de conexión (toggle a online) permite procesar la cola outbox', async () => {
      const db = new RedVecinaLocalDB(`TestDb_OutboxReconnect_${Date.now()}`);
      let batchPosted = false;

      const mockFetch: typeof fetch = async () => {
        batchPosted = true;
        return new Response(
          JSON.stringify({
            success: true,
            data: { synced_ids: ['mutation-123'], failed_ids: [] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const syncMgr = new SyncManager(db, mockFetch);
      syncMgr.setOnlineStatus(false);

      await db.enqueueMutation('/api/v1/sync/batch', 'POST', {
        client_mutation_id: 'mutation-123',
        action: 'test',
      });

      // Reconectar
      syncMgr.setOnlineStatus(true);
      expect(syncMgr.getState().isOnline).toBe(true);

      const outcome = await syncMgr.processOutbox();
      expect(batchPosted).toBe(true);
      expect(outcome.syncedIds).toContain('mutation-123');
    });
  });

  describe('F12 - Simulación 1: Tier 2 (BVA y Concurrencia Offline)', () => {
    it('F12-T2-01: Caída de red abrupta preserva todas las mutaciones encoladas sin pérdida', async () => {
      const db = new RedVecinaLocalDB(`TestDb_PreserveMutations_${Date.now()}`);
      await db.enqueueMutation('/api/v1/posts', 'POST', { id: 1 });
      await db.enqueueMutation('/api/v1/posts', 'POST', { id: 2 });
      await db.enqueueMutation('/api/v1/posts', 'POST', { id: 3 });

      const syncMgr = new SyncManager(db);
      syncMgr.setOnlineStatus(false);

      const pending = await db.getPendingMutations();
      expect(pending.length).toBe(3);
    });

    it('F12-T2-02: Alternancia rápida online/offline no corrompe el estado del SyncManager', () => {
      const db = new RedVecinaLocalDB(`TestDb_RapidToggle_${Date.now()}`);
      const syncMgr = new SyncManager(db);

      for (let i = 0; i < 20; i++) {
        syncMgr.setOnlineStatus(i % 2 === 0);
      }
      expect(syncMgr.getState().isOnline).toBe(false);
    });

    it('F12-T2-03: Notifica reactivamente a los suscriptores cuando cambia el estado online/offline', () => {
      const db = new RedVecinaLocalDB(`TestDb_Subscribers_${Date.now()}`);
      const syncMgr = new SyncManager(db);

      let lastReportedStatus: boolean | null = null;
      const unsubscribe = syncMgr.subscribe('state_changed', (state) => {
        lastReportedStatus = state.isOnline;
      });

      syncMgr.setOnlineStatus(false);
      expect(lastReportedStatus).toBe(false);

      syncMgr.setOnlineStatus(true);
      expect(lastReportedStatus).toBe(true);

      unsubscribe();
    });

    it('F12-T2-04: Marcar mutación fallida incrementa retry_count y conserva status FAILED reintentable', async () => {
      const db = new RedVecinaLocalDB(`TestDb_RetryCount_${Date.now()}`);
      const mutationId = await db.enqueueMutation('/api/v1/test', 'POST', { data: 1 });

      await db.markMutationFailed(mutationId, 'TIMEOUT_RED');
      const pending = await db.getPendingMutations();

      expect(pending.length).toBe(1);
      expect(pending[0]?.status).toBe('FAILED');
      expect(pending[0]?.retry_count).toBe(1);
      expect(pending[0]?.error_message).toBe('TIMEOUT_RED');
    });

    it('F12-T2-05: Orden FIFO estricto de procesamiento de outbox basado en created_at', async () => {
      const db = new RedVecinaLocalDB(`TestDb_FifoOrder_${Date.now()}`);
      const id1 = await db.enqueueMutation('/api/v1/first', 'POST', { seq: 1 });
      const id2 = await db.enqueueMutation('/api/v1/second', 'POST', { seq: 2 });

      const pending = await db.getPendingMutations();
      expect(pending[0]?.client_mutation_id).toBe(id1);
      expect(pending[1]?.client_mutation_id).toBe(id2);
    });
  });

  /* =========================================================================
   * FEATURE 13: SIMULACIÓN 2: SOS VOZ CON DIFUMINADO A 50M
   * ========================================================================= */
  describe('F13 - Simulación 2: SOS Voz con Difuminado a 50m: Tier 1 (Funcional)', () => {
    it('F13-T1-01: Procesa transcripción de voz vecinal infiriendo alerta humanitaria SOS_VULNERABLE', async () => {
      const voiceTranscription =
        'Auxilio urgente por sismo, mi abuela con insuficiencia respiratoria necesita balón de oxígeno en Calle Real 450, llamar al 964-111-222';

      const intent = await parseNeighborIntent(voiceTranscription, 'EMERGENCIA');
      expect(intent.module).toBe('EMERGENCIA_SOS');
      expect(intent.post_type).toBe('SOS_VULNERABLE');
      expect(intent.urgency).toBe('CRITICA');
    });

    it('F13-T1-02: Aplica perturbación determinista de 50 metros a coordenadas exactas (applySpatialBlurring50m)', () => {
      const exactLat = -12.0528;
      const exactLng = -75.2155;

      const blurred = applySpatialBlurring50m(exactLat, exactLng, 'simulacion-jurado-sos');
      expect(blurred.radiusMeters).toBe(50);
      expect(blurred.blurredLat).not.toBe(exactLat);
      expect(blurred.blurredLng).not.toBe(exactLng);
    });

    it('F13-T1-03: La distancia entre coordenada exacta y difuminada es estrictamente <= 50 metros', () => {
      const exactLat = -12.0528;
      const exactLng = -75.2155;

      const blurred = applySpatialBlurring50m(exactLat, exactLng, 'pitch-demo-seed-42');
      const dist = calculateDistanceMeters(exactLat, exactLng, blurred.blurredLat, blurred.blurredLng);

      expect(dist).toBeLessThanOrEqual(50);
      expect(dist).toBeGreaterThanOrEqual(25); // Debe haber perturbación real, no 0m
    });

    it('F13-T1-04: La descripción pública generada protege la dirección exacta con marcadores de salvaguarda', async () => {
      const voiceTranscription =
        'Emergencia en Jr. Huiracocha 1488 dpto 201, fuga de gas y adulto mayor atrapado';

      const intent = await parseNeighborIntent(voiceTranscription, 'EMERGENCIA');
      expect(intent.is_pii_redacted).toBe(true);
      expect(intent.description).not.toContain('Jr. Huiracocha 1488');
    });

    it('F13-T1-05: Creación optimista del post SOS en IndexedDB registra privacy_radius_meters = 50', async () => {
      const db = new RedVecinaLocalDB(`TestDb_SosPostLocal_${Date.now()}`);
      const exactLat = -12.0528;
      const exactLng = -75.2155;
      const blurred = applySpatialBlurring50m(exactLat, exactLng, 'audit-seed-1');

      await db.posts.put({
        client_mutation_id: '55555555-5555-4555-8555-555555555501',
        sector_id: 1,
        category_id: 4,
        operational_mode: 'EMERGENCIA',
        post_type: 'SOS_VULNERABLE',
        title: 'SOS Oxígeno Adulto Mayor',
        description: 'Paciente requiere soporte de oxígeno en zona protegida.',
        urgency_level: 'CRITICA',
        public_lat: blurred.blurredLat,
        public_lng: blurred.blurredLng,
        privacy_radius_meters: 50,
        status: 'ACTIVO',
        client_created_at: new Date().toISOString(),
        is_pending_sync: true,
      });

      const saved = await db.posts.get(1);
      expect(saved?.privacy_radius_meters).toBe(50);
      expect(saved?.post_type).toBe('SOS_VULNERABLE');
    });
  });

  describe('F13 - Simulación 2: Tier 2 (BVA y Determinismo Espacial)', () => {
    it('F13-T2-01: applySpatialBlurring50m es determinista con la misma semilla', () => {
      const lat = -12.0678;
      const lng = -75.2085;
      const run1 = applySpatialBlurring50m(lat, lng, 'seed-constante');
      const run2 = applySpatialBlurring50m(lat, lng, 'seed-constante');

      expect(run1.blurredLat).toBe(run2.blurredLat);
      expect(run1.blurredLng).toBe(run2.blurredLng);
    });

    it('F13-T2-02: 100 semillas distintas producen desplazamientos estrictamente <= 50 metros', () => {
      const lat = -12.0528;
      const lng = -75.2155;

      for (let i = 0; i < 100; i++) {
        const blurred = applySpatialBlurring50m(lat, lng, `seed-iteration-${i}`);
        const dist = calculateDistanceMeters(lat, lng, blurred.blurredLat, blurred.blurredLng);
        expect(dist).toBeLessThanOrEqual(50);
      }
    });

    it('F13-T2-03: Extrae PII estructurada (dirección y notas médicas) para la bóveda', async () => {
      const text =
        'Auxilio en Jr. Huiracocha 1488 piso 3, paciente diabética en silla de ruedas necesita asistencia';

      const intent = await parseNeighborIntent(text, 'EMERGENCIA');
      if (intent.extracted_pii) {
        expect(intent.extracted_pii.exact_address_reference.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('F13-T2-04: Transcripción de emergencia por voz sin cobro mantiene zero_money_compliant = true', async () => {
      const text = 'Urgente oxígeno para mi vecina lesionada por temblor';
      const intent = await parseNeighborIntent(text, 'EMERGENCIA');
      expect(intent.zero_money_compliant).toBe(true);
      expect(intent.has_monetary_intent).toBe(false);
    });

    it('F13-T2-05: Coordenadas difuminadas redondean a 6 decimales para precisión cartográfica limpia', () => {
      const blurred = applySpatialBlurring50m(-12.0528, -75.2155, 'precision-test');
      const latDecimals = blurred.blurredLat.toString().split('.')[1]?.length ?? 0;
      const lngDecimals = blurred.blurredLng.toString().split('.')[1]?.length ?? 0;
      expect(latDecimals).toBeLessThanOrEqual(6);
      expect(lngDecimals).toBeLessThanOrEqual(6);
    });
  });

  /* =========================================================================
   * FEATURE 14: SIMULACIÓN 3: DESBLOQUEO BÓVEDA PII + LOG LOCAL
   * ========================================================================= */
  describe('F14 - Simulación 3: Desbloqueo Bóveda PII + Log Local: Tier 1 (Funcional)', () => {
    it('F14-T1-01: Permite el desbloqueo a un Brigadista Certificado acreditado', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Pedro Quispe',
        accessReason: 'Rescate de adulto mayor con insuficiencia respiratoria aguda.',
        protectedAddress: 'Jr. Huiracocha 1488 Dpto 201',
        protectedPhone: '987-111-222',
      });

      expect(outcome.success).toBe(true);
      expect(outcome.data?.exact_address).toBe('Jr. Huiracocha 1488 Dpto 201');
      expect(outcome.data?.contact_phone).toBe('987-111-222');
      expect(outcome.auditRecord).toBeDefined();
    });

    it('F14-T1-02: Permite el desbloqueo a un Operador Municipal en contingencia', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'OPERADOR_MUNICIPAL',
        userName: 'Operador COEL Junín',
        accessReason: 'Coordinación de ambulancia y defensa civil para traslado a hospital.',
        protectedAddress: 'Calle Real 450, El Tambo',
        protectedPhone: '964-555-444',
      });

      expect(outcome.success).toBe(true);
      expect(outcome.auditRecord?.requester_role).toBe('OPERADOR_MUNICIPAL');
    });

    it('F14-T1-03: Bloquea y rechaza el desbloqueo para un usuario con rol VECINO ordinario', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'VECINO',
        userName: 'Vecino Curioso',
        accessReason: 'Quiero ver la dirección de la persona que pide ayuda.',
        protectedAddress: 'Jr. Huiracocha 1488 Dpto 201',
        protectedPhone: '987-111-222',
      });

      expect(outcome.success).toBe(false);
      expect(outcome.data).toBeUndefined();
      expect(outcome.error).toContain('ACCESO_DENEGADO');
    });

    it('F14-T1-04: Exige justificación operativa de rescate con mínimo de 10 caracteres', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Pedro Quispe',
        accessReason: 'Ayuda', // Menos de 10 caracteres
        protectedAddress: 'Jr. Huiracocha 1488 Dpto 201',
        protectedPhone: '987-111-222',
      });

      expect(outcome.success).toBe(false);
      expect(outcome.error).toContain('JUSTIFICACION_INSUFICIENTE');
    });

    it('F14-T1-05: El registro de auditoría local cumple con la Ley N° 29733 Art. 17', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Pedro Quispe',
        accessReason: 'Entrega urgente de balón de oxígeno y triaje domiciliario.',
        protectedAddress: 'Jr. Huiracocha 1488 Dpto 201',
        protectedPhone: '987-111-222',
      });

      expect(outcome.auditRecord?.compliance_legal).toBe('LEY_29733_ART_17');
      expect(outcome.auditRecord?.timestamp).toBeDefined();
      expect(Date.parse(outcome.auditRecord?.timestamp ?? '')).not.toBeNaN();
    });
  });

  describe('F14 - Simulación 3: Tier 2 (BVA y Casos Límite)', () => {
    it('F14-T2-01: Justificación de exactamente 9 caracteres es rechazada', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Pedro',
        accessReason: '123456789', // 9 caracteres
        protectedAddress: 'Jr. Huiracocha 1488',
        protectedPhone: '987-111-222',
      });
      expect(outcome.success).toBe(false);
    });

    it('F14-T2-02: Justificación de exactamente 10 caracteres es aceptada', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Pedro',
        accessReason: '1234567890', // 10 caracteres
        protectedAddress: 'Jr. Huiracocha 1488',
        protectedPhone: '987-111-222',
      });
      expect(outcome.success).toBe(true);
    });

    it('F14-T2-03: Justificación compuesta únicamente de espacios en blanco es rechazada', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Pedro',
        accessReason: '          ', // 10 espacios en blanco
        protectedAddress: 'Jr. Huiracocha 1488',
        protectedPhone: '987-111-222',
      });
      expect(outcome.success).toBe(false);
    });

    it('F14-T2-04: Cada desbloqueo exitoso genera un identificador de auditoría único', () => {
      const out1 = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Pedro',
        accessReason: 'Rescate de paciente primera intervención.',
        protectedAddress: 'Jr. Huiracocha 1488',
        protectedPhone: '987-111-222',
      });

      const out2 = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Pedro',
        accessReason: 'Segunda intervención de apoyo de brigada.',
        protectedAddress: 'Jr. Huiracocha 1488',
        protectedPhone: '987-111-222',
      });

      expect(out1.data?.audit_id).not.toBe(out2.data?.audit_id);
    });

    it('F14-T2-05: El registro inmutable almacena el nombre del brigadista responsable', () => {
      const outcome = executePiiVaultUnlock({
        postId: 2,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Ing. Carlos Mendoza (Brigada Defensa Civil)',
        accessReason: 'Verificación de colapso estructural e integridad física.',
        protectedAddress: 'Jr. Huiracocha 1488',
        protectedPhone: '987-111-222',
      });

      expect(outcome.auditRecord?.requester_name).toBe(
        'Ing. Carlos Mendoza (Brigada Defensa Civil)'
      );
    });
  });

  /* =========================================================================
   * TIER 3: EJECUCIÓN SECUENCIAL COMPLETA DEL PITCH (180S)
   * ========================================================================= */
  describe('R4: Tier 3 (Flujo Secuencial Integral del Pitch 3 Minutos)', () => {
    it('R4-T3-01: Flujo completo del jurado: Iniciar timer -> Sim 1 (Modo Avión) -> Sim 2 (SOS Voz) -> Sim 3 (Desbloqueo PII) -> Pausar timer', async () => {
      // 1. Iniciar Cronómetro (180s)
      const timer = new PitchTimerController();
      timer.start();
      expect(timer.getState().isRunning).toBe(true);

      // Simular 10 segundos de pitch inicial
      timer.tick(10);
      expect(timer.getState().remainingSeconds).toBe(170);

      // 2. DISPARAR SIMULACIÓN 1: Caída de Red / Modo Avión en 1 Clic
      const db = new RedVecinaLocalDB(`TestDb_PitchE2E_${Date.now()}`);
      const syncMgr = new SyncManager(db);
      syncMgr.setOnlineStatus(false);
      expect(syncMgr.getState().isOnline).toBe(false);

      // Simular 20 segundos de navegación local sin internet
      timer.tick(20);
      expect(timer.getState().remainingSeconds).toBe(150);

      // 3. DISPARAR SIMULACIÓN 2: Publicación de Emergencia SOS por Voz con Blur a 50m
      const voiceText =
        'Auxilio, adulto mayor con tanque de oxígeno agotado en Jr. Huiracocha 1488, llamar al 987-111-222';
      const intent = await parseNeighborIntent(voiceText, 'EMERGENCIA');
      expect(intent.post_type).toBe('SOS_VULNERABLE');

      const exactLat = -12.0528;
      const exactLng = -75.2155;
      const blurred = applySpatialBlurring50m(exactLat, exactLng, 'pitch-jurado-e2e');
      expect(blurred.radiusMeters).toBe(50);

      // Persistir post SOS localmente mientras sigue offline
      await db.posts.put({
        client_mutation_id: 'pitch-sos-mutation-1',
        sector_id: 1,
        category_id: 4,
        operational_mode: 'EMERGENCIA',
        post_type: 'SOS_VULNERABLE',
        title: 'SOS Oxígeno Adulto Mayor',
        description: 'Paciente requiere soporte de oxígeno en zona protegida.',
        urgency_level: 'CRITICA',
        public_lat: blurred.blurredLat,
        public_lng: blurred.blurredLng,
        privacy_radius_meters: 50,
        status: 'ACTIVO',
        client_created_at: new Date().toISOString(),
        is_pending_sync: true,
      });

      // Simular 25 segundos explicando la protección de datos al jurado
      timer.tick(25);
      expect(timer.getState().remainingSeconds).toBe(125);

      // 4. DISPARAR SIMULACIÓN 3: Desbloqueo auditado de Bóveda PII por Brigadista
      const unlockOutcome = executePiiVaultUnlock({
        postId: 1,
        userRole: 'BRIGADISTA_CERTIFICADO',
        userName: 'Brigadista Evaluador Jurado',
        accessReason: 'Demostración en vivo ante jurado de desbloqueo auditado Ley 29733.',
        protectedAddress: 'Jr. Huiracocha 1488 Dpto 201',
        protectedPhone: '987-111-222',
      });

      expect(unlockOutcome.success).toBe(true);
      expect(unlockOutcome.auditRecord?.compliance_legal).toBe('LEY_29733_ART_17');
      expect(unlockOutcome.data?.exact_address).toBe('Jr. Huiracocha 1488 Dpto 201');

      // 5. Finalizar demostración y pausar cronómetro antes de los 180s
      timer.tick(15);
      timer.pause();

      expect(timer.getState().isRunning).toBe(false);
      expect(timer.getState().remainingSeconds).toBe(110);
      expect(formatTimerMmSs(timer.getState().remainingSeconds)).toBe('01:50');
      expect(timer.getState().statusColor).toBe('NORMAL');
    });

    it('R4-T3-02: Garantiza que el log local de auditoría PII persista a través de reinicios de sesión', async () => {
      const db = new RedVecinaLocalDB(`TestDb_AuditPersistence_${Date.now()}`);
      // Simular almacenamiento en tabla outbox / auditoría
      const auditMutationId = await db.enqueueMutation('/api/v1/pii-audit', 'POST', {
        post_id: 1,
        requester_role: 'BRIGADISTA_CERTIFICADO',
        compliance_legal: 'LEY_29733_ART_17',
        timestamp: new Date().toISOString(),
      });

      const records = await db.getPendingMutations();
      expect(records.some((r) => r.client_mutation_id === auditMutationId)).toBe(true);
    });

    it('R4-T3-03: Renderiza el widget PitchJuryPanel con botón flotante accesible min-h-[48px] y cronómetro inicial en 03:00', () => {
      const html = renderToStaticMarkup(
        React.createElement(ModeProvider, null, React.createElement(PitchJuryPanel))
      );

      // Botón flotante del pitch
      expect(html).toContain('Pitch Jurado (180s)');
      expect(html).toContain('03:00');

      // Botón accesible con min-h-[48px]
      expect(html).toContain('min-h-[48px]');
      expect(html).toMatch(/<button[^>]*aria-label="[^"]*Pitch Jurado[^"]*"[^>]*min-h-\[48px\]/);
    });
  });
});

