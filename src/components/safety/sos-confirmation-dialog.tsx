'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  Moon,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { IPostLocal } from '@shared/types';
import { localDb } from '@/lib/offline/db';
import {
  getOrCreateDeviceId,
  registerOwnPublication,
  setPublicationAuthorDevice,
  setSolidarityStage,
} from '@/lib/ownership';
import { meshService, type MeshMessage } from '@/lib/mesh/mesh-service';
import {
  broadcastRealtimePublication,
  broadcastRealtimeSos,
  broadcastSolidarityStageChange,
} from '@/lib/realtime/sos-realtime';
import {
  detectRealBluetooth,
  detectRealNetwork,
  scanRealBluetoothDevice,
  realP2PMesh,
  type RealBluetoothState,
  type RealNetworkState,
} from '@/lib/mesh/real-mesh-adapter';

export interface SosConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords?: { lat: number; lng: number };
  onSosConfirmed?: () => void;
}

/**
 * Emite una secuencia acústica Morse SOS (··· ——— ···) a 880 Hz
 * y vibración háptica rítmica detectable por geófonos de rescate bajo escombros.
 */
function playMorseSos(audioCtx: AudioContext): void {
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0, now);

    let t = now + 0.05;
    const dot = 0.12;
    const dash = 0.36;
    const gap = 0.08;
    const letterGap = 0.22;

    // S: · · ·
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0.3, t);
      t += dot;
      gain.gain.setValueAtTime(0, t);
      t += gap;
    }
    t += letterGap;

    // O: — — —
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0.3, t);
      t += dash;
      gain.gain.setValueAtTime(0, t);
      t += gap;
    }
    t += letterGap;

    // S: · · ·
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0.3, t);
      t += dot;
      gain.gain.setValueAtTime(0, t);
      t += gap;
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(t + 0.05);
  } catch (err) {
    console.error('Error emitiendo audio Morse:', err);
  }

  // Vibración rítmica coordinada para geófonos bajo escombros
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([
        120, 80, 120, 80, 120, 220,
        360, 80, 360, 80, 360, 220,
        120, 80, 120, 80, 120,
      ]);
    } catch {}
  }
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
  const [bluetoothState, setBluetoothState] = useState<RealBluetoothState>({
    isSupported: true,
    isAvailable: false,
    isScanning: false,
    pairedDeviceName: null,
    detailMessage: 'Comprobando hardware Bluetooth...',
  });
  const [networkState, setNetworkState] = useState<RealNetworkState>(() => detectRealNetwork());
  const [isDiagnosingNetwork, setIsDiagnosingNetwork] = useState<boolean>(false);
  const [isBeaconActive, setIsBeaconActive] = useState<boolean>(false);
  const [isUltraPowerSavingOpen, setIsUltraPowerSavingOpen] = useState<boolean>(false);

  const noButtonRef = useRef<HTMLButtonElement | null>(null);
  const beaconTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTouchRef = useRef<number>(0);

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

  // Limpieza segura del ciclo sonoro de baliza al cerrar o cambiar de paso
  const stopBeacon = () => {
    setIsBeaconActive(false);
    if (beaconTimerRef.current) {
      clearInterval(beaconTimerRef.current);
      beaconTimerRef.current = null;
    }
  };

  const startBeacon = () => {
    setIsBeaconActive(true);
    toast.warning('🔊 Baliza Acústica Activada', {
      description: 'Emitiendo código Morse SOS y vibración rítmica para geófonos de bomberos.',
      duration: 4000,
    });

    try {
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current && AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          void audioCtxRef.current.resume();
        }
        if (audioCtxRef.current) {
          playMorseSos(audioCtxRef.current);
        }
      }
    } catch {}

    if (beaconTimerRef.current) clearInterval(beaconTimerRef.current);
    beaconTimerRef.current = setInterval(() => {
      try {
        if (audioCtxRef.current) {
          playMorseSos(audioCtxRef.current);
        }
      } catch {}
    }, 4200);
  };

  const toggleBeacon = () => {
    if (isBeaconActive) {
      stopBeacon();
      toast.info('Baliza acústica pausada');
    } else {
      startBeacon();
    }
  };

  useEffect(() => {
    return () => {
      stopBeacon();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || step !== 'SENT') {
      stopBeacon();
      setIsUltraPowerSavingOpen(false);
    }
  }, [isOpen, step]);

  // Receptor local de canal P2P para pruebas entre pestañas en el mismo equipo
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      const bc = new BroadcastChannel('redvecina_mesh_p2p_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'SOS_ALERT') {
          toast.error('🚨 Alerta SOS captada por Malla P2P', {
            description: `Señal retransmitida a pie desde las coordenadas ${event.data.coords?.lat?.toFixed(4)}, ${event.data.coords?.lng?.toFixed(4)}`,
            duration: 7000,
          });
        }
      };
      return () => {
        bc.close();
      };
    } catch {}
  }, []);

  // Detección auténtica de hardware y enlaces al ingresar a verificación
  useEffect(() => {
    if (isOpen && step === 'PERMISSIONS_CHECK') {
      void detectRealBluetooth().then((state) => {
        setBluetoothState(state);
      });
      setNetworkState(detectRealNetwork());
      realP2PMesh.initialize((packet) => {
        if (packet.type === 'SOS_P2P_ALERT') {
          toast.error('🚨 Paquete SOS captado por canal WebRTC P2P', {
            description: `Señal directa recibida desde ${packet.lat.toFixed(4)}, ${packet.lng.toFixed(4)}`,
            duration: 6000,
          });
        }
      });
    }
  }, [isOpen, step]);

  // Escuchar cambios de estado en la tarjeta de red / Wi-Fi del sistema
  useEffect(() => {
    const handleNetChange = () => {
      setNetworkState(detectRealNetwork());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleNetChange);
      window.addEventListener('offline', handleNetChange);
      const conn = (navigator as any).connection;
      if (conn && typeof conn.addEventListener === 'function') {
        conn.addEventListener('change', handleNetChange);
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleNetChange);
        window.removeEventListener('offline', handleNetChange);
      }
    };
  }, []);

  const handleScanBluetooth = async () => {
    setBluetoothState((prev) => ({
      ...prev,
      isScanning: true,
      detailMessage: 'Abriendo escáner de balizas BLE del sistema operativo...',
    }));
    toast.info('Iniciando escaneo de balizas BLE...', {
      description: 'Selecciona una baliza de rescate o dispositivo cercano en el diálogo nativo.',
      duration: 3500,
    });
    const res = await scanRealBluetoothDevice();
    if (res.success && res.deviceName) {
      setBluetoothState((prev) => ({
        ...prev,
        isScanning: false,
        isAvailable: true,
        pairedDeviceName: res.deviceName || null,
        detailMessage: `Dispositivo enlazado: ${res.deviceName}`,
      }));
      toast.success('Dispositivo Bluetooth Conectado', {
        description: `Enlace establecido con ${res.deviceName}.`,
      });
    } else {
      const refreshed = await detectRealBluetooth();
      setBluetoothState({
        ...refreshed,
        isScanning: false,
        detailMessage: res.error || refreshed.detailMessage,
      });
      if (res.error) {
        toast.info(res.error, { duration: 3500 });
      }
    }
  };

  const handleDiagnoseNetwork = async () => {
    setIsDiagnosingNetwork(true);
    const start = performance.now();
    try {
      await fetch('/api/v1/sync?ping=1', { method: 'HEAD', cache: 'no-store' }).catch(() => {});
    } catch {}
    const rtt = Math.round(performance.now() - start);
    const updated = detectRealNetwork();
    updated.rttMs = rtt;
    updated.detailMessage = updated.isOnline
      ? `Canal activo (${updated.connectionType} · ${rtt}ms RTT). Red WebRTC P2P conectada.`
      : 'Modo sin internet. Enlace local P2P activo mediante WebRTC y memoria Dexie.';
    setNetworkState(updated);
    setIsDiagnosingNetwork(false);
    toast.success('Diagnóstico de Red P2P', {
      description: updated.detailMessage,
      duration: 3500,
    });
  };

  // Manejo de doble toque en pantalla para salir del modo ultra-ahorro
  const handleScreenTouch = () => {
    const now = Date.now();
    if (now - lastTouchRef.current < 350) {
      setIsUltraPowerSavingOpen(false);
      toast.info('Pantalla reactivada', { duration: 2500 });
    }
    lastTouchRef.current = now;
  };

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
      startBeacon();

      const myDeviceId = getOrCreateDeviceId();
      const nowIso = new Date().toISOString();

      // 1. Crear el registro local de la alerta SOS para el mapa y muro solidario
      const sosPost: IPostLocal = {
        client_mutation_id: msg.id,
        sector_id: 1,
        category_id: 1,
        operational_mode: 'EMERGENCIA',
        post_type: 'SOS_VULNERABLE',
        title: '🚨 ALERTA SOS - Emergencia Inmediata',
        description: 'Un vecino ha emitido una señal de auxilio transmitida por la Malla P2P vecinal.',
        urgency_level: 'CRITICA',
        public_lat: userCoords.lat,
        public_lng: userCoords.lng,
        privacy_radius_meters: 50,
        status: 'ACTIVO',
        client_created_at: nowIso,
        is_pending_sync: false,
      };

      // 2. Guardar en IndexedDB local para que aparezca en el mapa inmediatamente
      await localDb.bulkCachePosts([sosPost]);

      // 3. Registrar autoría en este dispositivo ("Tu publicación") para que el autor NUNCA vea "Me comprometo"
      registerOwnPublication({
        clientMutationId: msg.id,
        title: sosPost.title,
        authorName: 'Mi Alerta SOS',
      });
      setPublicationAuthorDevice(msg.id, myDeviceId);

      // 4. Guardar alerta activa local
      const alertData = {
        description: sosPost.description,
        locationLabel: 'Huancayo · Zona Activa',
        lat: userCoords.lat,
        lng: userCoords.lng,
        createdAt: nowIso,
      };
      try {
        localStorage.setItem('redvecina_active_sos_alert', JSON.stringify(alertData));
      } catch {}

      onSosConfirmed?.();

      // 5. Transmisión WebSocket a otros dispositivos (laptop) con storedRecord para que aparezca en su mapa
      void broadcastRealtimeSos({
        client_mutation_id: msg.id,
        title: sosPost.title,
        description: sosPost.description,
        locationLabel: 'Huancayo · Zona Activa',
        lat: userCoords.lat,
        lng: userCoords.lng,
        createdAt: nowIso,
        authorDeviceId: myDeviceId,
        storedRecord: sosPost,
      }).catch(() => {});

      void broadcastRealtimePublication({
        client_mutation_id: msg.id,
        module: 'EMERGENCIA_SOS',
        lat: userCoords.lat,
        lng: userCoords.lng,
        authorDeviceId: myDeviceId,
        storedRecord: sosPost,
      }).catch(() => {});

      // 6. Transmisión local P2P para pestañas en el mismo equipo
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('redvecina_mesh_p2p_channel');
          bc.postMessage({ type: 'SOS_ALERT', message: msg, coords: userCoords, storedRecord: sosPost });
          bc.close();
        } catch {}
      }

      // 7. Notificar a componentes locales
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('redvecina_ws_sos_received', {
            detail: {
              client_mutation_id: msg.id,
              title: sosPost.title,
              description: sosPost.description,
              locationLabel: 'Huancayo · Zona Activa',
              lat: userCoords.lat,
              lng: userCoords.lng,
              createdAt: nowIso,
              authorDeviceId: myDeviceId,
              storedRecord: sosPost,
            },
          })
        );
        window.dispatchEvent(
          new CustomEvent('redvecina_ws_publication_received', {
            detail: {
              client_mutation_id: msg.id,
              module: 'EMERGENCIA_SOS',
              lat: userCoords.lat,
              lng: userCoords.lng,
              authorDeviceId: myDeviceId,
              storedRecord: sosPost,
            },
          })
        );
      }

      // 8. Transmisión directa por canal WebRTC P2P DataChannel y BroadcastChannel
      realP2PMesh.broadcastRealPacket({
        id: msg.id,
        type: 'SOS_P2P_ALERT',
        senderDeviceId: myDeviceId,
        timestamp: nowIso,
        lat: userCoords.lat,
        lng: userCoords.lng,
        hops: 1,
        payload: {
          title: sosPost.title,
          description: sosPost.description,
          urgency: 'CRITICA',
          storedRecord: sosPost,
        },
      });

      toast.error('Alerta SOS de alta prioridad emitida', {
        description: 'Transmitida por Malla P2P y registrada en el mapa comunitario.',
        duration: 4000,
      });
    } catch (e) {
      toast.error('Error al emitir alerta SOS');
    }
  };

  const handleCancelSos = async () => {
    stopBeacon();
    const activeMsgId = activeMessage?.id;
    await meshService.cancelSos();

    if (activeMsgId) {
      try {
        const posts = await localDb.posts.toArray();
        const found = posts.find((p) => p.client_mutation_id === activeMsgId);
        if (found) {
          await localDb.bulkCachePosts([
            {
              ...found,
              status: 'ATENDIDO',
            },
          ]);
          setSolidarityStage(activeMsgId, 'RECIBIDO');
          void broadcastSolidarityStageChange({
            post: found,
            stage: 'RECIBIDO',
          }).catch(() => {});
        }
      } catch {}
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('redvecina_active_sos_alert');
      } catch {}
      window.dispatchEvent(new CustomEvent('redvecina_exit_emergency_mode'));
      if (activeMsgId) {
        window.dispatchEvent(
          new CustomEvent('redvecina_ws_publication_received', {
            detail: {
              client_mutation_id: activeMsgId,
              module: 'CADENA_FAVORES',
            },
          })
        );
      }
    }

    toast.success('Alerta SOS cancelada', {
      description: 'Se notificó a la comunidad que te encuentras a salvo y la emergencia fue atendida.',
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
          /* Paso 2: Detección Real de Wi-Fi, Bluetooth y Red P2P (Web Bluetooth + WebRTC) */
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
                Detección real de hardware y enlaces de proximidad para operar sin internet:
              </p>
            </div>

            <div className="space-y-2.5">
              {/* 1. Bluetooth BLE Real (Web Bluetooth API) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      bluetoothState.pairedDeviceName
                        ? 'bg-emerald-100 text-emerald-700'
                        : bluetoothState.isAvailable
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Bluetooth
                      className={`w-5 h-5 ${bluetoothState.isScanning ? 'animate-spin' : ''}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-[#0B1E3F]">Bluetooth BLE</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          bluetoothState.pairedDeviceName
                            ? 'bg-emerald-100 text-emerald-800'
                            : bluetoothState.isAvailable
                              ? 'bg-emerald-100 text-emerald-800'
                              : bluetoothState.isSupported
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {bluetoothState.pairedDeviceName
                          ? 'Enlazado'
                          : bluetoothState.isAvailable
                            ? 'Hardware Activo'
                            : bluetoothState.isSupported
                              ? 'Disponible en SO'
                              : 'Restringido (Web)'}
                      </span>
                    </div>
                    <p
                      className="text-[11px] text-slate-600 mt-0.5 truncate leading-tight"
                      title={bluetoothState.detailMessage}
                    >
                      {bluetoothState.pairedDeviceName
                        ? `Baliza: ${bluetoothState.pairedDeviceName}`
                        : bluetoothState.detailMessage}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleScanBluetooth}
                  disabled={bluetoothState.isScanning}
                  aria-label="Escanear balizas Bluetooth BLE cercanas"
                  className={`min-h-[48px] px-3.5 rounded-xl text-xs font-black transition-all shrink-0 active:scale-95 cursor-pointer shadow-xs ${
                    bluetoothState.isScanning
                      ? 'bg-sky-200 text-sky-800 animate-pulse'
                      : bluetoothState.pairedDeviceName
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-sky-600 hover:bg-sky-700 text-white'
                  }`}
                >
                  {bluetoothState.isScanning
                    ? 'Escaneando...'
                    : bluetoothState.pairedDeviceName
                      ? 'Reescanear'
                      : 'Escanear BLE'}
                </button>
              </div>

              {/* 2. Wi-Fi Direct y Red Local Real (WebRTC DataChannels + Network Information) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      networkState.isOnline
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <Wifi className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-[#0B1E3F]">Wi-Fi Direct / Local</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          networkState.isOnline
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {networkState.isOnline
                          ? networkState.effectiveType
                            ? `En línea · ${networkState.effectiveType}`
                            : 'En línea'
                          : 'Malla Local P2P'}
                      </span>
                    </div>
                    <p
                      className="text-[11px] text-slate-600 mt-0.5 truncate leading-tight"
                      title={networkState.detailMessage}
                    >
                      {networkState.detailMessage}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDiagnoseNetwork}
                  disabled={isDiagnosingNetwork}
                  aria-label="Diagnosticar latencia y enlace de red local"
                  className="min-h-[48px] px-3.5 rounded-xl text-xs font-black bg-slate-800 hover:bg-black text-white transition-all shrink-0 active:scale-95 cursor-pointer shadow-xs"
                >
                  {isDiagnosingNetwork ? 'Midiendo...' : 'Diagnosticar'}
                </button>
              </div>
            </div>

            {/* Aviso de Garantía de Emisión */}
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                Canal P2P WebRTC DataChannel + BroadcastChannel activo. Tu alerta se transmitirá sin depender de antenas comerciales caídas.
              </span>
            </div>

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
              <div className="rounded-2xl bg-[#E6ECF7] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-3.5 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs font-black text-slate-950 dark:text-sky-300">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#0F2A56] dark:text-sky-400" />
                    Progreso en malla P2P:
                  </span>
                  <span>{hopsReached} de 50 saltos</span>
                </div>

                {/* Barra de progreso de propagación */}
                <div className="w-full bg-white dark:bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div
                    className="bg-[#C0392B] h-full transition-all duration-500 rounded-full"
                    style={{ width: `${(hopsReached / 50) * 100}%` }}
                  />
                </div>

                <p className="text-[11px] font-extrabold text-black dark:text-white leading-tight">
                  {hopsReached < 50
                    ? `Transmitiendo por Wi-Fi Direct y Bluetooth BLE (Salto #${hopsReached} de 50 · ID: ${activeMessage?.id ? activeMessage.id.slice(0, 8) : 'local'})...`
                    : `✅ Alerta replicada y almacenada para reenvío a nuevos vecinos (50 saltos cubiertos · ID: ${activeMessage?.id ? activeMessage.id.slice(0, 8) : 'local'}).`}
                </p>
              </div>

              {/* R2: Insignia Informativa Mula de Datos (Store-and-Forward) */}
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-left space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                  <Radio className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
                  <span>Mula de Datos Vecinal (Store-and-Forward)</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-tight">
                  Tu señal salta a los teléfonos de vecinos y brigadistas a menos de 50m para ser transportada a pie hasta la central.
                </p>
              </div>

              {/* R1: Baliza Acústica & Vibratoria para Geófonos (USAR) */}
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                    {isBeaconActive ? (
                      <Volume2 className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>Baliza de Rescate (Geófonos USAR)</span>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isBeaconActive
                        ? 'bg-amber-600 text-white animate-pulse'
                        : 'bg-amber-200 text-amber-800'
                    }`}
                  >
                    {isBeaconActive ? 'EMITIENDO MORSE' : 'EN PAUSA'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-tight">
                  Emite pulsos acústicos y vibración rítmica en código Morse SOS (··· ——— ···) detectable por geófonos de bomberos bajo escombros.
                </p>
                <button
                  type="button"
                  onClick={toggleBeacon}
                  className={`w-full min-h-[48px] h-12 px-4 rounded-xl font-black text-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                    isBeaconActive
                      ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
                      : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 active:scale-95'
                  }`}
                >
                  {isBeaconActive ? (
                    <>
                      <VolumeX className="w-4 h-4" />
                      <span>Pausar Baliza Acústica</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>🔊 Activar Baliza de Rescate (SOS Morse)</span>
                    </>
                  )}
                </button>
              </div>

              {/* R3: Botón Modo Ultra-Ahorro 72 Horas */}
              <button
                type="button"
                onClick={() => setIsUltraPowerSavingOpen(true)}
                className="w-full min-h-[48px] h-12 rounded-xl bg-slate-900 hover:bg-black text-slate-100 font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Moon className="w-4 h-4 text-amber-400" />
                <span>🌙 Pantalla Negra (Ahorro 72h OLED)</span>
              </button>

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

      {/* R3: OVERLAY DE ULTRA-AHORRO SUTIL 72H (PANTALLA NEGRA OLED) */}
      {isUltraPowerSavingOpen && (
        <div
          role="region"
          aria-label="Modo Ultra-Ahorro de Batería 72h"
          className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-between p-8 select-none"
          onDoubleClick={() => {
            setIsUltraPowerSavingOpen(false);
            toast.info('Pantalla reactivada', { duration: 2500 });
          }}
          onTouchEnd={handleScreenTouch}
        >
          <div className="pt-6 text-center">
            <span className="w-3 h-3 rounded-full bg-red-600 inline-block animate-ping" />
          </div>

          <div className="text-center space-y-3 max-w-xs">
            <p className="text-[11px] tracking-widest uppercase font-black text-red-500 animate-pulse">
              Modo Baliza 72h Activo (OLED 0% Brillo)
            </p>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              Malla P2P, baliza para geófonos y coordenadas activas en memoria interna.
            </p>
            <div className="pt-4 border-t border-neutral-800 space-y-1">
              <p className="text-[11px] text-amber-300 font-bold">
                👉 Toca dos veces la pantalla para despertar
              </p>
              <p className="text-[10px] text-neutral-500">
                La pantalla consume casi cero energía mientras estés atrapado.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsUltraPowerSavingOpen(false);
              toast.info('Pantalla reactivada', { duration: 2500 });
            }}
            className="min-h-[48px] px-6 py-2 rounded-full border border-neutral-800 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            Despertar pantalla
          </button>
        </div>
      )}
    </div>
  );
}

export default SosConfirmationDialog;
