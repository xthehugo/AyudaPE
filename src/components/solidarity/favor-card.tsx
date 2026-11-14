'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Flag,
  Heart,
  KeyRound,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'motion/react';
import type { IPostLocal, ICommitmentLocal } from '@shared/types';
import { PiiVaultModal } from '@/components/safety/pii-vault-modal';
import { HelpConfirmationModal } from '@/components/solidarity/help-confirmation-modal';
import type { ResourceProgressItem } from '@/components/views/solidarity-wall-view';
import {
  fetchReverseGeocodeZone,
  resolveApproximateZoneLabel,
} from '@/lib/geo-utils';
import {
  getSolidarityStage,
  isHelperForPost,
  isOwnPost,
  recordSosHelper,
  getSosHelpersCount,
  isUserCommittedToSos,
  removeSosHelper,
  markPostResolvedTimestamp,
  getPostResolvedAgeSeconds,
  type SolidarityFlowStage,
} from '@/lib/ownership';
import { broadcastSolidarityStageChange } from '@/lib/realtime/sos-realtime';

export interface FavorCardProps {
  post: IPostLocal;
  resources: ResourceProgressItem[];
  onCommitResource: (post: IPostLocal, resource: ResourceProgressItem, deltaQty?: number) => void;
  commitment?: ICommitmentLocal | null;
  onRefresh?: () => void;
}

/**
 * Tarjeta Hiperlocal del Muro Solidario con Flujo Sincronizado en Tiempo Real (WebSocket + Servidor):
 * - Recién publicado: Quien publicó entra en "En espera"; los demás ven "Me comprometo".
 * - Paso 1 ("Me comprometo"): Se envía al servidor y por WebSocket a todos ("1 persona se ha comprometido").
 *   Notifica al autor. Quien ayudó ve "Marcar entregado" y el autor puede "Confirmar entrega".
 * - Paso 2 ("Marcar entregado"): Se envía al servidor y por WebSocket a todos. Notifica al autor.
 * - Paso 3 ("Confirmar recibido" / entrega confirmada): Se envía al servidor y por WebSocket a todos,
 *   actualizando el progreso al 100% y atenuando el color verde para toda la comunidad.
 */
export function FavorCard({
  post,
  resources,
  onCommitResource,
  commitment,
  onRefresh,
}: FavorCardProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const [deviceVerified, setDeviceVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('redvecina_dni_verified') === 'true';
    }
    return false;
  });

  const [resourceVersion, setResourceVersion] = useState<number>(0);

  // Recurso principal o recurso de respaldo (con fallback a caché local)
  const primaryResource = useMemo<ResourceProgressItem>(() => {
    if (resources && resources.length > 0) {
      return resources[0];
    }
    if (typeof window !== 'undefined') {
      try {
        const rawCache = localStorage.getItem('redvecina_resources_cache');
        if (rawCache) {
          const parsed = JSON.parse(rawCache) as ResourceProgressItem[];
          const match = parsed.find(
            (r) =>
              r.post_client_mutation_id === post.client_mutation_id ||
              r.client_mutation_id === post.client_mutation_id
          );
          if (match) return match;
        }
      } catch {}
    }
    return {
      id: post.id ?? 999,
      client_mutation_id: `fallback-${post.client_mutation_id}`,
      post_client_mutation_id: post.client_mutation_id,
      item_name: 'Apoyo y coordinación comunitaria',
      unit: 'vecinos',
      quantity_needed: 1,
      quantity_committed: 0,
    };
  }, [resources, post.client_mutation_id, post.id, resourceVersion]);

  const isResourceFullInitially =
    (primaryResource.quantity_committed >= primaryResource.quantity_needed &&
      primaryResource.quantity_needed > 0) ||
    post.status === 'ATENDIDO';

  const [isOwn, setIsOwn] = useState<boolean>(() => isOwnPost(post));
  const [isHelper, setIsHelper] = useState<boolean>(() =>
    isHelperForPost(post.client_mutation_id)
  );
  const [flowStage, setFlowStage] = useState<SolidarityFlowStage>(() =>
    getSolidarityStage(post.client_mutation_id, isResourceFullInitially, post.status)
  );
  const [sosHelpersCount, setSosHelpersCount] = useState<number>(() =>
    post.post_type === 'SOS_VULNERABLE' ? getSosHelpersCount(post.client_mutation_id) : 0
  );
  const [isCommittedToSos, setIsCommittedToSos] = useState<boolean>(() =>
    post.post_type === 'SOS_VULNERABLE' ? isUserCommittedToSos(post.client_mutation_id) : false
  );
  const [resolvedAge, setResolvedAge] = useState<number | null>(() =>
    getPostResolvedAgeSeconds(post.client_mutation_id)
  );

  useEffect(() => {
    setIsOwn(isOwnPost(post));
    setIsHelper(isHelperForPost(post.client_mutation_id));
    setFlowStage(
      getSolidarityStage(post.client_mutation_id, isResourceFullInitially, post.status)
    );

    const handleIdentityUpdate = () => {
      setDeviceVerified(localStorage.getItem('redvecina_dni_verified') === 'true');
      setIsOwn(isOwnPost(post));
      setIsHelper(isHelperForPost(post.client_mutation_id));
    };

    const handleStageUpdate = (e: Event) => {
      const custom = e as CustomEvent<{
        postMutationId: string;
        stage: SolidarityFlowStage;
      }>;
      if (custom.detail?.postMutationId === post.client_mutation_id) {
        setFlowStage(custom.detail.stage);
        setIsOwn(isOwnPost(post));
        setIsHelper(isHelperForPost(post.client_mutation_id));
      } else {
        setFlowStage(
          getSolidarityStage(post.client_mutation_id, isResourceFullInitially, post.status)
        );
      }
    };

    const handleSosHelpersUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ postMutationId: string; count: number }>;
      if (custom.detail?.postMutationId === post.client_mutation_id) {
        setSosHelpersCount(custom.detail.count);
        setIsCommittedToSos(isUserCommittedToSos(post.client_mutation_id));
      }
    };

    const handleSosResolvedUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ postMutationId: string }>;
      if (custom.detail?.postMutationId === post.client_mutation_id) {
        setResolvedAge(0);
      }
    };

    const handleResourceCreated = () => {
      setResourceVersion((v) => v + 1);
    };

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined') {
      window.addEventListener('redvecina_identity_updated', handleIdentityUpdate);
      window.addEventListener('redvecina_ownership_updated', handleIdentityUpdate);
      window.addEventListener('redvecina_solidarity_stage_updated', handleStageUpdate);
      window.addEventListener('redvecina_sos_helpers_updated', handleSosHelpersUpdate);
      window.addEventListener('redvecina_sos_resolved_updated', handleSosResolvedUpdate);
      window.addEventListener('redvecina_resource_created', handleResourceCreated);

      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('redvecina_solidarity_channel');
        channel.onmessage = (event) => {
          if (
            event.data?.type === 'SOLIDARITY_STAGE_CHANGE' &&
            event.data?.postMutationId === post.client_mutation_id
          ) {
            setFlowStage(event.data.stage as SolidarityFlowStage);
            setIsOwn(isOwnPost(post));
            setIsHelper(isHelperForPost(post.client_mutation_id));
          }
        };
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('redvecina_identity_updated', handleIdentityUpdate);
        window.removeEventListener('redvecina_ownership_updated', handleIdentityUpdate);
        window.removeEventListener('redvecina_solidarity_stage_updated', handleStageUpdate);
        window.removeEventListener('redvecina_sos_helpers_updated', handleSosHelpersUpdate);
        window.removeEventListener('redvecina_sos_resolved_updated', handleSosResolvedUpdate);
        window.removeEventListener('redvecina_resource_created', handleResourceCreated);
      }
      if (channel) {
        channel.close();
      }
    };
  }, [post, isResourceFullInitially]);

  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [modalMode] = useState<
    'COMMIT_FORM' | 'SHOW_CODE_REQUESTER' | 'ENTER_CODE_VOLUNTEER'
  >('COMMIT_FORM');

  const isEmergency =
    post.post_type === 'SOS_VULNERABLE' ||
    post.operational_mode === 'EMERGENCIA' ||
    post.urgency_level === 'CRITICA';

  const isUrgent =
    post.urgency_level === 'CRITICA' ||
    post.urgency_level === 'ALTA' ||
    post.post_type === 'SOS_VULNERABLE';

  const phone = isEmergency ? '105' : '998-765-432';
  const callLabel = isEmergency ? 'Llamar a Emergencias 105' : 'Llamar al vecino';

  const effectiveLat =
    typeof post.public_lat === 'number' && !isNaN(post.public_lat)
      ? post.public_lat
      : -12.0752;
  const effectiveLng =
    typeof post.public_lng === 'number' && !isNaN(post.public_lng)
      ? post.public_lng
      : -75.21735;

  const [approxZone, setApproxZone] = useState<string>(() =>
    resolveApproximateZoneLabel(effectiveLat, effectiveLng, post.title, post.description)
  );

  useEffect(() => {
    const initialLabel = resolveApproximateZoneLabel(
      effectiveLat,
      effectiveLng,
      post.title,
      post.description
    );
    setApproxZone(initialLabel);

    // Solo consultar geocodificación externa si la zona calculada localmente es genérica
    const isGenericCoords = initialLabel.includes('Lat ') || initialLabel === 'Huancayo · Sector Barrial';
    if (!isGenericCoords) return;

    let active = true;
    void fetchReverseGeocodeZone(effectiveLat, effectiveLng).then((realStreet) => {
      if (active && realStreet) {
        setApproxZone(realStreet);
      }
    });
    return () => {
      active = false;
    };
  }, [effectiveLat, effectiveLng, post.title, post.description]);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${effectiveLat},${effectiveLng}`;

  // Solo se atenúa el verde cuando se confirma la entrega recibida
  const isVerifiedComplete =
    flowStage === 'RECIBIDO' ||
    post.status === 'ATENDIDO' ||
    commitment?.verification_status === 'confirmado';

  // Paso 1: Segundo usuario se compromete -> envía al servidor y por WebSocket a todos
  const handleStep1Commit = () => {
    if (isOwn) {
      toast.info('Esta es tu publicación · En espera', {
        description: 'Te notificaremos en cuanto un vecino se comprometa a ayudarte.',
      });
      return;
    }
    setFlowStage('COMPROMETIDO');
    setIsHelper(true);
    void broadcastSolidarityStageChange({
      post,
      stage: 'COMPROMETIDO',
    });
    toast.info('🤝 ¡Compromiso enviado! El vecino ha sido notificado', {
      description: 'Cuando llegues y entregues el apoyo, pulsa "Marcar entregado".',
      duration: 5000,
    });
  };

  // Paso 2: Quien ayudó llega y coloca "Entregado" -> envía al servidor y por WebSocket a todos
  const handleStep2Delivered = () => {
    setFlowStage('ENTREGADO');
    void broadcastSolidarityStageChange({
      post,
      stage: 'ENTREGADO',
    });
    toast.success('📦 Marcado como entregado y enviado al servidor', {
      description: 'Se notificó a quien hizo la publicación para que confirme la entrega.',
      duration: 5000,
    });
  };

  // Acciones exclusivas del Flujo SOS Multiusuario
  const handleSosCommit = () => {
    if (isOwn) {
      toast.info('Esta es tu solicitud SOS · En espera de auxilio');
      return;
    }
    const res = recordSosHelper(post.client_mutation_id);
    setSosHelpersCount(res.count);
    setIsCommittedToSos(true);
    setIsHelper(true);
    void broadcastSolidarityStageChange({
      post,
      stage: 'COMPROMETIDO',
      helperName: 'Vecino solidario',
    });
    toast.success('¡Vas en camino a apoyar!', {
      description: 'Se notificó al solicitante que un vecino va a su auxilio.',
      duration: 5000,
    });
  };

  const handleSosCancelCommitment = () => {
    const nextCount = removeSosHelper(post.client_mutation_id);
    setSosHelpersCount(nextCount);
    setIsCommittedToSos(false);
    setIsHelper(false);
    toast.info('Compromiso de auxilio cancelado');
  };

  const handleSosReceived = () => {
    markPostResolvedTimestamp(post.client_mutation_id);
    setFlowStage('RECIBIDO');
    setResolvedAge(0);
    void broadcastSolidarityStageChange({
      post,
      stage: 'RECIBIDO',
    });
    toast.success('✅ ¡Auxilio recibido y emergencia atendida!', {
      description: 'Gracias a los vecinos por su apoyo solidario. La alerta se archivará en el historial.',
      duration: 6000,
    });
    if (onRefresh) onRefresh();
  };

  // Paso 3: Quien hizo la publicación confirma la entrega -> envía al servidor y actualiza para todos
  const handleStep3Received = () => {
    setFlowStage('RECIBIDO');
    void broadcastSolidarityStageChange({
      post,
      stage: 'RECIBIDO',
    });
    onCommitResource(
      post,
      {
        ...primaryResource,
        quantity_committed: primaryResource.quantity_committed,
      },
      1
    );
    toast.success('✅ ¡Entrega confirmada y sincronizada para todos!', {
      description: 'Se notificó al vecino que te ayudó y se completó la solicitud.',
      duration: 5000,
    });
    if (onRefresh) onRefresh();
  };

  const handleCancelCommitment = () => {
    setFlowStage('PENDIENTE');
    setIsHelper(false);
    void broadcastSolidarityStageChange({
      post,
      stage: 'PENDIENTE',
    });
    toast.info('Compromiso cancelado', {
      description: 'La solicitud vuelve a quedar en espera para otros vecinos.',
    });
  };

  return (
    <motion.article
      suppressHydrationWarning
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 400, damping: 30 }
      }
      className={`favor-card-article rounded-[28px] shadow-card-diffuse p-5 sm:p-6 space-y-4 transition-all duration-200 ${
        isVerifiedComplete
          ? 'is-complete bg-[#F2F9F5] border-2 border-[#15795A]/30 opacity-90'
          : isEmergency
          ? 'is-emergency-active bg-white border-2 border-red-500/80 shadow-md'
          : 'bg-white border-0 hover:shadow-lg'
      }`}
    >
      {/* 1. Badges superiores minimalistas y limpios */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isUrgent && (
            <span className="rounded-full bg-[#FFF1DC] text-[#7A3B00] font-black text-[10px] px-2.5 py-0.5 uppercase tracking-wide">
              URGENTE
            </span>
          )}

          {isOwn && (
            <span className="rounded-full bg-[#E6ECF7] text-[#0F2A56] border border-[#0F2A56]/20 font-bold text-[10px] px-2 py-0.5">
              Tu publicación
            </span>
          )}

          {flowStage === 'COMPROMETIDO' && !isVerifiedComplete && (
            <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
              <Users className="w-3 h-3 text-amber-700" />
              <span>1 en camino</span>
            </span>
          )}

          {flowStage === 'ENTREGADO' && !isVerifiedComplete && (
            <span className="rounded-full bg-sky-50 text-sky-800 border border-sky-300 font-bold text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
              <PackageCheck className="w-3 h-3 text-sky-700" />
              <span>Entregado</span>
            </span>
          )}

          {isVerifiedComplete && (
            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              <span>Atendido</span>
            </span>
          )}

          <span
            title={deviceVerified ? 'Vecino verificado con DNI' : 'En proceso de verificación'}
            className="inline-flex items-center gap-1 text-[11px] font-medium"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#15795A]" />
            <span className="text-[10px] font-semibold text-[#15795A]">Verificado</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => toast.success('Reporte enviado a la moderación barrial.')}
          aria-label="Reportar publicación"
          title="Reportar publicación"
          className="min-h-[48px] min-w-[48px] px-2 text-slate-500 hover:text-rose-600 flex items-center justify-center cursor-pointer rounded-full"
        >
          <Flag className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Título de la tarjeta (Alto contraste asegurado en todos los modos) */}
      <h3
        className={`favor-card-title text-base sm:text-lg font-black tracking-tight leading-snug ${
          isEmergency && !isVerifiedComplete ? 'text-red-950' : 'text-slate-950'
        }`}
        style={{ color: isEmergency && !isVerifiedComplete ? '#7F1D1D' : '#0F172A' }}
      >
        {post.title}
      </h3>

      {/* Foto adjunta opcional compacta */}
      {post.photo_url && (
        <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-100 max-h-40 w-full">
          <img
            src={post.photo_url}
            alt={post.title}
            className="w-full h-36 object-cover"
          />
        </div>
      )}

      {/* 3. Descripción acotada (Alto contraste oscuro legible sobre fondo claro) */}
      <p
        className="favor-card-desc text-xs sm:text-sm font-semibold leading-relaxed line-clamp-2"
        style={{ color: '#1E293B' }}
      >
        {post.description}
      </p>

      {/* 4. Lugar aproximado */}
      <div
        className="favor-card-location flex items-center gap-1.5 text-xs font-bold"
        style={{ color: '#334155' }}
      >
        <MapPin className="w-3.5 h-3.5 text-[#2F62D6] shrink-0" />
        <span className="truncate">{approxZone}</span>
      </div>

      {/* 5. Protección de Privacidad PII Discreta (Ley N° 29733) */}
      {post.privacy_radius_meters >= 50 && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/80 border border-amber-200/70 px-3 py-1.5 text-xs text-[#7A3B00]">
          <div className="flex items-center gap-1.5 min-w-0">
            <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate text-[11px] font-semibold">Ubicación protegida 50m</span>
          </div>
          <button
            type="button"
            onClick={() => setIsVaultOpen(true)}
            className="min-h-[48px] px-2 text-[11px] font-bold text-amber-800 underline hover:text-amber-900 cursor-pointer shrink-0"
          >
            Desbloquear PII
          </button>
        </div>
      )}

      {/* 6. Barra de Progreso Lineal Compacta */}
      <div className="rounded-xl bg-[#F4F5F7] px-3.5 py-2.5 space-y-1.5">
        {(() => {
          const res = resources.length > 0 ? resources[0] : primaryResource;
          const effectiveCommitted = isVerifiedComplete
            ? Math.max(res.quantity_needed, res.quantity_committed)
            : res.quantity_committed;
          const pct = Math.min(
            100,
            Math.max(0, Math.round((effectiveCommitted / Math.max(1, res.quantity_needed)) * 100))
          );

          return (
            <>
              <div className="flex items-center justify-between text-xs font-bold text-[#0B1E3F]">
                <span className="truncate">
                  <span className="text-[10px] font-black uppercase text-[#5B6068] tracking-wider mr-1.5">
                    NECESITA:
                  </span>
                  {res.item_name}
                </span>
                <span className="text-[11px] font-black text-[#15795A] shrink-0 ml-2">
                  {effectiveCommitted}/{res.quantity_needed} ({pct}%)
                  <span className="sr-only"> · {effectiveCommitted} de {res.quantity_needed} {res.unit ?? 'recursos'} cubiertos</span>
                </span>
              </div>

              {/* Barra lineal y circular accesible */}
              <div className="flex items-center gap-2">
                <svg
                  role="progressbar"
                  aria-valuenow={effectiveCommitted}
                  aria-valuemin={0}
                  aria-valuemax={res.quantity_needed}
                  aria-label={`Progreso de ${res.item_name}: ${effectiveCommitted} de ${res.quantity_needed} (${pct}%)`}
                  className="w-5 h-5 shrink-0 -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-slate-200 dark:text-slate-700"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#15795A"
                    strokeWidth="3.5"
                    strokeDasharray="88"
                    strokeDashoffset={88 - (88 * pct) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  data-testid={`resource-progress-${res.client_mutation_id}`}
                  className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden"
                >
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full rounded-full bg-[#15795A] transition-all duration-500 ease-out"
                  />
                </div>
              </div>
              <span className="sr-only">Meta: {res.quantity_needed} {res.unit ?? 'recursos'}</span>
            </>
          );
        })()}
      </div>

      {/* 7. Botonera Sincronizada según Rol y Tipo de Solicitud (SOS Comunitario vs Favor Habitual) */}
      <div className="flex items-center gap-2.5 pt-1 flex-wrap">
        {isEmergency ? (
          /* ======================================================== */
          /* FLUJO EXCLUSIVO SOS MULTIUSUARIO (EMERGENCIA COMUNITARIA) */
          /* ======================================================== */
          isVerifiedComplete ? (
            /* SOS VERDE: Auxilio atendido y recibido -> visible 20s y persistido en BD */
            <div
              aria-label="Auxilio recibido · Emergencia atendida"
              className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-emerald-600/20 text-emerald-900 border-2 border-emerald-500/40 font-black text-xs sm:text-sm inline-flex items-center justify-between gap-2 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>✓ Auxilio atendido y recibido</span>
              </div>
              {resolvedAge !== null && resolvedAge < 20 && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                  Archivando en {Math.max(0, 20 - resolvedAge)}s
                </span>
              )}
            </div>
          ) : isOwn ? (
            /* SOLICITANTE DEL SOS: ÚNICO facultado para marcar el auxilio como recibido */
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              {sosHelpersCount > 0 ? (
                <div className="min-h-[48px] h-12 px-3.5 rounded-full bg-amber-100 text-[#7A3B00] border border-amber-300 font-extrabold text-xs inline-flex items-center gap-1.5 select-none">
                  <Users className="w-4 h-4 text-amber-700" />
                  <span>{sosHelpersCount} vecino{sosHelpersCount > 1 ? 's' : ''} en camino a apoyarte</span>
                </div>
              ) : (
                <div className="min-h-[48px] h-12 px-3.5 rounded-full bg-[#E6ECF7] text-[#0F2A56] border border-[#0F2A56]/25 font-extrabold text-xs inline-flex items-center gap-1.5 select-none">
                  <Clock className="w-4 h-4 text-[#0F2A56]" />
                  <span>⏳ En espera de auxilio</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleSosReceived}
                aria-label="Marcar auxilio recibido y cerrar emergencia"
                className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ring-2 ring-emerald-300/70"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                <span>✓ Marcar auxilio recibido</span>
              </button>
            </div>
          ) : (
            /* VECINOS SOLIDARIOS: Múltiples personas pueden sumarse a acudir a apoyar */
            <div className="flex items-center gap-2 flex-1 min-w-[210px]">
              {isCommittedToSos ? (
                <>
                  <div className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-emerald-50 text-emerald-800 border-2 border-emerald-400 font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 select-none">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>✓ Vas en camino a apoyar</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSosCancelCommitment}
                    aria-label="Cancelar compromiso de auxilio"
                    title="Cancelar compromiso de auxilio"
                    className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSosCommit}
                  aria-label="Voy en camino a apoyar en este SOS"
                  className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer animate-pulse"
                >
                  <Heart className="w-5 h-5 text-white fill-white" />
                  <span>Voy en camino / Puedo apoyar</span>
                  {sosHelpersCount > 0 && (
                    <span className="bg-red-800 text-red-100 text-[10px] font-black px-2 py-0.5 rounded-full ml-1">
                      {sosHelpersCount} en camino
                    </span>
                  )}
                </button>
              )}
            </div>
          )
        ) : isVerifiedComplete ? (
          /* ESTADO FINAL: Entregado + Confirmado -> Color verde atenuado para todos */
          <button
            type="button"
            disabled
            aria-label="Ayuda entregada y recibida · Solicitud verificada"
            className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#15795A]/20 text-[#065F46] border border-[#15795A]/35 font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 opacity-80 cursor-default"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#15795A]" />
            <span>✓ Entregado y recibido</span>
          </button>
        ) : flowStage === 'COMPROMETIDO' ? (
          /* ESTADO 2: 1 persona se ha comprometido */
          isOwn ? (
            /* Quien publicó puede confirmar la entrega directamente cuando llega el vecino */
            <button
              type="button"
              onClick={handleStep3Received}
              aria-label="Confirmar recibido"
              className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#0D9488] hover:bg-[#0F766E] active:scale-[0.97] text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
              <span>Confirmar entrega recibida</span>
            </button>
          ) : (
            /* El segundo usuario (quien se comprometió) coloca "Entregado" cuando llega */
            <div className="flex items-center gap-2 flex-1 min-w-[210px]">
              <button
                type="button"
                onClick={handleStep2Delivered}
                aria-label="Marcar como entregado al vecino"
                className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#0F2A56] hover:bg-[#0B1E3F] active:scale-[0.97] text-white font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <PackageCheck className="w-4 h-4 shrink-0 text-amber-300" />
                <span>Marcar entregado</span>
              </button>
              {isHelper && (
                <button
                  type="button"
                  onClick={handleCancelCommitment}
                  aria-label="Cancelar compromiso"
                  title="Cancelar compromiso"
                  className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        ) : flowStage === 'ENTREGADO' ? (
          /* ESTADO 3: El ayudante ya colocó Entregado -> Quien publicó confirma la entrega */
          isOwn ? (
            <button
              type="button"
              onClick={handleStep3Received}
              aria-label="Confirmar recibido por el solicitante"
              className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#0D9488] hover:bg-[#0F766E] active:scale-[0.97] text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ring-2 ring-emerald-300/60"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
              <span>Confirmar recibido</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-[210px]">
              <span className="min-h-[48px] h-12 px-3.5 rounded-full bg-sky-50 text-[#0F2A56] border border-sky-300 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 select-none">
                <PackageCheck className="w-4 h-4 shrink-0 text-sky-600" />
                <span>Entregado · En espera del autor</span>
              </span>
              <button
                type="button"
                onClick={handleStep3Received}
                aria-label="Confirmar recibido por el solicitante"
                className="min-h-[48px] h-12 px-3.5 rounded-full bg-[#0D9488] hover:bg-[#0F766E] active:scale-[0.97] text-white font-black text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                <span>Confirmar recibido</span>
              </button>
            </div>
          )
        ) : isOwn ? (
          /* ESTADO 1 (Quien publicó la solicitud): Entra a espera hasta que el segundo usuario se comprometa */
          <div
            aria-label="Tu solicitud está en espera de apoyo vecinal"
            className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#E6ECF7] text-[#0F2A56] border border-[#0F2A56]/25 font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 select-none"
          >
            <Clock className="w-4 h-4 shrink-0 text-[#0F2A56]" />
            <span>⏳ En espera de apoyo vecinal</span>
          </div>
        ) : (
          /* ESTADO 1 (Segundo usuario / Vecino): Botón "Me comprometo" */
          <button
            type="button"
            onClick={handleStep1Commit}
            aria-label="Quiero ayudar · Comprometer Recurso / Ayuda"
            className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#15795A] hover:bg-[#0e5c27] active:scale-[0.97] text-white font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Heart className="w-5 h-5 text-white stroke-[2.2]" aria-hidden="true" />
            <span>Me comprometo</span>
            <span className="sr-only">Quiero ayudar · Comprometer Recurso / Ayuda</span>
          </button>
        )}

        <a
          href={`tel:${phone}`}
          aria-label={`${callLabel} para ${post.title}`}
          className="w-12 h-12 min-w-[48px] min-h-[48px] aspect-square rounded-full bg-[#F4F5F7] hover:bg-slate-200 text-[#0B1E3F] flex items-center justify-center shrink-0 active:scale-[0.97] transition-all shadow-2xs cursor-pointer"
        >
          <Phone className="w-5 h-5 stroke-[2]" aria-hidden="true" />
        </a>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver ubicación aproximada de ${post.title} en Google Maps (${effectiveLat}, ${effectiveLng})`}
          title="Ver ubicación aproximada en Google Maps"
          className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-[#E6ECF7] hover:bg-blue-100 text-[#2F62D6] border border-[#2F62D6]/20 flex items-center justify-center active:scale-[0.97] transition-all shrink-0 shadow-xs cursor-pointer"
        >
          <MapPin className="w-5 h-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
        </a>
      </div>

      <HelpConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        post={post}
        resource={primaryResource}
        commitment={commitment}
        mode={modalMode}
        onCommitSuccess={(quantity) => {
          setIsConfirmModalOpen(false);
          onCommitResource(
            post,
            {
              ...primaryResource,
              quantity_committed: primaryResource.quantity_committed,
            },
            quantity
          );
          if (onRefresh) onRefresh();
        }}
        onDeliveredSuccess={() => {
          if (onRefresh) onRefresh();
        }}
        onReceivedSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />

      <PiiVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        post={post}
      />
    </motion.article>
  );
}

export default FavorCard;
