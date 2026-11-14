'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Heart,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  Navigation,
  Phone,
  PhoneCall,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { useOperationalMode } from '@/context/mode-context';
import { useLocation } from '@/context/location-context';
import { useNetworkSync } from '@/hooks/use-network-sync';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import {
  NeighborhoodCopilotService,
  type CopilotResponse,
} from '@/lib/ai/copilot-service';
import {
  isAcousticBeaconActive,
  subscribeAcousticBeacon,
  toggleAcousticBeacon,
} from '@/lib/safety/acoustic-beacon';
import { localDb, type RedVecinaLocalDB } from '@/lib/offline/db';
import {
  calculateDistanceMeters,
  formatDistance,
  estimateWalkingMinutes,
  resolveApproximateZoneLabel,
} from '@/lib/geo-utils';

export interface CopilotViewProps {
  customDb?: RedVecinaLocalDB;
}

export interface CopilotModalDetail {
  type: 'SPECIALIST' | 'ALERT';
  badgeType: 'OFICIOS Y SERVICIOS' | 'COMERCIO LOCAL' | 'EMERGENCIA SOS' | 'MURO SOLIDARIO';
  title: string;
  shortName?: string;
  categoryLabel: string;
  description: string;
  contact_phone?: string;
  public_lat?: number;
  public_lng?: number;
  distanceMeters?: number;
  endorsement_count?: number;
  weighted_trust_score?: number;
  available_for_emergencies?: boolean;
  emergency_response_note?: string;
  urgency_level?: string;
  status?: string;
}

const QUICK_PROMPTS = [
  '¿Quién me puede ayudar con una fuga de agua en el caño?',
  'Necesito una enfermera o apoyo con balón de oxígeno urgente',
  '¿Qué electricista de confianza atiende cortocircuitos en la cuadra?',
  '¿Quién enseña clases particulares de matemáticas o química?',
  '¿Dónde comprar comida, almuerzo casero o panadería cerca?',
  '¿Hay cerrajero disponible para abrir una puerta trabada?',
  '¿Dónde conseguir muletas o andador para un adulto mayor?',
];

const EMERGENCY_TRIAGE_CHIPS = [
  { label: 'Atrapado / Escombros', query: 'Estoy atrapado bajo escombros por derrumbe de pared' },
  { label: 'Control de hemorragias', query: 'Tengo un corte profundo con hemorragia grave y abundante sangre' },
  { label: 'Quemaduras y humo', query: 'Accidente con fuego y quemadura grave por agua caliente o humo' },
  { label: 'Atragantamiento (Heimlich)', query: 'Una persona se está atragantando y no puede respirar asfixia' },
  { label: 'Crisis de pánico (4-4-4)', query: 'Tengo taquicardia crisis de pánico y shock post-sismo' },
  { label: 'Fracturas e inmovilización', query: 'Sospecha de fractura de hueso o caída con golpe en cuello y espalda' },
];

function parseInitialsAndShortName(title: string): { initials: string; shortName: string } {
  const clean = title.replace(/^(?:Lic\.|Prof\.|Técnico|Maestro|Don|Doña|Vecina|Vecino)\s+/i, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const shortName = words[0] || 'Vecino';
  let initials = 'OF';
  if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    initials = words[0].slice(0, 2).toUpperCase();
  }
  return { initials, shortName };
}

/**
 * Vista de Conversación Asistida por IA Barrial (Módulo IA) con tarjetas de estilo Oficio y Solidario,
 * y modal Bottom Sheet tipo Mapa al tocar cualquier punto recomendado.
 */
export function CopilotView({ customDb }: CopilotViewProps): React.ReactElement {
  const { mode, activeRole } = useOperationalMode();
  const { userCoords } = useLocation();
  const { isOnline } = useNetworkSync(1);
  const db = customDb ?? localDb;
  const { isListening, transcript, startListening, stopListening } = useVoiceRecognition();

  const [queryText, setQueryText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CopilotModalDetail | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);
  const [isBeaconActive, setIsBeaconActive] = useState<boolean>(isAcousticBeaconActive());
  const [isTriageOpen, setIsTriageOpen] = useState<boolean>(false);
  const [isQuickPromptsOpen, setIsQuickPromptsOpen] = useState<boolean>(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeAcousticBeacon((active) => {
      setIsBeaconActive(active);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDetailDrawerOpen(false);
        setSelectedDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (transcript.trim().length > 0) {
      setQueryText(transcript);
    }
  }, [transcript]);

  const handleAskCopilot = useCallback(
    async (overrideQuestion?: string) => {
      const question = (overrideQuestion ?? queryText).trim();
      if (question.length < 3) return;
      setIsLoading(true);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      try {
        const service = new NeighborhoodCopilotService({
          db,
          isOnline,
          fetchImpl: (input, init) => fetch(input, init),
        });
        const res = await service.ask(question, mode);
        console.log('[IA Barrial RAG]', res.answer);
        setResponse(res);
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      } finally {
        setIsLoading(false);
      }
    },
    [db, isOnline, mode, queryText]
  );

  const openDetailDrawer = (detail: CopilotModalDetail) => {
    setSelectedDetail(detail);
    setIsDetailDrawerOpen(true);
  };

  return (
    <section aria-label="Asistente de Inteligencia Artificial (IA)" className="space-y-4">
      {/* Encabezado del Módulo IA */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
            Asistente de Inteligencia Artificial (IA)
          </h2>
          <span
            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border shadow-2xs transition-all ${
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-extrabold'
            }`}
          >
            {isOnline ? 'En línea: Gemini 3.5' : 'Offline: RAG Local P2P'}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
          Pregunta con tu voz o escribe: consulta especialistas y alertas locales en memoria offline
        </p>
      </div>

      {/* Carrusel Táctico de Triaje y Primeros Auxilios (Colapsable) */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsTriageOpen((prev) => !prev)}
          aria-expanded={isTriageOpen}
          aria-controls="triage-carousel-content"
          className="w-full min-h-[48px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-red-100/50 dark:hover:bg-red-900/30 transition-colors"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Radio className="w-3.5 h-3.5 text-red-600 animate-pulse shrink-0" />
            <span className="text-xs font-black uppercase text-red-700 dark:text-red-400 tracking-wider truncate">
              Triaje Táctico & Primeros Auxilios (1 toque)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-red-600/90 dark:text-red-300 uppercase">
              {isTriageOpen ? 'Ocultar' : 'Ver 6 guías'}
            </span>
            {isTriageOpen ? (
              <ChevronUp className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
          </div>
        </button>

        {isTriageOpen && (
          <div
            id="triage-carousel-content"
            className="p-3 pt-0 space-y-2 border-t border-red-200/60 dark:border-red-900/40 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-0.5 pt-2">
              <span>Doctrina USAR / INDECI / Bomberos CGBVP</span>
              <span className="text-red-600 font-bold">Selecciona una guía</span>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              {EMERGENCY_TRIAGE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setQueryText(chip.query);
                    void handleAskCopilot(chip.query);
                  }}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl border-2 border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 text-xs font-black text-red-900 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 shadow-2xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between gap-3 text-left"
                >
                  <span className="leading-snug">{chip.label}</span>
                  <ArrowUpRight className="w-4 h-4 text-red-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Consultas Rápidas en Carrusel Horizontal Deslizable (Colapsable) */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsQuickPromptsOpen((prev) => !prev)}
          aria-expanded={isQuickPromptsOpen}
          aria-controls="quick-prompts-carousel-content"
          className="w-full min-h-[48px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">
              Preguntas frecuentes de 1 toque
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {isQuickPromptsOpen ? 'Ocultar' : 'Ver ejemplos'}
            </span>
            {isQuickPromptsOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
            )}
          </div>
        </button>

        {isQuickPromptsOpen && (
          <div
            id="quick-prompts-carousel-content"
            className="p-3 pt-0 space-y-2 border-t border-slate-200/70 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase px-0.5 pt-2">
              <span>Toca una opción para autocompletar</span>
              <span>Preguntas barriales</span>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQueryText(q);
                    void handleAskCopilot(q);
                  }}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs transition-all active:scale-[0.98] flex items-center justify-between gap-3 cursor-pointer text-left"
                >
                  <span className="leading-snug">“{q}”</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Entrada Conversacional en Cápsula */}
      <div className="rounded-3xl border border-slate-200/90 bg-white dark:bg-slate-900 p-4 shadow-soft space-y-3">
        <label htmlFor="ia-query-input" className="block text-xs font-black text-slate-700 dark:text-slate-200">
          Consulta al asistente de inteligencia artificial:
        </label>
        <textarea
          id="ia-query-input"
          rows={2}
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleAskCopilot();
            }
          }}
          placeholder="Ej: ¿Quién me puede ayudar con una fuga de agua o balón de oxígeno?"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 dark:bg-slate-800/50 p-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            aria-pressed={isListening}
            className={`min-h-[48px] px-4 rounded-full border text-xs font-extrabold inline-flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
              isListening
                ? 'bg-red-50 text-red-600 border-red-300 dark:bg-red-950 dark:text-red-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4 text-red-600" />
                <span>Detener Voz</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-slate-600" />
                <span>Dictar (es-PE)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleAskCopilot()}
            disabled={isLoading || queryText.trim().length < 3}
            className="min-h-[48px] flex-1 px-5 rounded-full bg-[#0F2A56] hover:bg-[#0B1E3F] text-white font-extrabold text-xs uppercase tracking-wide disabled:opacity-45 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            {isLoading ? 'Consultando IA...' : 'Consultar a la IA'}
          </button>
        </div>
      </div>

      {/* Ancla para desplazamiento suave directo a resultados */}
      <div ref={resultsRef} className="scroll-mt-6" />

      {/* Indicador de carga activo con retroalimentación visual inmediata */}
      {isLoading && (
        <div className="rounded-2xl border-2 border-dashed border-[#0F2A56]/30 dark:border-sky-500/30 p-4 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center gap-2.5 text-xs font-black text-[#0F2A56] dark:text-sky-300 animate-pulse">
          <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
          <span>Procesando protocolo táctico y consultando base offline...</span>
        </div>
      )}

      {/* Respuesta de la IA */}
      {response && (
        <div
          role="region"
          aria-label="Resultados del Asistente de Inteligencia Artificial"
          className="space-y-4"
        >
          {/* Barra de telemetría y motor */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 flex items-center justify-between text-[11px] font-bold text-slate-500 shadow-2xs">
            <span className="flex items-center gap-1.5 text-[#0F2A56] dark:text-sky-300 font-extrabold">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{response.used_cloud_llm ? 'Gemini 3.5 Flash + RAG IA Barrial' : 'RAG Determinista Local Offline'}</span>
            </span>
            <span>Latencia: {response.latency_ms} ms</span>
          </div>

          {/* Respuesta Conversacional Directa del Copiloto */}
          {response.answer && (response.used_cloud_llm || !response.emergency_scenario) && (
            <div className="rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-soft space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="w-7 h-7 rounded-xl bg-[#0F2A56] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-xs font-black text-[#0B1E3F] dark:text-white uppercase tracking-wider">
                  {response.used_cloud_llm ? 'Respuesta Asistida por Gemini 3.5 Flash' : 'Respuesta del Copiloto AyudaPE'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-line">
                {response.answer}
              </p>
            </div>
          )}

          {/* Tarjeta Táctica de Triaje y Primeros Auxilios (Doctrina USAR / INDECI / Bomberos CGBVP) */}
          {response.emergency_scenario && (
            <div
              role="alert"
              className="rounded-[28px] border-2 border-red-500/70 bg-red-50/60 dark:bg-red-950/30 p-4 sm:p-5 space-y-4 shadow-lg animate-in fade-in duration-200"
            >
              {/* Encabezado: Insignia de Urgencia y Título */}
              <div className="flex items-start justify-between gap-3 border-b border-red-200/80 dark:border-red-900/60 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                      Triaje · {response.emergency_scenario.urgencyLevel}
                    </span>
                    <span className="text-[11px] font-bold text-red-900 dark:text-red-300">
                      {response.emergency_scenario.shortTag}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-red-950 dark:text-red-100 leading-snug">
                    {response.emergency_scenario.title}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
              </div>

              {/* Mensaje de Calma y Contención Psicológica */}
              <div className="p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-red-200 dark:border-red-900/80 text-xs sm:text-sm font-extrabold text-red-900 dark:text-red-200 italic leading-relaxed">
                "{response.emergency_scenario.calmMessage}"
              </div>

              {/* Acciones Inmediatas (Primeros 30 Segundos) */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-red-900 dark:text-red-300">
                  Acción Inmediata (Primeros 30 segundos)
                </h4>
                <div className="space-y-2">
                  {response.emergency_scenario.immediateActions.map((action, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-red-200/60 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 space-y-0.5"
                    >
                      <p className="font-black text-red-950 dark:text-red-200 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black inline-flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span>{action.title}</span>
                      </p>
                      <p className="font-medium text-slate-600 dark:text-slate-300 pl-5.5 leading-relaxed">
                        {action.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Herramientas Nativas de AyudaPE */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Herramientas Tácticas Integradas
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Botón Baliza Acústica Morse 880 Hz (si aplica) */}
                  {response.emergency_scenario.id === 'atrapado_escombros' && (
                    <button
                      type="button"
                      onClick={() => toggleAcousticBeacon()}
                      className={`min-h-[48px] h-12 px-4 rounded-2xl font-black text-xs inline-flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-xs ${
                        isBeaconActive
                          ? 'bg-amber-400 text-slate-950 animate-pulse border-2 border-amber-500'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{isBeaconActive ? 'Detener Baliza Acústica 880 Hz' : 'Activar Baliza Acústica Morse (880 Hz)'}</span>
                    </button>
                  )}

                  {/* Botones de Líneas de Emergencia Oficiales */}
                  {response.emergency_scenario.emergencyPhones.map((phone) => (
                    <a
                      key={phone.number}
                      href={`tel:${phone.number}`}
                      className="min-h-[48px] h-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900/80 text-red-900 dark:text-red-200 font-extrabold text-xs inline-flex items-center justify-between gap-2 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-95 transition-all shadow-2xs"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <PhoneCall className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="truncate">{phone.name}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-300 font-black shrink-0">
                        {phone.number}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Lo que NUNCA debe hacer */}
              <div className="p-3.5 rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 space-y-1.5 text-xs">
                <p className="font-black text-amber-950 dark:text-amber-200 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Lo que NUNCA debes hacer</span>
                </p>
                <div className="space-y-1 pl-1">
                  {response.emergency_scenario.neverDo.map((item, idx) => (
                    <p key={idx} className="font-medium text-amber-900 dark:text-amber-300 leading-snug">
                      • {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Contactos recomendados (Estilo Módulo Oficio) */}
          {response.recommended_specialists.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center justify-between px-1">
                <span>Oficios y Contactos Recomendados ({response.recommended_specialists.length})</span>
                <span className="text-[11px] font-semibold text-slate-400 lowercase">Toca para abrir ficha</span>
              </p>

              {response.recommended_specialists.map((spec) => {
                const { initials, shortName } = parseInitialsAndShortName(spec.title);
                const phone = spec.contact_phone?.replace(/[\s\-]/g, '') ?? '';
                const cleanPhone = phone.replace(/^51/, '');
                const categoryLabel =
                  spec.listing_type === 'SERVICIO_OFICIO'
                    ? 'Oficio y Servicio Barrial'
                    : spec.listing_type === 'PRODUCTO_LOCAL'
                    ? 'Comercio y Alimentos Locales'
                    : 'Soporte Crítico de Emergencia';

                const distMeters =
                  spec.public_lat && spec.public_lng
                    ? calculateDistanceMeters(spec.public_lat, spec.public_lng, userCoords.lat, userCoords.lng)
                    : 280;
                const distanceText = formatDistance(distMeters);
                const mapsUrl =
                  spec.public_lat && spec.public_lng
                    ? `https://www.google.com/maps/search/?api=1&query=${spec.public_lat},${spec.public_lng}`
                    : `https://www.google.com/maps/search/?api=1&query=-12.0528,-75.2155`;

                const modalPayload: CopilotModalDetail = {
                  type: 'SPECIALIST',
                  badgeType: spec.listing_type === 'PRODUCTO_LOCAL' ? 'COMERCIO LOCAL' : 'OFICIOS Y SERVICIOS',
                  title: spec.title,
                  shortName,
                  categoryLabel,
                  description: spec.description,
                  contact_phone: phone,
                  public_lat: spec.public_lat,
                  public_lng: spec.public_lng,
                  distanceMeters: distMeters,
                  endorsement_count: spec.endorsement_count,
                  weighted_trust_score: spec.weighted_trust_score,
                  available_for_emergencies: spec.available_for_emergencies,
                  emergency_response_note: spec.emergency_response_note,
                };

                return (
                  <article
                    key={`${spec.title}-${spec.contact_phone}`}
                    tabIndex={0}
                    onClick={() => openDetailDrawer(modalPayload)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetailDrawer(modalPayload);
                      }
                    }}
                    className="rounded-[26px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 sm:p-5 shadow-card-diffuse space-y-3 cursor-pointer hover:border-[#0F2A56]/30 dark:hover:border-sky-500/40 transition-all active:scale-[0.99] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2A56]"
                  >
                    {/* Fila Superior: Avatar + Nombre + Insignia Verificado */}
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-[#0F2A56] text-white flex items-center justify-center font-extrabold text-sm shadow-2xs">
                          {initials}
                        </div>
                        <span
                          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-2xs"
                          aria-hidden="true"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-sm sm:text-base text-[#0B1E3F] dark:text-white truncate group-hover:text-[#0F2A56] dark:group-hover:text-sky-300 transition-colors">
                            {spec.title}
                          </h3>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950 dark:text-blue-300">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            Vecino verificado
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#5B6068] dark:text-slate-400 mt-0.5">
                          {categoryLabel} · a {distanceText} de ti
                        </p>
                      </div>
                    </div>

                    {/* Descripción Vecinal */}
                    <p className="text-xs sm:text-sm leading-relaxed text-[#5B6068] dark:text-slate-300 line-clamp-2">
                      {spec.description}
                    </p>

                    {/* Atiende emergencias 24h si aplica */}
                    {spec.available_for_emergencies && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>[24/7] Atiende emergencias las 24 horas</span>
                      </div>
                    )}

                    {/* Franja Suave de Respaldo Comunitario / Recomendación Vecinal */}
                    <div className="rounded-2xl bg-[#F4F5F7] dark:bg-slate-800/80 p-2 sm:p-2.5 flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center -space-x-2 shrink-0">
                          <div className="w-6 h-6 rounded-full bg-slate-300 border-2 border-white shadow-2xs" />
                          <div className="w-6 h-6 rounded-full bg-slate-400 border-2 border-white shadow-2xs" />
                          <div className="w-6 h-6 rounded-full bg-slate-500 border-2 border-white shadow-2xs" />
                        </div>
                        <span className="text-xs font-bold text-[#0B1E3F] dark:text-slate-200 truncate">
                          {spec.weighted_trust_score.toFixed(1)} / 5 · {spec.endorsement_count} vecinos lo recomiendan
                        </span>
                      </div>
                      <span className="text-[11px] font-extrabold text-[#0F2A56] dark:text-sky-300 shrink-0">
                        Ver ficha ›
                      </span>
                    </div>

                    {/* Fila Inferior de Botones de Acción (Igual a ServiceCard) */}
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`tel:${phone}`}
                        aria-label={`Llamar a ${shortName} al ${phone}`}
                        className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#0F2A56] hover:bg-[#0B1E3F] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.97]"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Llamar a {shortName}</span>
                      </a>

                      {cleanPhone && (
                        <a
                          href={`https://wa.me/51${cleanPhone}?text=Hola%2C%20vi%20tu%20perfil%20recomendado%20por%20la%20IA%20de%20AyudaPE%20y%20quisiera%20consultar%20por%20tus%20servicios.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Escribir por WhatsApp a ${shortName}`}
                          className="min-w-[48px] min-h-[48px] w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white flex items-center justify-center shadow-xs transition-all active:scale-[0.97] shrink-0"
                        >
                          <MessageCircle className="w-5 h-5 fill-current" />
                        </a>
                      )}

                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Ver ubicación de ${shortName} en Google Maps`}
                        className="min-w-[48px] min-h-[48px] w-12 h-12 rounded-full bg-[#EBF2FE] hover:bg-[#d8e7fd] text-[#2F62D6] flex items-center justify-center shadow-xs transition-all active:scale-[0.97] shrink-0"
                      >
                        <MapPin className="w-5 h-5" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Avisos activos relacionados (Estilo Módulo Solidario) */}
          {response.related_alerts.length > 0 && (
            <div className="space-y-3 pt-1">
              <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center justify-between px-1">
                <span>Alertas y Pedidos Solidarios ({response.related_alerts.length})</span>
                <span className="text-[11px] font-semibold text-slate-400 lowercase">Toca para abrir ficha</span>
              </p>

              {response.related_alerts.map((alert) => {
                const phone = alert.contact_phone?.replace(/[\s\-]/g, '');
                const cleanPhone = phone?.replace(/^51/, '');
                const isSos = alert.post_type === 'SOS_VULNERABLE';
                const distMeters =
                  alert.public_lat && alert.public_lng
                    ? calculateDistanceMeters(alert.public_lat, alert.public_lng, userCoords.lat, userCoords.lng)
                    : 150;
                const distanceText = formatDistance(distMeters);
                const mapsUrl =
                  alert.public_lat && alert.public_lng
                    ? `https://www.google.com/maps/search/?api=1&query=${alert.public_lat},${alert.public_lng}`
                    : `https://www.google.com/maps/search/?api=1&query=-12.0528,-75.2155`;

                const modalPayload: CopilotModalDetail = {
                  type: 'ALERT',
                  badgeType: isSos ? 'EMERGENCIA SOS' : 'MURO SOLIDARIO',
                  title: alert.title,
                  categoryLabel: isSos
                    ? 'Emergencia SOS Barrial'
                    : alert.post_type === 'SOLICITUD_FAVOR'
                    ? 'Solicitud Solidaria'
                    : 'Oferta Solidaria Vecinal',
                  description: alert.description,
                  contact_phone: phone,
                  public_lat: alert.public_lat,
                  public_lng: alert.public_lng,
                  distanceMeters: distMeters,
                  urgency_level: alert.urgency_level,
                  status: alert.status,
                };

                return (
                  <article
                    key={alert.title}
                    tabIndex={0}
                    onClick={() => openDetailDrawer(modalPayload)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetailDrawer(modalPayload);
                      }
                    }}
                    className={`rounded-[26px] bg-white dark:bg-slate-900 border p-4 sm:p-5 shadow-card-diffuse space-y-3 cursor-pointer transition-all active:scale-[0.99] group focus-visible:outline-none focus-visible:ring-2 ${
                      isSos
                        ? 'border-red-300 dark:border-red-900/60 focus-visible:ring-red-500'
                        : 'border-slate-100 dark:border-slate-800 hover:border-amber-400 focus-visible:ring-[#0F2A56]'
                    }`}
                  >
                    {/* Fila Superior: Insignias de Emergencia / Tipo y Distancia */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          isSos
                            ? 'bg-red-600 text-white animate-pulse'
                            : alert.urgency_level === 'ALTA'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                        }`}
                      >
                        {isSos ? <ShieldAlert className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                        <span>{isSos ? '[SOS] Alerta Barrial' : modalPayload.categoryLabel}</span>
                      </span>

                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        a {distanceText} de ti
                      </span>
                    </div>

                    {/* Título de la solicitud */}
                    <h3 className="font-extrabold text-sm sm:text-base text-[#0B1E3F] dark:text-white leading-snug">
                      {alert.title}
                    </h3>

                    {/* Descripción */}
                    <p className="text-xs sm:text-sm leading-relaxed text-[#5B6068] dark:text-slate-300 line-clamp-2">
                      {alert.description}
                    </p>

                    {/* Franja de Estado */}
                    <div className="rounded-2xl bg-[#F4F5F7] dark:bg-slate-800/80 p-2 sm:p-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Urgencia: <span className="font-black text-rose-600">{alert.urgency_level}</span> · Estado: {alert.status}
                      </span>
                      <span className="text-[11px] font-extrabold text-[#0F2A56] dark:text-sky-300 shrink-0">
                        Ver ficha ›
                      </span>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          aria-label={`Llamar para coordinar: ${phone}`}
                          className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.97]"
                        >
                          <Phone className="w-4 h-4" />
                          <span>Llamar al {phone}</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDetailDrawer(modalPayload)}
                          className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#0F2A56] hover:bg-[#0B1E3F] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.97]"
                        >
                          <Heart className="w-4 h-4" />
                          <span>Ver y ofrecer apoyo</span>
                        </button>
                      )}

                      {cleanPhone && (
                        <a
                          href={`https://wa.me/51${cleanPhone}?text=Hola%2C%20vi%20tu%20aviso%20solidario%20en%20AyudaPE%20y%20puedo%20apoyar.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Coordinar por WhatsApp"
                          className="min-w-[48px] min-h-[48px] w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white flex items-center justify-center shadow-xs transition-all active:scale-[0.97] shrink-0"
                        >
                          <MessageCircle className="w-5 h-5 fill-current" />
                        </a>
                      )}

                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Ver punto en mapa"
                        className="min-w-[48px] min-h-[48px] w-12 h-12 rounded-full bg-[#EBF2FE] hover:bg-[#d8e7fd] text-[#2F62D6] flex items-center justify-center shadow-xs transition-all active:scale-[0.97] shrink-0"
                      >
                        <MapPin className="w-5 h-5" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Bottom Sheet Interactivo (Exacto al Módulo Mapa al tocar un punto) */}
      <Drawer.Root
        open={isDetailDrawerOpen && !!selectedDetail}
        onOpenChange={(isOpen) => {
          setIsDetailDrawerOpen(isOpen);
          if (!isOpen) {
            setSelectedDetail(null);
          }
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay
            onClick={() => {
              setIsDetailDrawerOpen(false);
              setSelectedDetail(null);
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs cursor-pointer animate-in fade-in duration-200"
          />
          <Drawer.Content
            aria-labelledby="ia-target-title"
            aria-describedby="ia-target-desc"
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-[32px] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[#0E1216] dark:text-white p-5 sm:p-6 shadow-2xl focus-visible:outline-none max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300"
          >
            {/* Barra de arrastre táctil para deslizar hacia abajo */}
            <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

            {selectedDetail && (
              <div className="space-y-4">
                {/* Encabezado con Badges y Botón de Cierre */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${
                          selectedDetail.badgeType === 'EMERGENCIA SOS'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-200'
                            : selectedDetail.badgeType === 'MURO SOLIDARIO'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-sky-100 text-[#0F2A56] border border-sky-200 dark:bg-sky-950 dark:text-sky-200'
                        }`}
                      >
                        {selectedDetail.badgeType}
                      </span>

                      {selectedDetail.available_for_emergencies && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-black dark:bg-amber-950 dark:text-amber-200">
                          24/7 Emergencias
                        </span>
                      )}

                      {selectedDetail.urgency_level && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-black dark:bg-rose-950 dark:text-rose-200">
                          Urgencia {selectedDetail.urgency_level}
                        </span>
                      )}

                      {selectedDetail.weighted_trust_score !== undefined && selectedDetail.weighted_trust_score > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-black dark:bg-slate-800 dark:text-slate-200">
                          {selectedDetail.weighted_trust_score.toFixed(1)} / 5 visto bueno
                        </span>
                      )}
                    </div>

                    <Drawer.Title id="ia-target-title" className="text-lg sm:text-xl font-black leading-snug break-words">
                      {selectedDetail.title}
                    </Drawer.Title>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailDrawerOpen(false);
                      setSelectedDetail(null);
                    }}
                    aria-label="Cerrar detalles"
                    className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer"
                  >
                    <X className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Distancia y Tiempo Estimado de Caminata */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-[#0F2A56] dark:text-sky-300" />
                    <span>Distancia calculada:</span>
                  </div>
                  <span className="font-black text-[#0F2A56] dark:text-sky-300">
                    a ~{formatDistance(selectedDetail.distanceMeters ?? 250)} · ~
                    {estimateWalkingMinutes(selectedDetail.distanceMeters ?? 250)} min caminando
                  </span>
                </div>

                {/* Ubicación Aproximada */}
                <div className="flex items-center gap-2 text-xs font-bold text-[#5B6068] dark:text-slate-400">
                  <MapPin className="w-4 h-4 text-[#2F62D6] shrink-0" />
                  <span>
                    Zona aproximada:{' '}
                    {resolveApproximateZoneLabel(
                      selectedDetail.public_lat ?? userCoords.lat,
                      selectedDetail.public_lng ?? userCoords.lng,
                      selectedDetail.title
                    )}
                  </span>
                </div>

                {/* Descripción contextual */}
                <Drawer.Description id="ia-target-desc" className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {selectedDetail.description}
                </Drawer.Description>

                {/* Equipamiento para emergencias si existe */}
                {selectedDetail.emergency_response_note && (
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3.5 border border-amber-200 dark:border-amber-800/50 space-y-1">
                    <p className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <span>[Equipamiento SOS] Emergencias:</span>
                    </p>
                    <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                      {selectedDetail.emergency_response_note}
                    </p>
                  </div>
                )}

                {/* Llamada Telefónica Directa */}
                {selectedDetail.contact_phone && (
                  <a
                    href={`tel:${selectedDetail.contact_phone}`}
                    className="min-h-[48px] h-12 w-full px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition-all"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Llamar directo: {selectedDetail.contact_phone}</span>
                  </a>
                )}

                {/* Botones Secundarios: WhatsApp y Google Maps */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  {selectedDetail.contact_phone && (
                    <a
                      href={`https://wa.me/51${selectedDetail.contact_phone.replace(/^51/, '').replace(/[\s\-]/g, '')}?text=Hola%2C%20vi%20tu%20contacto%20en%20AyudaPE%20y%20quisiera%20comunicarme.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[48px] h-12 flex-1 px-4 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all"
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                      <span>Coordinar por WhatsApp</span>
                    </a>
                  )}

                  <a
                    href={
                      selectedDetail.public_lat && selectedDetail.public_lng
                        ? `https://www.google.com/maps/search/?api=1&query=${selectedDetail.public_lat},${selectedDetail.public_lng}`
                        : `https://www.google.com/maps/search/?api=1&query=-12.0528,-75.2155`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] h-12 flex-1 px-4 rounded-full bg-[#0F2A56] hover:bg-[#0B1E3F] text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Ver en Google Maps</span>
                  </a>
                </div>
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Panel B2G Municipal Anonimizado (visible cuando el rol es OPERADOR_MUNICIPAL) */}
      {activeRole === 'OPERADOR_MUNICIPAL' && (
        <div className="rounded-3xl border-2 border-sky-400 bg-slate-950 text-sky-100 p-4 space-y-2 shadow-card-elevated">
          <h3 className="text-sm font-extrabold uppercase tracking-wide">
            [B2G] Telemetría Municipal (Ley N° 29733 — 100% Anonimizada)
          </h3>
          <p className="text-xs text-sky-200">
            Sector: Huancayo · El Tambo — Sin exposición de nombres, teléfonos ni direcciones exactas.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-1">
            <div className="rounded-2xl bg-slate-900 p-2.5 border border-sky-500/40">
              Oficios / Brigadas Activas: 16
            </div>
            <div className="rounded-2xl bg-slate-900 p-2.5 border border-sky-500/40">
              Cobertura de Recursos SOS: 72%
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default CopilotView;
