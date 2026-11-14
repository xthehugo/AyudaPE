'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { NeighborIntent } from '@shared/schemas';
import type { IListingLocal, IPostLocal, OperationalMode } from '@shared/types';
import { useOperationalMode } from '@/context/mode-context';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import { parseNeighborIntentWithMeta } from '@/lib/ai/ai-orchestrator';
import { localDb, type RedVecinaLocalDB } from '@/lib/offline/db';
import { syncManager } from '@/lib/offline/sync-manager';

export interface QuickPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (summary: {
    client_mutation_id: string;
    module: NeighborIntent['module'];
    title: string;
  }) => void;
  customDb?: RedVecinaLocalDB;
}

const DEFAULT_SECTOR_LAT = -12.0752;
const DEFAULT_SECTOR_LNG = -77.0485;

function generateClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapCategoryNameToId(categoryName: string): number {
  const lower = categoryName.toLowerCase();
  if (lower.includes('gasfiter')) return 1;
  if (lower.includes('electric')) return 2;
  if (lower.includes('cerraj')) return 3;
  if (lower.includes('salud') || lower.includes('auxilio') || lower.includes('botica')) return 4;
  if (lower.includes('alimenta') || lower.includes('olla') || lower.includes('bodega')) return 5;
  if (lower.includes('agua') || lower.includes('energ')) return 6;
  if (lower.includes('herramienta')) return 7;
  if (lower.includes('rescate') || lower.includes('brigada')) return 8;
  return 9;
}

/**
 * Función pura y testeable para el Paso 3 ("Publicar en mi Barrio"):
 * Guarda de forma optimista en `localDb` (Dexie.js) y encola la mutación en `localDb.outbox`
 * aplicando difuminado espacial de 50 metros si es `SOS_VULNERABLE`.
 */
export async function executeQuickPublishPersist(params: {
  intent: NeighborIntent;
  latitude: number;
  longitude: number;
  contactPhone?: string;
  operationalMode: OperationalMode;
  photoUrl?: string;
  db?: RedVecinaLocalDB;
}): Promise<{
  client_mutation_id: string;
  targetCollection: 'listings' | 'posts';
  storedRecord: IListingLocal | IPostLocal;
}> {
  const db = params.db ?? localDb;
  const mutationId = generateClientUuid();
  const categoryId = mapCategoryNameToId(params.intent.category);
  const nowIso = new Date().toISOString();

  if (params.intent.module === 'OFICIOS_PRODUCTOS') {
    const listingType: IListingLocal['listing_type'] =
      params.intent.post_type === 'PRODUCTO_LOCAL' ? 'PRODUCTO_LOCAL' : 'SERVICIO_OFICIO';

    const listingRecord: IListingLocal = {
      client_mutation_id: mutationId,
      category_id: categoryId,
      listing_type: listingType,
      title: params.intent.title,
      description: params.intent.description,
      contact_phone: params.contactPhone || '987654321',
      latitude: params.latitude,
      longitude: params.longitude,
      available_for_emergencies:
        params.operationalMode === 'EMERGENCIA' || params.intent.urgency === 'CRITICA',
      photo_url: params.photoUrl,
      endorsement_count: 1,
      weighted_trust_score: 1.5,
      is_pending_sync: true,
      updated_at: nowIso,
    };

    await db.bulkCacheListings([listingRecord]);
    await db.enqueueMutation('/api/v1/listings', 'POST', {
      client_mutation_id: mutationId,
      category_id: categoryId,
      listing_type: listingType,
      title: listingRecord.title,
      description: listingRecord.description,
      contact_phone: listingRecord.contact_phone,
      latitude: listingRecord.latitude,
      longitude: listingRecord.longitude,
      available_for_emergencies: listingRecord.available_for_emergencies,
    });

    return {
      client_mutation_id: mutationId,
      targetCollection: 'listings',
      storedRecord: listingRecord,
    };
  }

  // Caso Muro Solidario / Tablero SOS
  const isSosVulnerable = params.intent.post_type === 'SOS_VULNERABLE';
  const postType: IPostLocal['post_type'] =
    params.intent.post_type === 'SOS_VULNERABLE'
      ? 'SOS_VULNERABLE'
      : params.intent.post_type === 'OFERTA_FAVOR'
        ? 'OFERTA_FAVOR'
        : params.intent.post_type === 'RECURSO_CRITICO' ||
            params.intent.post_type === 'RECURSO_SOLIDARIO'
          ? 'RECURSO_SOLIDARIO'
          : 'SOLICITUD_FAVOR';

  // Si es SOS_VULNERABLE, desplazamos levemente las coordenadas públicas (~25-45m) y fijamos radio de privacidad = 50m
  const offsetLat = isSosVulnerable ? 0.00022 : 0;
  const offsetLng = isSosVulnerable ? -0.00019 : 0;

  const postRecord: IPostLocal = {
    client_mutation_id: mutationId,
    sector_id: 1,
    category_id: categoryId,
    operational_mode:
      params.intent.module === 'EMERGENCIA_SOS' ? 'EMERGENCIA' : params.operationalMode,
    post_type: postType,
    title: params.intent.title,
    description: params.intent.description,
    urgency_level: params.intent.urgency,
    public_lat: Number((params.latitude + offsetLat).toFixed(6)),
    public_lng: Number((params.longitude + offsetLng).toFixed(6)),
    privacy_radius_meters: isSosVulnerable ? 50 : 0,
    photo_url: params.photoUrl,
    status: 'ACTIVO',
    client_created_at: nowIso,
    is_pending_sync: true,
    updated_at: nowIso,
  };

  await db.bulkCachePosts([postRecord]);
  await db.enqueueMutation('/api/v1/posts', 'POST', {
    client_mutation_id: mutationId,
    sector_id: 1,
    category_id: categoryId,
    operational_mode: postRecord.operational_mode,
    post_type: postRecord.post_type,
    title: postRecord.title,
    description: postRecord.description,
    urgency_level: postRecord.urgency_level,
    public_lat: postRecord.public_lat,
    public_lng: postRecord.public_lng,
    exact_lat: params.latitude,
    exact_lng: params.longitude,
    extracted_pii: params.intent.extracted_pii,
    resources: params.intent.resources,
  });

  return {
    client_mutation_id: mutationId,
    targetCollection: 'posts',
    storedRecord: postRecord,
  };
}

/**
 * Modal de Publicación Asistida en 3 Clics (MOD-11):
 * - Clic 1: Dictar por voz (`es-PE`) o escribir texto rápido.
 * - Clic 2: Clasificación automática con IA Híbrida (`parseNeighborIntentWithMeta`) + GPS + validación Cero Dinero.
 * - Clic 3: Botón de confirmación prominente (`min-h-[56px]`): "Publicar en mi Barrio".
 */
export function QuickPublishModal({
  isOpen,
  onClose,
  onPublished,
  customDb,
}: QuickPublishModalProps): React.ReactElement | null {
  const { mode } = useOperationalMode();
  const {
    isListening,
    transcript,
    statusMessage,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceRecognition();

  const [inputText, setInputText] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [parsedIntent, setParsedIntent] = useState<NeighborIntent | null>(null);
  const [tierUsedLabel, setTierUsedLabel] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: DEFAULT_SECTOR_LAT,
    lng: DEFAULT_SECTOR_LNG,
  });

  useEffect(() => {
    if (transcript.trim().length > 0) {
      setInputText(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          });
        },
        () => {
          // Mantener coordenadas de Jesús María Sector 4 por defecto si el permiso GPS es denegado
        },
        { timeout: 3000 }
      );
    }
  }, [isOpen]);

  // Clic 2: Analizar intención con IA Híbrida
  const handleAnalyzeIntent = useCallback(async () => {
    if (isListening) {
      stopListening();
    }
    const textToAnalyze = inputText.trim();
    if (textToAnalyze.length < 4) return;

    setIsAnalyzing(true);
    try {
      const result = await parseNeighborIntentWithMeta(textToAnalyze, mode);
      setParsedIntent(result.intent);
      setTierUsedLabel(`${result.strategy_name} (${result.latency_ms} ms)`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputText, isListening, mode, stopListening]);

  // Conversión en 1 toque cuando se detecta intención monetaria en un favor
  const handleConvertToProximityService = useCallback(() => {
    if (!parsedIntent) return;
    setParsedIntent({
      ...parsedIntent,
      module: 'OFICIOS_PRODUCTOS',
      post_type: 'SERVICIO_OFICIO',
      has_monetary_intent: true,
      zero_money_compliant: false,
    });
  }, [parsedIntent]);

  // Clic 3: Publicar en mi Barrio (Optimistic UI + Outbox)
  const handleConfirmPublish = useCallback(async () => {
    if (!parsedIntent) return;
    setIsPublishing(true);
    try {
      const res = await executeQuickPublishPersist({
        intent: parsedIntent,
        latitude: coords.lat,
        longitude: coords.lng,
        contactPhone,
        operationalMode: mode,
        db: customDb,
      });

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(80);
      }

      void syncManager.processOutbox();

      onPublished?.({
        client_mutation_id: res.client_mutation_id,
        module: parsedIntent.module,
        title: parsedIntent.title,
      });

      setInputText('');
      setParsedIntent(null);
      resetTranscript();
      onClose();
    } finally {
      setIsPublishing(false);
    }
  }, [contactPhone, coords.lat, coords.lng, customDb, mode, onClose, onPublished, parsedIntent, resetTranscript]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-publish-modal-title"
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-2 sm:p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface-elevated)] text-[var(--foreground)] border-2 border-[var(--border-color)] p-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
          <div>
            <h2 id="quick-publish-modal-title" className="text-lg font-extrabold leading-tight">
              Publicación Asistida en 3 Clics
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Paso 1: Dicta o escribe · Paso 2: IA clasifica · Paso 3: Publicar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de publicación"
            className="min-h-[48px] min-w-[48px] px-3 rounded-xl border border-[var(--border-color)] font-bold text-xs"
          >
            Cerrar
          </button>
        </div>

        {/* CLIC 1: Entrada por Voz (es-PE) o Texto */}
        <div className="mt-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              aria-pressed={isListening}
              className={`min-h-[52px] flex-1 px-4 py-2.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 border-2 ${
                isListening
                  ? 'bg-red-600 text-white border-yellow-300 animate-pulse'
                  : 'bg-[var(--accent-surface)] text-[var(--accent-foreground)] border-[var(--border-color)]'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>
                {isListening ? '1. Soltar Voz y Clasificar' : '1. Dictar con Micrófono (es-PE)'}
              </span>
            </button>
          </div>

          <p className="text-xs text-[var(--muted-foreground)] font-medium" aria-live="polite">
            {statusMessage}
          </p>

          <label htmlFor="quick-publish-textarea" className="block text-xs font-bold">
            Tu mensaje vecinal o alerta SOS:
          </label>
          <textarea
            id="quick-publish-textarea"
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ej: Necesito urgente 2 balones de oxígeno para mi abuelita en Jr. Huiracocha 1420, o: Presto escalera de aluminio sin costo..."
            className="w-full rounded-xl border-2 border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--foreground)] p-3 text-sm font-medium"
          />

          {/* CLIC 2: Botón para Clasificar con IA Híbrida */}
          <button
            type="button"
            onClick={() => void handleAnalyzeIntent()}
            disabled={isAnalyzing || inputText.trim().length < 4}
            className="min-h-[48px] w-full px-4 py-2.5 rounded-xl border-2 border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--foreground)] font-extrabold text-sm hover:opacity-90 disabled:opacity-45"
          >
            {isAnalyzing
              ? 'Analizando con IA Híbrida...'
              : '2. Clasificar Automáticamente con IA y GPS'}
          </button>
        </div>

        {/* Vista Previa Clasificada + Alerta Amigable RN-01 Cero Dinero */}
        {parsedIntent && (
          <div className="mt-4 rounded-xl border-2 border-[var(--border-color)] bg-[var(--surface-card)] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-surface)] text-[var(--accent-foreground)] text-xs font-extrabold">
                {parsedIntent.module} · {parsedIntent.post_type}
              </span>
              <span className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] text-xs font-bold">
                Urgencia: {parsedIntent.urgency}
              </span>
            </div>

            <p className="text-xs font-semibold text-[var(--muted-foreground)]">
              Categoría: <strong className="text-[var(--foreground)]">{parsedIntent.category}</strong> · GPS:{' '}
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </p>

            <div className="text-sm font-bold">{parsedIntent.title}</div>
            <div className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {parsedIntent.description}
            </div>

            {parsedIntent.is_pii_redacted && (
              <div className="rounded-lg bg-emerald-950 text-emerald-100 border border-emerald-400/50 p-2.5 text-xs font-medium">
                🔒 <strong>Protección Ley N° 29733 activa:</strong> Tu dirección exacta y datos de salud fueron separados a la Bóveda PII encriptada y el mapa público aplicará un círculo difuminado de 50 metros.
              </div>
            )}

            {parsedIntent.has_monetary_intent && (
              <div className="rounded-lg bg-amber-950 text-amber-100 border border-amber-400 p-3 text-xs space-y-2">
                <p className="font-bold">
                  💡 Detectamos mención de precio o cobro monetario (Regla RN-01: La Cadena de Favores es 100% Cero Dinero).
                </p>
                {parsedIntent.module !== 'OFICIOS_PRODUCTOS' ? (
                  <button
                    type="button"
                    onClick={handleConvertToProximityService}
                    className="min-h-[48px] w-full px-3 py-2 rounded-lg bg-amber-300 text-slate-950 font-extrabold text-xs uppercase"
                  >
                    Convertir a Servicio de Proximidad (Módulo 1) con 1 toque
                  </button>
                ) : (
                  <div>
                    <label htmlFor="quick-publish-phone" className="block text-xs font-bold mb-1">
                      Teléfono de contacto para tu Oficio / Producto:
                    </label>
                    <input
                      id="quick-publish-phone"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full min-h-[44px] rounded-lg px-2.5 py-1.5 text-slate-950 bg-white font-bold text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {tierUsedLabel && (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Motor IA: {tierUsedLabel}
              </p>
            )}

            {/* CLIC 3: Botón de Confirmación Prominente (56px de alto) */}
            <button
              type="button"
              onClick={() => void handleConfirmPublish()}
              disabled={isPublishing}
              className="min-h-[56px] w-full px-5 py-3 rounded-xl bg-[var(--cta-primary-bg)] text-[var(--cta-primary-fg)] font-extrabold text-base uppercase tracking-wide shadow-lg"
            >
              {isPublishing ? 'Guardando en tu Barrio...' : '3. Publicar en mi Barrio'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
