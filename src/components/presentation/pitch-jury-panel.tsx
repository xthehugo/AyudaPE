'use client';

/**
 * @file src/components/presentation/pitch-jury-panel.tsx
 * @description Panel interactivo flotante "Modo Presentación Jurado (Pitch 3 Minutos / 180s)"
 * según requerimientos R4 / F11, F12, F13, F14 (Evaluación Mario Cortijo).
 *
 * Incluye:
 * - Cronómetro visual regresivo de 180s con controles Play, Pause, Reset y transiciones de color.
 * - 3 Simulaciones en vivo en 1 clic (Caída de Red, SOS Voz con Blur a 50m, Desbloqueo Auditado PII).
 * - Visualizador forense en vivo de registros de auditoría local PII (Ley N° 29733 Art. 17).
 * - Totalmente accesible WCAG AAA con áreas táctiles >= 48px en todos los botones.
 */

import React, { useEffect, useState } from 'react';
import {
  Clock,
  Eye,
  FileText,
  KeyRound,
  Mic,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOperationalMode } from '@/context/mode-context';
import { parseNeighborIntent } from '@/lib/ai/ai-orchestrator';
import { applySpatialBlurring50m } from '@/lib/geo-utils';
import { localDb } from '@/lib/offline/db';
import { syncManager } from '@/lib/offline/sync-manager';
import { executeQuickPublishPersist } from '@/components/publish/quick-publish-modal';
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
 * Estado y tipado del cronómetro regresivo de 180s (Pitch Jurado).
 */
export interface IPitchTimerState {
  remainingSeconds: number;
  isRunning: boolean;
  statusColor: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

/**
 * Formatea segundos a formato mm:ss ("03:00", "01:30", "00:45").
 */
export function formatTimerMmSs(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Deriva el estado semántico de color según el tiempo restante:
 * - > 60s: NORMAL (verde)
 * - 30s - 60s: WARNING (ámbar / amarillo)
 * - < 30s: CRITICAL (rojo pulsante)
 */
export function deriveTimerStatusColor(seconds: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  if (seconds > 60) return 'NORMAL';
  if (seconds >= 30) return 'WARNING';
  return 'CRITICAL';
}

/**
 * Controlador puro de cronómetro para vitest y tests unitarios E2E.
 */
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
 * Oráculo canónico de desbloqueo de Bóveda PII según Ley N° 29733 Art. 17.
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

/**
 * Componente interactivo del Panel de Pitch para el Jurado.
 */
export function PitchJuryPanel(): React.ReactElement {
  const { activeRole, setActiveRole } = useOperationalMode();

  // Estado del panel (plegado / desplegado)
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // Estado para ocultar/minimizar la píldora flotante para que no estorbe la vista general
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Estado del cronómetro de 180s
  const [remainingSeconds, setRemainingSeconds] = useState<number>(180);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Estado de sincronización en vivo
  const [isOnlineState, setIsOnlineState] = useState<boolean>(() => syncManager.getState().isOnline);

  // Estado de la Simulación 2 (SOS Voz)
  const [lastSosPost, setLastSosPost] = useState<{
    id: string;
    title: string;
    blurredCoords: string;
    privacyRadius: number;
  } | null>(null);
  const [isSimulatingSos, setIsSimulatingSos] = useState<boolean>(false);

  // Estado de la Simulación 3 (Bóveda PII y Audit Log)
  const [revealedPatient, setRevealedPatient] = useState<{
    name: string;
    address: string;
    phone: string;
    medicalNotes: string;
    auditId: string;
  } | null>(null);

  const [auditLog, setAuditLog] = useState<ILocalPiiAuditRecord[]>([]);

  // Efecto del cronómetro regresivo
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  // Suscripción al estado de red del syncManager
  useEffect(() => {
    const unsubscribe = syncManager.subscribe('state_changed', (state) => {
      setIsOnlineState(state.isOnline);
    });
    return () => unsubscribe();
  }, []);

  const handleStartTimer = () => {
    if (remainingSeconds === 0) {
      setRemainingSeconds(180);
    }
    setIsRunning(true);
  };

  const handlePauseTimer = () => {
    setIsRunning(false);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setRemainingSeconds(180);
  };

  // Simulación 1: Caída de Red / Modo Avión (1 Clic)
  const handleToggleAirplaneMode = () => {
    const currentOnline = syncManager.getState().isOnline;
    const nextOnline = !currentOnline;
    syncManager.setOnlineStatus(nextOnline);
    setIsOnlineState(nextOnline);

    if (!nextOnline) {
      toast.warning('Modo Avión activado: Navegando 100% offline con IndexedDB', {
        description:
          'Se emuló caída total de red. Consultas locales y mutaciones encoladas en Dexie.js outbox.',
        duration: 4500,
      });
    } else {
      toast.success('Conexión reanudada: Sincronizando con backend', {
        description: 'Vaciando la cola outbox hacia el servidor PostgreSQL.',
        duration: 4500,
      });
      void syncManager.processOutbox();
    }
  };

  // Simulación 2: Publicación SOS por Voz con Blur 50m
  const handleSimulateVoiceSos = async () => {
    setIsSimulatingSos(true);
    try {
      const voiceText =
        'SOS Adulto mayor electrodependiente en El Tambo requiere oxígeno urgente por corte de energía';
      const intent = await parseNeighborIntent(voiceText, 'EMERGENCIA');
      const exactLat = -12.0528;
      const exactLng = -75.2155;
      const blurred = applySpatialBlurring50m(exactLat, exactLng, `pitch-jurado-sos-${Date.now()}`);

      const persisted = await executeQuickPublishPersist({
        intent,
        latitude: exactLat,
        longitude: exactLng,
        contactPhone: '964-999-111',
        operationalMode: 'EMERGENCIA',
        db: localDb,
      });

      setLastSosPost({
        id: persisted.client_mutation_id,
        title: intent.title,
        blurredCoords: `${blurred.blurredLat.toFixed(5)}, ${blurred.blurredLng.toFixed(5)}`,
        privacyRadius: 50,
      });

      toast.error('Emergencia SOS Publicada por Voz', {
        description:
          'Persistido en IndexedDB con difuminado espacial de 50 metros según Ley N° 29733.',
        duration: 5000,
      });
    } catch (err) {
      toast.error('Error al simular SOS', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSimulatingSos(false);
    }
  };

  // Simulación 3: Desbloqueo Auditado de Bóveda PII por Brigadista
  const handleSimulateBrigadistaUnlock = async () => {
    // 1. Conmutar rol a Brigadista Certificado
    setActiveRole('BRIGADISTA_CERTIFICADO');

    // 2. Ejecutar desbloqueo con oráculo conforme a Ley N° 29733 Art. 17
    const outcome = executePiiVaultUnlock({
      postId: 1,
      userRole: 'BRIGADISTA_CERTIFICADO',
      userName: 'Brigadista Mario Cortijo (Defensa Civil El Tambo)',
      accessReason:
        'Rescate y suministro urgente de oxígeno medicinal para Doña Gregoria Mayta.',
      protectedAddress: 'Jr. Puno 420 Huancayo, Junín',
      protectedPhone: '964-123-456 (Contacto Familiar)',
    });

    if (outcome.success && outcome.auditRecord) {
      // 3. Persistir registro en IndexedDB outbox de auditoría
      try {
        await localDb.enqueueMutation('/api/v1/pii-audit', 'POST', {
          post_id: outcome.auditRecord.post_id,
          requester_role: outcome.auditRecord.requester_role,
          requester_name: outcome.auditRecord.requester_name,
          access_reason: outcome.auditRecord.access_reason,
          compliance_legal: outcome.auditRecord.compliance_legal,
          timestamp: outcome.auditRecord.timestamp,
        });
      } catch {
        // En entornos SSR o sin DB
      }

      setAuditLog((prev) => [outcome.auditRecord!, ...prev]);
      setRevealedPatient({
        name: 'Doña Gregoria Mayta',
        address: outcome.data!.exact_address,
        phone: outcome.data!.contact_phone,
        medicalNotes: 'EPOC severo · Requiere soporte de oxígeno continuo 2L/min',
        auditId: outcome.data!.audit_id,
      });

      toast.success('Bóveda PII Desbloqueada por Brigadista Certificado', {
        description:
          'Datos sensibles expuestos de forma controlada. Registro inmutable generado (Ley 29733 Art. 17).',
        duration: 5000,
      });
    }
  };

  const statusColor = deriveTimerStatusColor(remainingSeconds);
  const colorStyles =
    statusColor === 'NORMAL'
      ? 'text-emerald-400 border-emerald-500/80 bg-emerald-950/60'
      : statusColor === 'WARNING'
        ? 'text-amber-300 border-amber-500/80 bg-amber-950/60'
        : 'text-red-400 border-red-500 bg-red-950/80 animate-pulse';

  return (
    <>
      {/* Botón flotante accesible de activación (fijo en pantalla sin tapar navegación principal) */}
      {!isDismissed ? (
        <div className="fixed bottom-20 right-3 z-40 sm:bottom-6 sm:right-6 pointer-events-auto flex items-center gap-1 bg-indigo-700 rounded-full shadow-2xl border-2 border-indigo-300 p-0.5">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? 'Cerrar Panel Modo Pitch Jurado' : 'Abrir Panel Modo Pitch Jurado 180s'}
            aria-expanded={isOpen}
            className="min-h-[48px] h-11 px-3 py-1.5 rounded-full text-white font-black text-xs inline-flex items-center gap-1.5 transition-all active:scale-95 focus:outline-none"
          >
            <Clock className="w-4 h-4 text-yellow-300 shrink-0" aria-hidden="true" />
            <span className="font-extrabold tracking-tight">Pitch Jurado (180s)</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                isRunning ? 'bg-yellow-400 text-black border-yellow-200' : 'bg-slate-800 text-white border-slate-600'
              }`}
            >
              {formatTimerMmSs(remainingSeconds)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Minimizar panel de jurado"
            title="Minimizar panel de jurado"
            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-indigo-900/60 hover:bg-indigo-900 text-indigo-200 hover:text-white flex items-center justify-center text-xs font-bold mr-1 active:scale-90"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="fixed bottom-20 right-2 z-40 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDismissed(false)}
            aria-label="Restaurar Pitch Jurado (180s)"
            title="Ver Pitch Jurado"
            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-indigo-700/80 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg border border-indigo-300 text-xs"
          >
            <Clock className="w-4 h-4 text-yellow-300" />
          </button>
        </div>
      )}

      {/* Widget Flotante Expandible */}
      {isOpen && (
        <div
          role="region"
          aria-label="Panel Interactivo Pitch Jurado 180s"
          className="fixed bottom-24 right-2 left-2 sm:left-auto sm:right-6 z-50 w-auto sm:w-[440px] max-h-[82vh] overflow-y-auto rounded-3xl bg-slate-950/95 text-white border-2 border-indigo-400 shadow-2xl p-4 sm:p-5 space-y-4 backdrop-blur-xl transition-all"
        >
          {/* Cabecera del Panel */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <p className="text-sm font-black text-white tracking-tight">
                  Evaluación Mario Cortijo · 180s
                </p>
                <p className="text-[11px] text-slate-400 font-bold">
                  Cronómetro y 3 Simulaciones en Vivo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar panel del jurado"
              className="min-h-[48px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 inline-flex items-center gap-1 active:scale-95"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span>Cerrar</span>
            </button>
          </div>

          {/* CRONÓMETRO REGRESIVO (180s) */}
          <div className={`rounded-2xl border-2 p-3.5 space-y-2.5 transition-colors ${colorStyles}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider">
                Tiempo Restante de Pitch
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-black/40">
                {statusColor === 'NORMAL'
                  ? 'Tranquilo (> 1m)'
                  : statusColor === 'WARNING'
                    ? 'Concluyendo (30s - 60s)'
                    : '¡Cierre Inmediato! (< 30s)'}
              </span>
            </div>

            <div className="text-4xl sm:text-5xl font-mono font-black text-center tracking-tight py-1">
              {formatTimerMmSs(remainingSeconds)}
            </div>

            {/* Controles del Cronómetro (todos con min-h-[48px]) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={handleStartTimer}
                disabled={isRunning}
                aria-label="Iniciar cronómetro de pitch"
                className="min-h-[48px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-95"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Iniciar</span>
              </button>

              <button
                type="button"
                onClick={handlePauseTimer}
                disabled={!isRunning}
                aria-label="Pausar cronómetro de pitch"
                className="min-h-[48px] px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-black text-xs inline-flex items-center justify-center gap-1.5 shadow-md active:scale-95"
              >
                <Pause className="w-4 h-4" aria-hidden="true" />
                <span>Pausar</span>
              </button>

              <button
                type="button"
                onClick={handleResetTimer}
                aria-label="Reiniciar cronómetro a 180 segundos"
                className="min-h-[48px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs border border-slate-600 inline-flex items-center justify-center gap-1.5 shadow-md active:scale-95"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Reiniciar</span>
              </button>
            </div>
          </div>

          {/* SECCIÓN DE 3 SIMULACIONES EN VIVO */}
          <div className="space-y-2.5">
            <p className="text-xs font-black text-indigo-300 uppercase tracking-wider">
              3 Simulaciones en Vivo (Mario Cortijo)
            </p>

            {/* SIMULACIÓN 1: Caída de Red / Modo Avión */}
            <button
              type="button"
              onClick={handleToggleAirplaneMode}
              aria-label={`Simulación 1: Conmutar Modo Avión. Estado actual: ${isOnlineState ? 'Online' : 'Offline'}`}
              className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl text-left border-2 font-bold text-xs transition-all active:scale-[0.98] flex items-center justify-between gap-2.5 ${
                !isOnlineState
                  ? 'bg-amber-950/80 text-amber-200 border-amber-500 shadow-md ring-2 ring-amber-500/30'
                  : 'bg-slate-900 text-slate-100 border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {!isOnlineState ? (
                  <WifiOff className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
                ) : (
                  <Wifi className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                )}
                <div className="truncate">
                  <p className="font-black text-white truncate">
                    1. Caída de Red / Modo Avión
                  </p>
                  <p className="text-[11px] opacity-80 truncate">
                    {!isOnlineState ? 'Modo Offline 100% activo' : 'Clic para cortar conexión'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                  !isOnlineState ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {!isOnlineState ? 'OFFLINE' : 'ONLINE'}
              </span>
            </button>

            {/* SIMULACIÓN 2: SOS Voz con Blur a 50m */}
            <button
              type="button"
              onClick={() => void handleSimulateVoiceSos()}
              disabled={isSimulatingSos}
              aria-label="Simulación 2: Publicar alerta SOS por voz con difuminado a 50 metros"
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl text-left bg-red-950/70 hover:bg-red-900/80 text-red-100 border-2 border-red-500/80 font-bold text-xs transition-all active:scale-[0.98] flex items-center justify-between gap-2.5 shadow-md"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Mic className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
                <div className="truncate">
                  <p className="font-black text-white truncate">
                    2. SOS Voz + Blur a 50m
                  </p>
                  <p className="text-[11px] text-red-200 truncate">
                    {isSimulatingSos ? 'Procesando transcripción...' : 'Adulto mayor electrodependiente'}
                  </p>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-red-600 text-white shrink-0">
                DISPARAR
              </span>
            </button>

            {lastSosPost && (
              <div className="rounded-xl bg-red-900/30 border border-red-500/40 p-2.5 text-[11px] text-red-200 space-y-1">
                <p className="font-black text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  SOS Persistido: {lastSosPost.title}
                </p>
                <p>Coordenadas Difuminadas: {lastSosPost.blurredCoords}</p>
                <p className="text-emerald-300 font-bold">
                  Radio de Privacidad: {lastSosPost.privacyRadius}m (RN-04 / Ley N° 29733)
                </p>
              </div>
            )}

            {/* SIMULACIÓN 3: Desbloqueo Bóveda PII por Brigadista */}
            <button
              type="button"
              onClick={() => void handleSimulateBrigadistaUnlock()}
              aria-label="Simulación 3: Desbloquear datos sensibles PII como Brigadista Certificado"
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl text-left bg-indigo-950/80 hover:bg-indigo-900 text-indigo-100 border-2 border-indigo-400 font-bold text-xs transition-all active:scale-[0.98] flex items-center justify-between gap-2.5 shadow-md"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <KeyRound className="w-5 h-5 text-yellow-300 shrink-0" aria-hidden="true" />
                <div className="truncate">
                  <p className="font-black text-white truncate">
                    3. Desbloqueo Bóveda PII
                  </p>
                  <p className="text-[11px] text-indigo-200 truncate">
                    Rol: {activeRole} → Brigadista
                  </p>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-indigo-600 text-white shrink-0">
                DESBLOQUEAR
              </span>
            </button>
          </div>

          {/* DATOS PACIENTE REVELADOS (SI FUE DESBLOQUEADO) */}
          {revealedPatient && (
            <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-950/60 p-3.5 space-y-1.5 text-xs text-emerald-100 shadow-inner">
              <div className="flex items-center justify-between border-b border-emerald-500/40 pb-1.5">
                <span className="font-black text-white flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  Bóveda PII Revelada al Brigadista
                </span>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 rounded">
                  {revealedPatient.auditId}
                </span>
              </div>
              <p className="font-bold text-white text-sm">
                Paciente: {revealedPatient.name}
              </p>
              <p>Dirección Exacta: <strong className="text-white">{revealedPatient.address}</strong></p>
              <p>Teléfono: <strong className="text-white">{revealedPatient.phone}</strong></p>
              <p className="text-[11px] text-emerald-200 italic">
                {revealedPatient.medicalNotes}
              </p>
            </div>
          )}

          {/* VISUALIZADOR DE REGISTRO FORENSE DE AUDITORÍA (LEY N° 29733 ART. 17) */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs font-black text-slate-300">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                Log Forense de Auditoría PII
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                {auditLog.length} evento{auditLog.length === 1 ? '' : 's'}
              </span>
            </div>

            {auditLog.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-3 text-center text-xs text-slate-500">
                Sin eventos de acceso sensible registrados. Dispara la Simulación 3 para generar el primer registro auditado.
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                {auditLog.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-[11px] text-slate-200 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className="text-emerald-400 font-bold">{log.compliance_legal}</span>
                    </div>
                    <p className="font-bold text-white">
                      {log.requester_name} ({log.requester_role})
                    </p>
                    <p className="text-slate-300 italic">
                      Motivo: {log.access_reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default PitchJuryPanel;
