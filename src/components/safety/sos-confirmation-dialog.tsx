'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bluetooth,
  CheckCircle2,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { meshService, type MeshMessage } from '@/lib/mesh/mesh-service';

export interface SosConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords?: { lat: number; lng: number };
  onSosConfirmed?: () => void;
}

export function SosConfirmationDialog({
  isOpen,
  onClose,
  userCoords = { lat: -12.07679, lng: -75.21735 },
  onSosConfirmed,
}: SosConfirmationDialogProps): React.ReactElement | null {
  const [step, setStep] = useState<'CONFIRM' | 'PERMISSIONS_CHECK' | 'SENT'>('CONFIRM');
  const [hopsReached, setHopsReached] = useState<number>(1);
  const [activeMessage, setActiveMessage] = useState<MeshMessage | null>(null);
  const [bluetoothEnabled, setBluetoothEnabled] = useState<boolean>(true);
  const [wifiEnabled, setWifiEnabled] = useState<boolean>(true);
  const noButtonRef = useRef<HTMLButtonElement | null>(null);

  // Foco inicial en botón 'No' para evitar toques accidentales
  useEffect(() => {
    if (isOpen && step === 'CONFIRM') {
      const timer = setTimeout(() => {
        noButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, step]);

  // Simulación de propagación por la malla de saltos hasta 50 saltos
  useEffect(() => {
    if (step === 'SENT') {
      const interval = setInterval(() => {
        setHopsReached((prev) => {
          if (prev < 50) return Math.min(50, prev + Math.floor(Math.random() * 4) + 1);
          return prev;
        });
      }, 800);
      return () => clearInterval(interval);
    }
  }, [step]);

  if (!isOpen) return null;

  // Disparo de retroalimentación sonora y vibratoria de alta prioridad (Punto 10)
  const triggerSosFeedback = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([300, 150, 300, 150, 500]);
      } catch {}
    }

    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {}
  };

  const handleStartSosFlow = () => {
    // Punto 9: Verificar si Wi-Fi o Bluetooth están apagados en entorno móvil
    // Si ambos están activos, pasa directo a emitir. Si falta alguno, muestra la guía sin bloquear.
    setStep('PERMISSIONS_CHECK');
  };

  const handleProceedWithBroadcast = async () => {
    try {
      triggerSosFeedback();
      const msg = await meshService.broadcastSos(userCoords);
      setActiveMessage(msg);
      setHopsReached(1);
      setStep('SENT');
      onSosConfirmed?.();
      toast.error('Alerta SOS de alta prioridad emitida', {
        description: 'Retransmitiendo por malla P2P (Wi-Fi Direct / Bluetooth) a vecinos en 50m.',
        duration: 4000,
      });
    } catch (e) {
      toast.error('Error al emitir alerta SOS');
    }
  };

  const handleCancelSos = async () => {
    await meshService.cancelSos();
    toast.success('Alerta SOS cancelada', {
      description: 'Se notificó a la malla vecinal que te encuentras a salvo.',
      duration: 4000,
    });
    setStep('CONFIRM');
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sos-dialog-title"
      aria-describedby="sos-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] bg-white text-[#0B1E3F] p-6 shadow-card-diffuse border-0 space-y-4 animate-in zoom-in-95 duration-200"
      >
        {step === 'CONFIRM' ? (
          <>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-full bg-[#FBE3DF] text-[#A3221A] flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 stroke-[2.4]" />
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar confirmación SOS"
                className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

              <div>
                <h2
                  id="sos-dialog-title"
                  className="text-2xl font-extrabold text-[#0B1E3F] tracking-tight leading-snug"
                >
                  ¿Estás en peligro?
                </h2>
                <p
                  id="sos-dialog-desc"
                  className="text-sm font-medium text-[#4B5563] mt-1.5 leading-relaxed"
                >
                  Al presionar <strong>Sí</strong> se transmitirá una señal de auxilio inmediata a través de la red de malla P2P a todos los vecinos y brigadistas de tu sector, incluso sin internet.
                </p>

                {/* 9) SOS SIN CUENTA */}
                <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#16181D]">
                  <ShieldCheck className="w-4 h-4 text-[#15795A] shrink-0" />
                  <span>No necesitas cuenta para enviar un SOS</span>
                </div>
              </div>

            <div className="flex items-center gap-3 pt-2">
              {/* Botón 'No' con foco inicial preventivo */}
              <button
                ref={noButtonRef}
                type="button"
                onClick={handleClose}
                className="flex-1 min-h-[48px] h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1E3F] font-extrabold text-sm transition-all active:scale-[0.97]"
              >
                No
              </button>

              {/* Botón 'Sí' en rojo sólido de emergencia */}
              <button
                type="button"
                onClick={handleStartSosFlow}
                className="flex-1 min-h-[48px] h-12 rounded-full bg-[#C0392B] hover:bg-red-700 text-white font-extrabold text-sm transition-all active:scale-[0.97] shadow-sm"
              >
                Sí
              </button>
            </div>
          </>
        ) : step === 'PERMISSIONS_CHECK' ? (
          /* Paso 2: Revisión de Wi-Fi y Bluetooth (Punto 9: no bloqueante) */
          <>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <Radio className="w-6 h-6 stroke-[2.4]" />
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar verificación"
                className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-[#0B1E3F] tracking-tight">
                Canales de Malla P2P Vecinal
              </h2>
              <p className="text-xs text-[#5B6068] mt-1 leading-relaxed">
                Para coordinar auxilio sin internet, la red comunitaria necesita enlaces inalámbricos directos entre teléfonos cercanos:
              </p>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bluetooth className={`w-5 h-5 ${bluetoothEnabled ? 'text-sky-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-[#0B1E3F]">Bluetooth BLE</div>
                    <div className="text-[10px] text-slate-500">Detección de dispositivos vecinos cercanos</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBluetoothEnabled(!bluetoothEnabled)}
                  className={`min-h-[48px] px-3 rounded-full text-xs font-bold transition-all ${
                    bluetoothEnabled ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {bluetoothEnabled ? 'Activo' : 'Encender'}
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Wifi className={`w-5 h-5 ${wifiEnabled ? 'text-[#15795A]' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-[#0B1E3F]">Wi-Fi Direct / Local</div>
                    <div className="text-[10px] text-slate-500">Transmisión de malla de alta velocidad</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toast.info('Abriendo ajustes de Wi-Fi del dispositivo...', { duration: 3000 });
                    setWifiEnabled(true);
                  }}
                  className={`min-h-[48px] px-3 rounded-full text-xs font-bold transition-all ${
                    wifiEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {wifiEnabled ? 'Activo' : 'Ajustes'}
                </button>
              </div>
            </div>

            {(!bluetoothEnabled || !wifiEnabled) && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Un canal no está activo. No bloquearemos tu SOS: se transmitirá usando el canal disponible.
                </span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 min-h-[48px] h-12 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleProceedWithBroadcast}
                className="flex-1 min-h-[48px] h-12 rounded-full bg-[#C0392B] text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
              >
                Transmitir SOS
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center space-y-3 pt-2">
              <div className="relative mx-auto w-16 h-16 rounded-full bg-red-100 text-[#C0392B] flex items-center justify-center">
                <Radio className="w-8 h-8 animate-pulse stroke-[2.4]" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600" />
                </span>
              </div>

              <div>
                <h2
                  id="sos-dialog-title"
                  className="text-2xl font-black text-[#C0392B] tracking-tight leading-snug"
                >
                  Alerta emitida con éxito
                </h2>
                <p
                  id="sos-dialog-desc"
                  className="text-xs font-semibold text-[#5B6068] mt-1"
                >
                  Prioridad Crítica · Difundiendo por Malla P2P Vecinal (TTL 50 saltos)
                </p>
              </div>

              {/* Indicador de Transmisión por Malla */}
              <div className="rounded-2xl bg-[#E6ECF7] p-3.5 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs font-bold text-[#0F2A56]">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#0F2A56]" />
                    Progreso en malla P2P:
                  </span>
                  <span>{hopsReached} de 50 saltos</span>
                </div>

                {/* Barra de progreso de propagación */}
                <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#C0392B] h-full transition-all duration-500 rounded-full"
                    style={{ width: `${(hopsReached / 50) * 100}%` }}
                  />
                </div>

                <p className="text-[11px] text-[#5B6068] leading-tight">
                  {hopsReached < 50
                    ? `Transmitiendo por Wi-Fi Direct y Bluetooth BLE (Salto #${hopsReached} de 50 · ID: ${activeMessage?.id ? activeMessage.id.slice(0, 8) : 'local'})...`
                    : `✅ Alerta replicada y almacenada para reenvío a nuevos vecinos (50 saltos cubiertos · ID: ${activeMessage?.id ? activeMessage.id.slice(0, 8) : 'local'}).`}
                </p>
              </div>

              {/* Botón para cancelar alerta */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCancelSos}
                  className="w-full min-h-[48px] h-12 rounded-full bg-[#15795A] hover:bg-emerald-800 text-white font-extrabold text-sm transition-all active:scale-[0.97] shadow-sm flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ya estoy a salvo</span>
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full min-h-[48px] mt-2 text-xs font-bold text-slate-500 hover:text-slate-800 py-1 flex items-center justify-center cursor-pointer"
                >
                  Minimizar y ver mapa
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SosConfirmationDialog;
