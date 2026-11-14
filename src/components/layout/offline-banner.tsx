'use client';

import React, { useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ModeContext } from '@/context/mode-context';
import { useNetworkSync } from '@/hooks/use-network-sync';

export interface OfflineBannerProps {
  sectorId?: number;
  overrideOnline?: boolean;
  overridePendingCount?: number;
}

/**
 * Banner de Sincronización de Datos (Ubicado debajo de la cabecera global):
 * - Color violeta distintivo (fondo #EFEBFF, texto y botón #5B3FD6).
 * - Solo aparece cuando hay conexión a internet Y existen datos pendientes de sincronización.
 * - Al pulsar "Sincronizar":
 *   1. Muestra "Sincronizando…" con indicador de carga giratorio.
 *   2. Al terminar muestra "Sincronizado" con icono de check durante 2 segundos.
 *   3. Desaparece por completo con animación suave de colapso de altura y opacidad.
 */
export function OfflineBanner({
  sectorId = 1,
  overrideOnline,
  overridePendingCount,
}: OfflineBannerProps): React.ReactElement | null {
  const modeCtx = useContext(ModeContext);
  const isEmergencyMode = modeCtx?.mode === 'EMERGENCIA';
  const { isOnline, pendingCount, triggerSync } = useNetworkSync(sectorId);

  const effectiveOnline = overrideOnline ?? isOnline;
  const effectivePending = overridePendingCount ?? pendingCount;

  const [syncState, setSyncState] = useState<'IDLE' | 'SYNCING' | 'DONE' | 'ERROR'>('IDLE');
  const [isDismissed, setIsDismissed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  // Control para evitar doble disparo de auto-sync al montar
  const autoSyncFired = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Si hay nuevos pendientes, se reactiva el banner
  useEffect(() => {
    if (effectivePending > 0) {
      setIsDismissed(false);
      if (syncState === 'DONE' || syncState === 'ERROR') {
        setSyncState('IDLE');
        setErrorMessage(null);
      }
    }
  }, [effectivePending, syncState]);

  // Si no hay pendientes y ya no se está sincronizando, quitar automáticamente
  useEffect(() => {
    if (effectivePending === 0 && syncState === 'DONE') {
      const timer = setTimeout(() => {
        setIsDismissed(true);
        setSyncState('IDLE');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [effectivePending, syncState]);

  // Auto-sincronizar al recuperar red si hay pendientes (una sola vez por reconexión)
  useEffect(() => {
    if (effectiveOnline && effectivePending > 0 && syncState === 'IDLE' && !autoSyncFired.current) {
      autoSyncFired.current = true;
      setSyncState('SYNCING');
      triggerSync()
        .then((result) => {
          setSyncState('DONE');
          if (result.failedIds.length > 0) {
            toast.warning('Sincronización parcial', {
              description: `${result.syncedIds.length} subido(s), ${result.failedIds.length} con error.`,
              duration: 5000,
            });
          } else {
            toast.success('¡Sincronización barrial completada!', {
              description: 'Tus publicaciones fuera de línea se han subido a la red.',
              duration: 4000,
            });
          }
          setTimeout(() => {
            setIsDismissed(true);
            setSyncState('IDLE');
          }, 2000);
        })
        .catch(() => {
          setSyncState('ERROR');
          setErrorMessage('No se pudo sincronizar automáticamente');
          toast.error('Error de sincronización', {
            description: 'Pulsa "Sincronizar" para reintentar.',
            duration: 5000,
          });
          setTimeout(() => {
            setSyncState('IDLE');
            setErrorMessage(null);
            autoSyncFired.current = false; // permitir reintento manual
          }, 4000);
        });
    }
    // Resetear bandera cuando se pierde la conexión
    if (!effectiveOnline) {
      autoSyncFired.current = false;
    }
  }, [effectiveOnline, effectivePending, syncState, triggerSync]);

  if (!mounted && overrideOnline === undefined) {
    return null;
  }

  // Modo Sin Red / Offline
  if (!effectiveOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full px-4 py-2.5 bg-slate-900 text-slate-100 border-b border-slate-700 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
          <div className="text-xs sm:text-sm font-bold leading-snug">
            <span>Modo Sin Red / Guardado Local Seguro</span>
            {effectivePending > 0 && (
              <span className="block text-xs text-amber-200 font-normal">
                {effectivePending} acción(es) resguardada(s) en memoria local (Outbox)
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Si está online pero no hay pendientes y no está sincronizando (o ya fue descartado), no se muestra nada
  if ((effectivePending === 0 && syncState === 'IDLE') || isDismissed) {
    return null;
  }

  const handleSyncClick = async () => {
    setSyncState('SYNCING');
    setErrorMessage(null);
    try {
      let result = await triggerSync();
      if (result.failedIds.length > 0) {
        result = await triggerSync();
      }
      if (result.failedIds.length > 0 && result.syncedIds.length === 0) {
        setSyncState('ERROR');
        setErrorMessage('Error temporal de red al sincronizar');
        toast.error('Error temporal al sincronizar', {
          description: 'Verifica tu conexión a internet e inténtalo de nuevo.',
        });
        setTimeout(() => {
          setSyncState('IDLE');
        }, 3500);
      } else {
        setSyncState('DONE');
        toast.success('¡Sincronizado con éxito!', {
          description: `${Math.max(1, result.syncedIds.length)} publicación(es) subida(s) a la nube.`,
        });
        setTimeout(() => {
          setIsDismissed(true);
          setSyncState('IDLE');
        }, 2000);
      }
    } catch (err) {
      setSyncState('ERROR');
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo sincronizar');
      setTimeout(() => {
        setSyncState('IDLE');
        setErrorMessage(null);
      }, 3500);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full px-4 py-2.5 border-b flex items-center justify-between gap-3 transition-all duration-300 animate-in slide-in-from-top-2 ${
        syncState === 'ERROR'
          ? isEmergencyMode
            ? 'bg-[#450A0A] text-[#FECDD3] border-[#F87171]'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          : isEmergencyMode
            ? 'bg-[#1E2636] text-[#E0E7FF] border-[#6366F1]'
            : 'bg-[#EFEBFF] dark:bg-indigo-950/60 text-[#5B3FD6] dark:text-indigo-300 border-[#5B3FD6]/20 dark:border-indigo-800'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-current/15 shrink-0"
        >
          {syncState === 'SYNCING' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : syncState === 'DONE' ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : syncState === 'ERROR' ? (
            <span className="text-xs font-black">!</span>
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </span>

        <div className="text-xs sm:text-sm font-bold leading-snug">
          {syncState === 'SYNCING' ? (
            <span>Sincronizando con el servidor…</span>
          ) : syncState === 'DONE' ? (
            <span className="font-extrabold">¡Sincronizado con éxito!</span>
          ) : syncState === 'ERROR' ? (
            <span className="font-extrabold">{errorMessage || 'Error al sincronizar'}</span>
          ) : (
            <span>Red restaurada · {effectivePending} pendiente(s)</span>
          )}
        </div>
      </div>

      {syncState !== 'DONE' && syncState !== 'ERROR' && (
        <button
          type="button"
          onClick={() => void handleSyncClick()}
          disabled={syncState === 'SYNCING'}
          aria-label="Sincronizar avisos pendientes con la red"
          className="min-h-[48px] h-12 px-4 rounded-full bg-[#5B3FD6] hover:bg-[#4a2fbd] text-white font-extrabold text-xs transition-all active:scale-[0.97] shadow-xs flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
        >
          {syncState === 'SYNCING' ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Sincronizando…</span>
            </>
          ) : (
            <span>Sincronizar</span>
          )}
        </button>
      )}
    </div>
  );
}

export default OfflineBanner;
