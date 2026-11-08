'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  MapPin,
  Mic,
  MicOff,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useOperationalMode } from '@/context/mode-context';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import {
  NeighborhoodCopilotService,
  type CopilotResponse,
} from '@/lib/ai/copilot-service';
import { localDb, type RedVecinaLocalDB } from '@/lib/offline/db';

export interface CopilotViewProps {
  customDb?: RedVecinaLocalDB;
}

export interface CopilotModalDetail {
  type: 'SPECIALIST' | 'ALERT';
  title: string;
  categoryLabel: string;
  description: string;
  contact_phone?: string;
  public_lat?: number;
  public_lng?: number;
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

/**
 * Vista de Conversación Asistida por RAG Barrial (Copiloto IA) + Panel B2G Municipal Anonimizado (MOD-12).
 */
export function CopilotView({ customDb }: CopilotViewProps): React.ReactElement {
  const { mode, activeRole } = useOperationalMode();
  const db = customDb ?? localDb;
  const { isListening, transcript, startListening, stopListening } = useVoiceRecognition();

  const [queryText, setQueryText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CopilotModalDetail | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
      try {
        const service = new NeighborhoodCopilotService({ db });
        const res = await service.ask(question, mode);
        // Solo en consola — no se renderiza el texto en pantalla
        console.log('[Copiloto RAG]', res.answer);
        setResponse(res);
      } finally {
        setIsLoading(false);
      }
    },
    [db, mode, queryText]
  );

  return (
    <section aria-label="Copiloto Barrial IA y Analítica B2G" className="space-y-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
          Copiloto Barrial RAG (Con y Sin Red)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
          Pregunta con tu voz o escribe: consulta especialistas y alertas locales en memoria offline
        </p>
      </div>

      {/* Consultas Rápidas en Píldoras / Chips */}
      <div className="space-y-2">
        <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Preguntas frecuentes de 1 toque:</span>
        </p>
        <div className="flex flex-col gap-2">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setQueryText(q);
                void handleAskCopilot(q);
              }}
              className="min-h-[48px] text-left px-4 py-2.5 rounded-2xl border border-slate-200/90 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 shadow-soft transition-all active:scale-[0.99] flex items-center justify-between gap-2"
            >
              <span>“{q}”</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Entrada Conversacional en Cápsula */}
      <div className="rounded-3xl border border-slate-200/90 bg-white dark:bg-slate-900 p-4 shadow-soft space-y-3">
        <label htmlFor="copilot-query-input" className="block text-xs font-black text-slate-700 dark:text-slate-200">
          Tu consulta al Copiloto de Jesús María Sector 4:
        </label>
        <textarea
          id="copilot-query-input"
          rows={2}
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Ej: ¿Quién me puede ayudar con una fuga de agua o balón de oxígeno?"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 dark:bg-slate-800/50 p-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            aria-pressed={isListening}
            className={`min-h-[48px] px-4 rounded-full border text-xs font-extrabold inline-flex items-center gap-1.5 transition-all active:scale-[0.98] ${
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
            className="min-h-[48px] flex-1 px-5 rounded-full bg-[#014069] hover:bg-[#013150] text-white font-extrabold text-xs uppercase tracking-wide disabled:opacity-45 shadow-sm active:scale-[0.98] transition-all"
          >
            {isLoading ? 'Consultando Padrón...' : 'Preguntar al Copiloto'}
          </button>
        </div>
      </div>

      {/* Respuesta del Copiloto RAG */}
      {response && (
        <div
          role="region"
          aria-label="Respuesta del Copiloto Barrial"
          className="rounded-3xl border border-slate-200/90 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-soft"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>
              Motor: {response.used_cloud_llm ? 'Gemini 2.5 Flash + RAG' : 'RAG Determinista Local Offline'}
            </span>
            <span>Latencia: {response.latency_ms} ms</span>
          </div>

          {/* Contactos directos */}
          {response.recommended_specialists.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300">
                Contactos Directos Verificados ({response.recommended_specialists.length}) — Toca para ver info:
              </p>
              {response.recommended_specialists.map((spec) => {
                const isSolidario = ['FAVOR', 'SOS', 'ACOPIO', 'SOPORTE_EMERGENCIA'].includes(spec.listing_type ?? '');
                const phone = spec.contact_phone?.replace(/[\s\-]/g, '') ?? '';
                const mapsUrl =
                  spec.public_lat && spec.public_lng
                    ? `https://www.google.com/maps?q=${spec.public_lat},${spec.public_lng}`
                    : null;
                return (
                  <div
                    key={`${spec.title}-${spec.contact_phone}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedDetail({
                        type: 'SPECIALIST',
                        title: spec.title,
                        categoryLabel:
                          spec.listing_type === 'SERVICIO_OFICIO'
                            ? 'Oficio y Servicio Barrial'
                            : spec.listing_type === 'PRODUCTO_LOCAL'
                            ? 'Comercio y Alimentos Locales'
                            : 'Soporte Crítico de Emergencia',
                        description: spec.description,
                        contact_phone: phone,
                        public_lat: spec.public_lat,
                        public_lng: spec.public_lng,
                        endorsement_count: spec.endorsement_count,
                        weighted_trust_score: spec.weighted_trust_score,
                        available_for_emergencies: spec.available_for_emergencies,
                        emergency_response_note: spec.emergency_response_note,
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDetail({
                          type: 'SPECIALIST',
                          title: spec.title,
                          categoryLabel:
                            spec.listing_type === 'SERVICIO_OFICIO'
                              ? 'Oficio y Servicio Barrial'
                              : spec.listing_type === 'PRODUCTO_LOCAL'
                              ? 'Comercio y Alimentos Locales'
                              : 'Soporte Crítico de Emergencia',
                          description: spec.description,
                          contact_phone: phone,
                          public_lat: spec.public_lat,
                          public_lng: spec.public_lng,
                          endorsement_count: spec.endorsement_count,
                          weighted_trust_score: spec.weighted_trust_score,
                          available_for_emergencies: spec.available_for_emergencies,
                          emergency_response_note: spec.emergency_response_note,
                        });
                      }
                    }}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center justify-between gap-2 text-xs cursor-pointer hover:border-sky-400 hover:bg-sky-50/40 dark:hover:bg-slate-800/80 transition-all active:scale-[0.99] group shadow-soft"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-extrabold text-slate-900 dark:text-white group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                          {spec.title}
                        </p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          ℹ️ Toca para info
                        </span>
                      </div>
                      {!isSolidario && (
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          🤝 {spec.endorsement_count} vecinos lo recomiendan
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[48px] px-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-xs transition-colors"
                          aria-label="Ver ubicación en mapa"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <a
                        href={`tel:${phone}`}
                        className="min-h-[48px] px-4 rounded-full bg-[#014069] hover:bg-[#013150] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{phone}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Avisos activos relacionados */}
          {response.related_alerts.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300">
                📢 Avisos activos en tu cuadra ({response.related_alerts.length}) — Toca para ver info:
              </p>
              {response.related_alerts.map((alert) => {
                const urgencyColor =
                  alert.urgency_level === 'CRITICA'
                    ? 'border-red-400 bg-red-50 dark:bg-red-950/30'
                    : alert.urgency_level === 'ALTA'
                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30'
                    : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30';
                const urgencyText =
                  alert.urgency_level === 'CRITICA'
                    ? 'text-red-600 dark:text-red-400'
                    : alert.urgency_level === 'ALTA'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-amber-600 dark:text-amber-400';
                const phone = alert.contact_phone?.replace(/[\s\-]/g, '');
                const mapsUrl =
                  alert.public_lat && alert.public_lng
                    ? `https://www.google.com/maps?q=${alert.public_lat},${alert.public_lng}`
                    : null;
                return (
                  <div
                    key={alert.title}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedDetail({
                        type: 'ALERT',
                        title: alert.title,
                        categoryLabel:
                          alert.post_type === 'SOS_VULNERABLE'
                            ? 'Emergencia SOS Barrial'
                            : alert.post_type === 'SOLICITUD_FAVOR'
                            ? 'Solicitud de Apoyo Comunitario'
                            : alert.post_type === 'OFERTA_FAVOR'
                            ? 'Oferta Solidaria Vecinal'
                            : 'Recurso Solidario Colectivo',
                        description: alert.description,
                        contact_phone: phone,
                        public_lat: alert.public_lat,
                        public_lng: alert.public_lng,
                        urgency_level: alert.urgency_level,
                        status: alert.status,
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDetail({
                          type: 'ALERT',
                          title: alert.title,
                          categoryLabel:
                            alert.post_type === 'SOS_VULNERABLE'
                              ? 'Emergencia SOS Barrial'
                              : alert.post_type === 'SOLICITUD_FAVOR'
                              ? 'Solicitud de Apoyo Comunitario'
                              : alert.post_type === 'OFERTA_FAVOR'
                              ? 'Oferta Solidaria Vecinal'
                              : 'Recurso Solidario Colectivo',
                          description: alert.description,
                          contact_phone: phone,
                          public_lat: alert.public_lat,
                          public_lng: alert.public_lng,
                          urgency_level: alert.urgency_level,
                          status: alert.status,
                        });
                      }
                    }}
                    className={`rounded-2xl border p-3 flex items-center justify-between gap-2 text-xs cursor-pointer hover:shadow-md transition-all active:scale-[0.99] group ${urgencyColor}`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-extrabold text-slate-900 dark:text-white truncate">{alert.title}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 dark:bg-black/40 text-slate-700 dark:text-slate-200">
                          ℹ️ Info
                        </span>
                      </div>
                      <p className={`text-[11px] font-bold mt-0.5 ${urgencyText}`}>
                        {alert.urgency_level} · {alert.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[48px] px-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs transition-colors"
                          aria-label="Ver ubicación"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="min-h-[48px] px-4 rounded-full bg-[#014069] hover:bg-[#013150] text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-xs transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal / Dialog de Información Detallada del Resultado de IA */}
      {selectedDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="copilot-detail-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 rounded-full ${
                    selectedDetail.type === 'ALERT'
                      ? selectedDetail.urgency_level === 'CRITICA'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                  }`}
                >
                  {selectedDetail.type === 'ALERT' ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : (
                    <ShieldCheck className="w-3 h-3" />
                  )}
                  {selectedDetail.categoryLabel}
                </span>
                <h3
                  id="copilot-detail-modal-title"
                  className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug"
                >
                  {selectedDetail.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="min-h-[48px] min-w-[48px] p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center shrink-0"
                aria-label="Cerrar modal de información"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido / Descripción */}
            <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/80 dark:border-slate-700/60">
                <p className="font-semibold leading-relaxed">
                  {selectedDetail.description}
                </p>
              </div>

              {/* Nota de Equipamiento / Emergencia */}
              {selectedDetail.emergency_response_note && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-800/50 space-y-1">
                  <p className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <span>⚡ Equipamiento para Emergencias:</span>
                  </p>
                  <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                    {selectedDetail.emergency_response_note}
                  </p>
                </div>
              )}

              {/* Respaldo Comunitario / Vecinos */}
              {selectedDetail.endorsement_count !== undefined && (
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 px-1">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Confianza Vecinal: {selectedDetail.endorsement_count} recomendaciones</span>
                  </span>
                  {selectedDetail.weighted_trust_score !== undefined && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      Score: {selectedDetail.weighted_trust_score}
                    </span>
                  )}
                </div>
              )}

              {/* Ubicación / Coordenadas */}
              {selectedDetail.public_lat && selectedDetail.public_lng && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold px-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Zona Huancayo ({selectedDetail.public_lat.toFixed(4)}, {selectedDetail.public_lng.toFixed(4)})</span>
                </div>
              )}
            </div>

            {/* Botones de Acción */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              {selectedDetail.contact_phone && (
                <a
                  href={`tel:${selectedDetail.contact_phone}`}
                  className="w-full sm:flex-1 min-h-[48px] px-4 rounded-2xl bg-[#014069] hover:bg-[#013150] text-white font-extrabold text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span>Llamar ({selectedDetail.contact_phone})</span>
                </a>
              )}
              {selectedDetail.public_lat && selectedDetail.public_lng && (
                <a
                  href={`https://www.google.com/maps?q=${selectedDetail.public_lat},${selectedDetail.public_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 min-h-[48px] px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Ver en Mapa</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="w-full sm:w-auto min-h-[48px] px-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel B2G Municipal Anonimizado (visible cuando el rol es OPERADOR_MUNICIPAL) */}
      {activeRole === 'OPERADOR_MUNICIPAL' && (
        <div className="rounded-3xl border-2 border-sky-400 bg-slate-950 text-sky-100 p-4 space-y-2 shadow-card-elevated">
          <h3 className="text-sm font-extrabold uppercase tracking-wide">
            📊 Telemetría B2G Municipal (Ley N° 29733 — 100% Anonimizada)
          </h3>
          <p className="text-xs text-sky-200">
            Sector: Jesús María · Sector 4 (UBIGEO 150113 · JM-SEC-04) — Sin exposición de nombres, teléfonos ni direcciones exactas.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-1">
            <div className="rounded-2xl bg-slate-900 p-2.5 border border-sky-500/40">
              Oficios / Brigadas Activas: 12
            </div>
            <div className="rounded-2xl bg-slate-900 p-2.5 border border-sky-500/40">
              Cobertura de Recursos SOS: 54%
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
