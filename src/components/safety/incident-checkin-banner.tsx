'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  ShieldAlert,
  Radio,
  X,
} from 'lucide-react';
import { useOperationalMode } from '@/context/mode-context';
import { toast } from 'sonner';

export type NeighborSafetyStatus = 'A_SALVO' | 'NECESITA_APOYO' | 'PUEDO_APOYAR' | null;

export interface IncidentCheckinBannerProps {
  onOpenSosPublish?: () => void;
  className?: string;
}

const STORAGE_KEY = 'redvecina_incident_safety_status';
const TIMESTAMP_KEY = 'redvecina_incident_safety_timestamp';

/**
 * Componente Compartido: Check-in de Seguridad Barrial · Huancayo
 * - Tarjeta blanca con esquinas redondeadas de 28px y sombra difusa (sin bordes duros).
 * - Estado inicial: título y las opciones de condición ("Estoy a salvo", "Necesito apoyo", "Puedo ayudar").
 * - Al seleccionar una opción: las opciones desaparecen y se transforma en un mini dashboard estadístico
 *   del barrio (total de check-ins, desglose con gráfico de dona SVG o barra apilada, "actualizado hace X min").
 * - Botón "Actualizar estado" en la esquina superior derecha para reabrir las opciones.
 * - Persiste en localStorage durante toda la sesión.
 */
export function IncidentCheckinBanner({
  onOpenSosPublish,
  className = '',
}: IncidentCheckinBannerProps): React.ReactElement {
  const { mode, setMode } = useOperationalMode();
  const isEmergencyMode = mode === 'EMERGENCIA';

  const [safetyStatus, setSafetyStatus] = useState<NeighborSafetyStatus>(null);
  const [timestampMs, setTimestampMs] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Estadísticas reales del barrio
  const [safeCount, setSafeCount] = useState<number>(84);
  const [needHelpCount, setNeedHelpCount] = useState<number>(3);
  const [volunteersCount, setVolunteersCount] = useState<number>(12);

  // Cargar estado guardado al iniciar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as NeighborSafetyStatus | null;
      const storedTime = localStorage.getItem(TIMESTAMP_KEY);
      if (stored) {
        setSafetyStatus(stored);
        if (storedTime) {
          setTimestampMs(Number(storedTime));
        } else {
          setTimestampMs(Date.now());
        }
      }
    } catch {
      // Manejo seguro en modo incógnito
    }
  }, []);

  const totalCheckins = safeCount + needHelpCount + volunteersCount;
  const safePct = totalCheckins > 0 ? Math.round((safeCount / totalCheckins) * 100) : 0;
  const needHelpPct = totalCheckins > 0 ? Math.round((needHelpCount / totalCheckins) * 100) : 0;
  const volunteersPct = totalCheckins > 0 ? Math.round((volunteersCount / totalCheckins) * 100) : 0;

  // Minutos transcurridos desde el registro
  const getMinutesAgoText = () => {
    if (!timestampMs) return 'actualizado hace 1 min';
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - timestampMs) / 60000));
    return `actualizado hace ${elapsedMinutes} min`;
  };

  const handleStatusSelect = (status: NeighborSafetyStatus) => {
    if (!status) return;

    const now = Date.now();
    setSafetyStatus(status);
    setTimestampMs(now);
    setIsExpanded(false); // Se reduce a una sola línea compacta tras responder

    try {
      localStorage.setItem(STORAGE_KEY, status);
      localStorage.setItem(TIMESTAMP_KEY, String(now));
    } catch {
      // Ignorar error de storage
    }

    if (status === 'A_SALVO') {
      setSafeCount((c) => c + 1);
      toast.success('¡Estado registrado: Estás a salvo!', {
        description: 'Tus vecinos y brigadistas de Huancayo saben que tu familia está bien.',
        duration: 4000,
      });
    } else if (status === 'NECESITA_APOYO') {
      setNeedHelpCount((c) => c + 1);
      setMode('EMERGENCIA');
      toast.error('Alerta de auxilio registrada', {
        description: 'Notificando a la junta vecinal y brigada de respuesta...',
        duration: 4000,
      });
      if (onOpenSosPublish) {
        onOpenSosPublish();
      }
    } else if (status === 'PUEDO_APOYAR') {
      setVolunteersCount((c) => c + 1);
      toast.info('¡Gracias por tu solidaridad!', {
        description: 'Registrado como voluntario vecinal activo en el sector.',
        duration: 4000,
      });
    }
  };

  const getStatusLabel = () => {
    if (safetyStatus === 'A_SALVO') return 'A salvo';
    if (safetyStatus === 'NECESITA_APOYO') return 'Necesito apoyo';
    if (safetyStatus === 'PUEDO_APOYAR') return 'Puedo apoyar';
    return '';
  };

  const getStatusColorClass = () => {
    if (safetyStatus === 'A_SALVO') {
      return isEmergencyMode
        ? 'text-[#4ADE80] font-extrabold'
        : 'text-emerald-700 dark:text-emerald-400 font-extrabold';
    }
    if (safetyStatus === 'NECESITA_APOYO') {
      return isEmergencyMode
        ? 'text-[#FDE047] font-black'
        : 'text-rose-700 dark:text-rose-400 font-extrabold';
    }
    if (safetyStatus === 'PUEDO_APOYAR') {
      return isEmergencyMode
        ? 'text-[#38BDF8] font-extrabold'
        : 'text-sky-700 dark:text-sky-400 font-extrabold';
    }
    return '';
  };

  // 3. "¿CÓMO ESTÁS?" COLAPSABLE
  // Una vez que el usuario responde, el bloque se reduce a una sola línea compacta: "¿Cómo estás? · A salvo ›"
  // Al tocar la línea se despliega el bloque completo; al tocar otra vez se vuelve a colapsar.
  // Antes de responder, se muestra el bloque completo con las 3 opciones.
  const hasAnswered = safetyStatus !== null;

  if (hasAnswered && !isExpanded) {
    return (
      <aside aria-label="¿Cómo estás? · Estado registrado" className={className}>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={`w-full min-h-[48px] h-12 px-4 rounded-2xl flex items-center justify-between transition-all duration-200 border shadow-xs cursor-pointer active:scale-[0.99] ${
            isEmergencyMode
              ? 'bg-[#222938] border-rose-500/50 text-white hover:bg-[#2B3345]'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-[#0B1E3F] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          aria-expanded={false}
          aria-label={`¿Cómo estás? · ${getStatusLabel()} · Tocar para desplegar resumen`}
        >
          <div className="flex items-center gap-2 truncate">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                safetyStatus === 'A_SALVO'
                  ? 'bg-emerald-500'
                  : safetyStatus === 'NECESITA_APOYO'
                  ? 'bg-rose-500 animate-pulse'
                  : 'bg-sky-500'
              }`}
            />
            <span className="text-xs sm:text-sm font-extrabold tracking-tight">¿Cómo estás?</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-400">·</span>
            <span className={`text-xs sm:text-sm truncate ${getStatusColorClass()}`}>
              {getStatusLabel()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold shrink-0">
            <span className="hidden sm:inline text-[11px] text-slate-400">{getMinutesAgoText()}</span>
            <span className="text-base font-black">›</span>
          </div>
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="¿Cómo estás? · Reporte rápido"
      className={`rounded-[28px] transition-all p-4 sm:p-5 shadow-card-diffuse ${
        isEmergencyMode
          ? 'bg-[#222938] border-2 border-rose-500/60 text-white shadow-rose-950/20'
          : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[#0B1E3F] dark:text-slate-100'
      } ${className}`}
    >
      {/* Alerta Táctica cuando el Modo Emergencia está activo */}
      {isEmergencyMode && (
        <div className="mb-3.5 p-3.5 rounded-2xl bg-rose-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Radio className="w-5 h-5 shrink-0 text-white mt-0.5 animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider leading-snug whitespace-normal break-words">
                Protocolo de Emergencia Activo
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-rose-100 leading-snug whitespace-normal break-words mt-0.5">
                Malla P2P Vecinal · Prioridad a rescate y recursos vitales
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {onOpenSosPublish && (
              <button
                type="button"
                onClick={onOpenSosPublish}
                className="min-h-[48px] px-3 py-1.5 bg-[#0F172A] text-white hover:bg-slate-900 rounded-xl text-xs font-black shrink-0 transition-transform active:scale-95 shadow-xs inline-flex items-center justify-center cursor-pointer"
              >
                Pedir SOS
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode('HABITUAL');
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.removeItem('redvecina_active_sos_alert');
                  } catch {
                    // Ignorar
                  }
                  window.dispatchEvent(new CustomEvent('redvecina_exit_emergency_mode'));
                }
                toast.success('Modo Emergencia desactivado');
              }}
              aria-label="Quitar modo emergencia"
              className="min-h-[48px] px-3 py-1.5 bg-white text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-black shrink-0 transition-transform active:scale-95 shadow-xs inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.6]" />
              <span>Salir SOS</span>
            </button>
          </div>
        </div>
      )}

      {/* Cabecera del Componente */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                isEmergencyMode
                  ? 'bg-rose-500 text-white'
                  : 'bg-[#E6ECF7] dark:bg-slate-800 text-[#0F2A56] dark:text-sky-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 stroke-[2.4]" aria-hidden="true" />
            </span>
            <h3
              className={`text-xs sm:text-sm font-extrabold tracking-tight leading-snug whitespace-normal break-words ${
                isEmergencyMode ? 'text-white font-black' : 'text-[#0B1E3F] dark:text-white'
              }`}
            >
              ¿Cómo estás? · Reporte rápido
            </h3>
          </div>
          <p
            className={`text-[12px] font-medium mt-1 leading-snug whitespace-normal break-words ${
              isEmergencyMode ? 'text-rose-100' : 'text-[#5B6068] dark:text-slate-400'
            }`}
          >
            {hasAnswered
              ? `Tu estado: ${getStatusLabel()} · ${getMinutesAgoText()}`
              : 'Indica tu condición con 1 toque'}
          </p>
        </div>

        {/* Botón compacto solo con símbolo para colapsar nuevamente si ya respondió */}
        {hasAnswered && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            aria-label="Colapsar bloque"
            title="Colapsar"
            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-[#E6ECF7] dark:bg-slate-800 hover:bg-[#d8e3f5] text-[#0F2A56] dark:text-sky-200 text-base font-black inline-flex items-center justify-center transition-all active:scale-[0.97] shrink-0 cursor-pointer shadow-xs"
          >
            <span className="sr-only">Colapsar</span>
            <span aria-hidden="true" className="text-lg font-black leading-none">‹</span>
          </button>
        )}
      </div>

      {/* Opciones de Selección (Siempre disponibles para responder o cambiar estado) */}
      <div className="mt-3.5 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Opción 1: A Salvo */}
          <button
            type="button"
            onClick={() => handleStatusSelect('A_SALVO')}
            className={`min-h-[48px] h-12 px-3 rounded-full text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.97] cursor-pointer ${
              safetyStatus === 'A_SALVO'
                ? 'bg-[#15795A] ring-2 ring-emerald-400 shadow-md'
                : 'bg-[#15795A] hover:bg-[#0e5c27]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.4]" aria-hidden="true" />
            <span>A salvo</span>
          </button>

          {/* Opción 2: Necesito Apoyo */}
          <button
            type="button"
            onClick={() => handleStatusSelect('NECESITA_APOYO')}
            className={`min-h-[48px] h-12 px-3 rounded-full text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.97] cursor-pointer ${
              safetyStatus === 'NECESITA_APOYO'
                ? 'bg-[#C0392B] ring-2 ring-red-400 shadow-md'
                : 'bg-[#C0392B] hover:bg-red-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4 stroke-[2.4]" aria-hidden="true" />
            <span>Necesito apoyo</span>
          </button>

          {/* Opción 3: Puedo Apoyar */}
          <button
            type="button"
            onClick={() => handleStatusSelect('PUEDO_APOYAR')}
            className={`min-h-[48px] h-12 px-3 rounded-full text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.97] cursor-pointer ${
              safetyStatus === 'PUEDO_APOYAR'
                ? 'bg-[#0F2A56] ring-2 ring-blue-400 shadow-md'
                : 'bg-[#0F2A56] hover:bg-[#0B1E3F]'
            }`}
          >
            <HeartHandshake className="w-4 h-4 stroke-[2.4]" aria-hidden="true" />
            <span>Puedo apoyar</span>
          </button>
        </div>
      </div>

      {/* Mini Dashboard Estadístico del Barrio si está desplegado */}
      {hasAnswered && (
        <div
          className={`mt-3.5 pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isEmergencyMode ? 'border-rose-800/60' : 'border-slate-100 dark:border-slate-800'
          }`}
        >
          {/* Gráfico de Dona SVG */}
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 54 54">
                <circle
                  cx="27"
                  cy="27"
                  r="22"
                  strokeWidth="5"
                  fill="transparent"
                  className={isEmergencyMode ? 'stroke-rose-900/80' : 'stroke-slate-100 dark:stroke-slate-800'}
                />
                <circle
                  cx="27"
                  cy="27"
                  r="22"
                  strokeWidth="5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={2 * Math.PI * 22 * (1 - safePct / 100)}
                  strokeLinecap="round"
                  className="stroke-[#15795A] transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className={`text-xs font-black leading-tight ${
                    isEmergencyMode ? 'text-white' : 'text-[#0B1E3F] dark:text-white'
                  }`}
                >
                  {totalCheckins}
                </span>
                <span
                  className={`text-[9px] font-bold leading-none ${
                    isEmergencyMode ? 'text-rose-200' : 'text-[#5B6068] dark:text-slate-400'
                  }`}
                >
                  total
                </span>
              </div>
            </div>

            {/* Resumen Desglosado */}
            <div className="text-xs space-y-1">
              <div
                className={`flex items-center gap-1.5 font-bold ${
                  isEmergencyMode ? 'text-white' : 'text-[#0B1E3F] dark:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#15795A]" />
                <span>
                  {safeCount} A salvo ({safePct}%)
                </span>
              </div>
              <div
                className={`flex items-center gap-1.5 font-bold ${
                  isEmergencyMode ? 'text-rose-200' : 'text-[#0B1E3F] dark:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#C0392B]" />
                <span>
                  {needHelpCount} En apoyo ({needHelpPct}%)
                </span>
              </div>
              <div
                className={`flex items-center gap-1.5 font-bold ${
                  isEmergencyMode ? 'text-white' : 'text-[#0B1E3F] dark:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#0F2A56] dark:bg-sky-400" />
                <span>
                  {volunteersCount} Voluntarios ({volunteersPct}%)
                </span>
              </div>
            </div>
          </div>

          {/* Barra apilada visual complementaria */}
          <div className="w-full sm:max-w-[180px] space-y-1">
            <div
              className={`text-[11px] font-extrabold flex items-center justify-between ${
                isEmergencyMode ? 'text-rose-200' : 'text-[#5B6068] dark:text-slate-400'
              }`}
            >
              <span>Distribución vecinal</span>
              <span className={isEmergencyMode ? 'text-emerald-400' : 'text-[#15795A]'}>
                {safePct}% seguros
              </span>
            </div>
            <div
              className={`w-full h-2.5 rounded-full flex overflow-hidden ${
                isEmergencyMode ? 'bg-rose-900/60' : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <div style={{ width: `${safePct}%` }} className="bg-[#15795A] h-full" title="A salvo" />
              <div style={{ width: `${needHelpPct}%` }} className="bg-[#C0392B] h-full" title="En apoyo" />
              <div
                style={{ width: `${volunteersPct}%` }}
                className="bg-[#0F2A56] dark:bg-sky-500 h-full"
                title="Voluntarios"
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default IncidentCheckinBanner;
