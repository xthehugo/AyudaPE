'use client';

import React from 'react';
import { AlertTriangle, WifiOff, ShieldCheck } from 'lucide-react';

export interface OfflineEmergencyPromptProps {
  isOpen: boolean;
  onJustNoSignal: () => void;
  onNeedHelp: () => void;
}

/**
 * Diálogo Táctico ante Pérdida de Conectividad / Corte de Red:
 * Pregunta al vecino si se trata únicamente de pérdida temporal de señal o si se encuentra
 * en situación de emergencia y requiere ayuda comunitaria (malla P2P).
 */
export function OfflineEmergencyPrompt({
  isOpen,
  onJustNoSignal,
  onNeedHelp,
}: OfflineEmergencyPromptProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-emergency-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-[#0B1E3F] dark:text-slate-100"
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <WifiOff className="w-6 h-6 stroke-[2.4]" aria-hidden="true" />
        </div>

        <div className="text-center space-y-1.5">
          <h2
            id="offline-emergency-title"
            className="text-lg font-black tracking-tight text-[#0B1E3F] dark:text-white leading-snug"
          >
            Se ha perdido la conexión
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            Se activó el protocolo de resiliencia barrial. ¿Se trata solo de una caída de cobertura o necesitas auxilio vecinal?
          </p>
        </div>

        <div className="space-y-2 pt-2">
          {/* Opción 1: Necesito ayuda -> Mantiene Modo Emergencia y abre flujo de apoyo/SOS */}
          <button
            type="button"
            onClick={onNeedHelp}
            className="w-full min-h-[48px] h-12 px-4 rounded-xl bg-[#DC2626] hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Necesito ayuda en mi cuadra</span>
          </button>

          {/* Opción 2: Solo pérdida de cobertura -> Regresa al modo normal */}
          <button
            type="button"
            onClick={onJustNoSignal}
            className="w-full min-h-[48px] h-12 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Solo es pérdida de señal (Estoy bien)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default OfflineEmergencyPrompt;
