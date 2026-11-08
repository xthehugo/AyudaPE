'use client';

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import type { IListingLocal, IPostLocal } from '@shared/types';
import { calculateDistanceMeters } from '@/lib/geo-utils';
import { localDb } from '@/lib/offline/db';
import { syncManager } from '@/lib/offline/sync-manager';
import { addNotification } from '@/lib/notifications/notifications-manager';
import {
  getOrCreateDeviceId,
  getPublicationAuthorDevice,
  getSolidarityMeta,
  getSolidarityStage,
  isHelperForPost,
  isOwnListing,
  isOwnPost,
  registerHelperPost,
  setPublicationAuthorDevice,
  setSolidarityStage,
  unregisterHelperPost,
  type SolidarityFlowStage,
} from '@/lib/ownership';

export interface RealtimeSosPayload {
  client_mutation_id?: string;
  title?: string;
  description: string;
  locationLabel: string;
  lat: number;
  lng: number;
  sectorId?: string;
  createdAt: string;
  authorDeviceId?: string;
  storedRecord?: IPostLocal | IListingLocal;
}

export interface RealtimePublicationPayload {
  client_mutation_id: string;
  module: 'OFICIOS_PRODUCTOS' | 'CADENA_FAVORES' | 'EMERGENCIA_SOS';
  lat: number;
  lng: number;
  sectorId?: string;
  authorDeviceId?: string;
  storedRecord?: IListingLocal | IPostLocal;
}

export interface RealtimeSolidarityStagePayload {
  post_client_mutation_id: string;
  post_title: string;
  stage: SolidarityFlowStage;
  authorDeviceId?: string;
  helperDeviceId?: string;
  helperName?: string;
  actorDeviceId: string;
  updatedAt: string;
}

export interface RealtimeEndorsementPayload {
  listing_client_mutation_id: string;
  listing_id?: number;
  listing_title: string;
  authorDeviceId?: string;
  endorserDeviceId: string;
  endorsement_count: number;
  weighted_trust_score: number;
  skill_tag?: string;
  updatedAt: string;
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://llvasghafojbdqcvkeek.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_ZET1ooKsP7K3lClG7lPsiA_GUQMaz_i';

// Radio máximo (en metros) para considerar que una alerta SOS pertenece a la misma localidad/ciudad activa
const LOCALITY_ALERT_RADIUS_METERS = 18000;

let supabaseClient: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let isChannelSubscribed = false;
let syncPollInterval: ReturnType<typeof setInterval> | null = null;

// Conjuntos de deduplicación para evitar notificaciones duplicadas entre WebSocket Broadcast y respaldo servidor
const processedStageEvents = new Set<string>();
const processedEndorseEvents = new Set<string>();

function getSupabaseRealtimeClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseClient;
}

function showBrowserPushNotification(title: string, body: string, tag: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag });
    } catch {
      // Ignorar en contextos sin SW
    }
  }
}

/**
 * Determina si una coordenada de emergencia SOS cae dentro de la localidad activa del usuario.
 */
export function isSosWithinActiveLocality(
  sosLat: number,
  sosLng: number,
  userActiveLat: number,
  userActiveLng: number
): boolean {
  if (
    !Number.isFinite(sosLat) ||
    !Number.isFinite(sosLng) ||
    !Number.isFinite(userActiveLat) ||
    !Number.isFinite(userActiveLng)
  ) {
    return true;
  }
  const distanceMeters = calculateDistanceMeters(sosLat, sosLng, userActiveLat, userActiveLng);
  return distanceMeters <= LOCALITY_ALERT_RADIUS_METERS;
}

/**
 * Procesa una transición de estado solidario (PENDIENTE -> COMPROMETIDO -> ENTREGADO -> RECIBIDO),
 * actualiza la base local para TODOS los usuarios y emite notificación SOLO a quien publicó y a quien ayudó.
 */
export async function applyIncomingSolidarityStage(
  payload: RealtimeSolidarityStagePayload
): Promise<void> {
  if (typeof window === 'undefined' || !payload?.post_client_mutation_id) return;

  const mutId = payload.post_client_mutation_id;
  const dedupKey = `${mutId}:${payload.stage}`;
  const isFirstTimeForStage = !processedStageEvents.has(dedupKey);
  processedStageEvents.add(dedupKey);

  // 1. Actualizar metadatos y etapa en localStorage + lanzar evento para que todas las tarjetas se actualicen
  setSolidarityStage(mutId, payload.stage, {
    authorDeviceId: payload.authorDeviceId,
    helperDeviceId: payload.helperDeviceId,
    helperName: payload.helperName,
    silentBroadcast: true,
  });

  // 2. Actualizar el estado del post en IndexedDB (Dexie) para que se refleje en todas las vistas
  let existingPost: IPostLocal | undefined;
  try {
    const allPosts = await localDb.posts.toArray();
    existingPost = allPosts.find((p) => p.client_mutation_id === mutId);
    if (existingPost) {
      const nextStatus: IPostLocal['status'] =
        payload.stage === 'RECIBIDO'
          ? 'ATENDIDO'
          : payload.stage === 'PENDIENTE'
          ? 'ACTIVO'
          : 'EN_COORDINACION';
      await localDb.bulkCachePosts([
        {
          ...existingPost,
          status: nextStatus,
          updated_at: payload.updatedAt || new Date().toISOString(),
        },
      ]);
    }
  } catch {
    // Ignorar errores de IndexedDB
  }

  window.dispatchEvent(
    new CustomEvent('redvecina_ws_publication_received', {
      detail: {
        client_mutation_id: mutId,
        module: 'CADENA_FAVORES',
        lat: existingPost?.public_lat ?? -12.0752,
        lng: existingPost?.public_lng ?? -75.2173,
      },
    })
  );

  if (!isFirstTimeForStage) return;

  // 3. Notificaciones dirigidas: SOLO para quien publicó (Autor) y quien ayudó (Ayudante)
  const myDeviceId = getOrCreateDeviceId();
  if (payload.actorDeviceId && payload.actorDeviceId === myDeviceId) {
    // Quien ejecutó el clic ya vio su confirmación inmediata local
    return;
  }

  const postForCheck: IPostLocal = existingPost ?? {
    client_mutation_id: mutId,
    sector_id: 1,
    category_id: 1,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: payload.post_title || 'Solicitud vecinal',
    description: '',
    urgency_level: 'MEDIA',
    public_lat: -12.0752,
    public_lng: -75.2173,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  };

  const isAuthor =
    isOwnPost(postForCheck) ||
    Boolean(payload.authorDeviceId && payload.authorDeviceId === myDeviceId);
  const isHelper =
    isHelperForPost(mutId) ||
    Boolean(payload.helperDeviceId && payload.helperDeviceId === myDeviceId);

  // Si no es ni quien publicó ni quien ayudó, solo se le actualiza la interfaz sin lanzar notificación
  if (!isAuthor && !isHelper) {
    return;
  }

  const titleLabel = payload.post_title || existingPost?.title || 'tu publicación';

  if (payload.stage === 'COMPROMETIDO' && isAuthor) {
    toast.info(`🤝 ¡Un vecino se ha comprometido a ayudarte!`, {
      description: `Alguien va en camino para apoyar en "${titleLabel}". Cuando recibas la ayuda, podrás confirmar la entrega.`,
      duration: 7500,
    });
    showBrowserPushNotification(
      '🤝 ¡Un vecino se comprometió a ayudarte!',
      `Una persona se ha comprometido con tu anuncio: "${titleLabel}".`,
      `solidarity-commit-${mutId}`
    );
    addNotification({
      id: `solidarity-commit-${mutId}`,
      type: 'SOLIDARITY_COMMIT',
      title: '🤝 ¡Un vecino se comprometió a ayudarte!',
      description: `Alguien va en camino para apoyar en "${titleLabel}". Cuando te entreguen el apoyo podrás confirmarlo.`,
      priority: 'NORMAL',
      metadata: {
        client_mutation_id: mutId,
        tab: 'MURO',
        actionLabel: 'Ver mi solicitud',
      },
    });
  } else if (payload.stage === 'ENTREGADO' && isAuthor) {
    toast.success(`📦 ¡El vecino marcó tu ayuda como ENTREGADA!`, {
      description: `Confirma la recepción en "${titleLabel}" pulsando "Confirmar entrega recibida".`,
      duration: 8500,
    });
    showBrowserPushNotification(
      '📦 Ayuda entregada · Confirma recepción',
      `El vecino indicó que ya entregó el apoyo para "${titleLabel}". Confírmalo en la app.`,
      `solidarity-delivered-${mutId}`
    );
    addNotification({
      id: `solidarity-delivered-${mutId}`,
      type: 'SOLIDARITY_DELIVERED',
      title: '📦 ¡Ayuda marcada como ENTREGADA!',
      description: `El vecino indicó que ya entregó el apoyo para "${titleLabel}". Por favor confirma la recepción en la app.`,
      priority: 'HIGH',
      metadata: {
        client_mutation_id: mutId,
        tab: 'MURO',
        actionLabel: 'Confirmar entrega recibida',
      },
    });
  } else if (payload.stage === 'RECIBIDO' && (isHelper || isAuthor)) {
    toast.success(`✅ ¡Entrega confirmada en "${titleLabel}"!`, {
      description: isHelper
        ? 'Quien publicó la solicitud confirmó que recibió tu apoyo. ¡Gracias por ayudar a tu barrio!'
        : 'Se confirmó la entrega y se actualizó para toda la comunidad.',
      duration: 7500,
    });
    showBrowserPushNotification(
      '✅ Entrega solidaria confirmada',
      `Se completó y verificó la entrega de "${titleLabel}".`,
      `solidarity-received-${mutId}`
    );
    if (isHelper) {
      addNotification({
        id: `solidarity-received-${mutId}`,
        type: 'SOLIDARITY_CONFIRMED',
        title: '✅ ¡Entrega confirmada por el autor!',
        description: `Quien publicó "${titleLabel}" confirmó que recibió tu ayuda. ¡Gracias por apoyar a tu comunidad!`,
        priority: 'NORMAL',
        metadata: {
          client_mutation_id: mutId,
          tab: 'MURO',
          actionLabel: 'Ver favor completado',
        },
      });
    }
  }
}

/**
 * Procesa una recomendación ("Recomendar" / Visto Bueno) en tiempo real:
 * actualiza el contador para TODOS los usuarios y notifica SOLO al autor del oficio o producto.
 */
export async function applyIncomingEndorsement(
  payload: RealtimeEndorsementPayload
): Promise<void> {
  if (typeof window === 'undefined' || !payload?.listing_client_mutation_id) return;

  const mutId = payload.listing_client_mutation_id;
  const dedupKey = `${mutId}:count:${payload.endorsement_count}`;
  const isNewEndorseEvent = !processedEndorseEvents.has(dedupKey);
  processedEndorseEvents.add(dedupKey);

  let foundListing: IListingLocal | undefined;
  try {
    const rows = await localDb.listings.toArray();
    foundListing = rows.find(
      (r) =>
        r.client_mutation_id === mutId ||
        (payload.listing_id !== undefined && r.id === payload.listing_id)
    );
    if (foundListing) {
      const nextCount = Math.max(
        foundListing.endorsement_count,
        payload.endorsement_count
      );
      const nextScore = Math.max(
        foundListing.weighted_trust_score,
        payload.weighted_trust_score
      );
      await localDb.bulkCacheListings([
        {
          ...foundListing,
          endorsement_count: nextCount,
          weighted_trust_score: nextScore,
          updated_at: payload.updatedAt || new Date().toISOString(),
        },
      ]);
    }
  } catch {
    // Ignorar
  }

  window.dispatchEvent(
    new CustomEvent('redvecina_ws_publication_received', {
      detail: {
        client_mutation_id: mutId,
        module: 'OFICIOS_PRODUCTOS',
        lat: foundListing?.latitude ?? -12.0752,
        lng: foundListing?.longitude ?? -75.2173,
      },
    })
  );

  if (!isNewEndorseEvent) return;

  const myDeviceId = getOrCreateDeviceId();
  if (payload.endorserDeviceId && payload.endorserDeviceId === myDeviceId) {
    return;
  }

  const listingForCheck: IListingLocal = foundListing ?? {
    client_mutation_id: mutId,
    category_id: 1,
    listing_type: 'SERVICIO_OFICIO',
    title: payload.listing_title || 'Tu anuncio',
    description: '',
    contact_phone: '',
    latitude: -12.0752,
    longitude: -75.2173,
    available_for_emergencies: false,
    endorsement_count: payload.endorsement_count,
    weighted_trust_score: payload.weighted_trust_score,
    is_pending_sync: false,
  };

  const isAuthor =
    isOwnListing(listingForCheck) ||
    Boolean(payload.authorDeviceId && payload.authorDeviceId === myDeviceId);

  if (!isAuthor) {
    return;
  }

  const titleLabel = payload.listing_title || foundListing?.title || 'tu oficio/producto';
  toast.success(`⭐ ¡Un vecino recomendó "${titleLabel}"!`, {
    description: `Tu publicación ahora tiene ${payload.endorsement_count} recomendaciones vecinales (★ ${Number(payload.weighted_trust_score).toFixed(1)}).`,
    duration: 7500,
  });
  showBrowserPushNotification(
    '⭐ ¡Nueva recomendación vecinal!',
    `Un vecino acaba de recomendar tu publicación "${titleLabel}".`,
    `endorse-${mutId}-${payload.endorsement_count}`
  );
  addNotification({
    id: `endorse-${mutId}-${payload.endorsement_count}`,
    type: 'LISTING_ENDORSED',
    title: '⭐ ¡Nueva recomendación vecinal!',
    description: `Un vecino recomendó tu publicación "${titleLabel}". Ahora cuenta con ${payload.endorsement_count} recomendaciones.`,
    priority: 'NORMAL',
    metadata: {
      client_mutation_id: mutId,
      tab: 'DIRECTORIO',
      endorsementCount: payload.endorsement_count,
      actionLabel: 'Ver mi publicación',
    },
  });
}

/**
 * Sincroniza periódicamente con `/api/v1/realtime/interaction` y `/api/v1/sync/delta`
 * para garantizar que incluso si un operador móvil bloquea paquetes WebSocket,
 * las publicaciones, compromisos, entregas y recomendaciones lleguen en tiempo real.
 */
export async function syncRealtimeInteractionsFromServer(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const prevListings = await localDb.listings.toArray();
    const prevEndorseMap = new Map<string, number>();
    for (const l of prevListings) {
      prevEndorseMap.set(l.client_mutation_id, l.endorsement_count ?? 0);
    }

    await syncManager.hydrateDownlink(1);

    const updatedListings = await localDb.listings.toArray();
    for (const l of updatedListings) {
      const oldCount = prevEndorseMap.get(l.client_mutation_id);
      if (oldCount !== undefined && l.endorsement_count > oldCount) {
        await applyIncomingEndorsement({
          listing_client_mutation_id: l.client_mutation_id,
          listing_id: l.id,
          listing_title: l.title,
          authorDeviceId: getPublicationAuthorDevice(l.client_mutation_id),
          endorserDeviceId: 'remote-server-sync',
          endorsement_count: l.endorsement_count,
          weighted_trust_score: l.weighted_trust_score,
          updatedAt: l.updated_at || new Date().toISOString(),
        });
      }
    }

    const res = await fetch('/api/v1/realtime/interaction', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;
    const json = (await res.json()) as {
      data?: {
        stages?: Record<
          string,
          {
            post_client_mutation_id: string;
            stage: SolidarityFlowStage;
            author_device_id?: string;
            helper_device_id?: string;
            helper_name?: string;
            post_title?: string;
            updated_at: string;
          }
        >;
        authors?: Record<string, string>;
      };
    };

    const data = json?.data;
    if (!data) return;

    if (data.authors) {
      for (const [mutId, authorDev] of Object.entries(data.authors)) {
        setPublicationAuthorDevice(mutId, authorDev);
      }
    }

    if (data.stages) {
      for (const [mutId, serverRecord] of Object.entries(data.stages)) {
        const currentLocalStage = getSolidarityStage(mutId);
        if (currentLocalStage !== serverRecord.stage) {
          await applyIncomingSolidarityStage({
            post_client_mutation_id: mutId,
            post_title: serverRecord.post_title || 'Solicitud vecinal',
            stage: serverRecord.stage,
            authorDeviceId: serverRecord.author_device_id,
            helperDeviceId: serverRecord.helper_device_id,
            helperName: serverRecord.helper_name,
            actorDeviceId: 'remote-server-sync',
            updatedAt: serverRecord.updated_at,
          });
        }
      }
    }
  } catch {
    // Ignorar errores de red offline
  }
}

/**
 * Asegura que el canal WebSocket de Supabase Realtime esté conectado y suscrito.
 */
export function ensureRealtimeChannel(callbacks?: {
  onRemoteSos?: (payload: RealtimeSosPayload) => void;
  onRemotePublication?: (payload: RealtimePublicationPayload) => void;
}): RealtimeChannel | null {
  if (typeof window === 'undefined') return null;
  const client = getSupabaseRealtimeClient();
  if (!client) return null;

  if (!realtimeChannel) {
    realtimeChannel = client.channel('redvecina_realtime_v1', {
      config: {
        broadcast: { self: false, ack: false },
      },
    });

    realtimeChannel
      .on('broadcast', { event: 'sos_emergency' }, (event) => {
        const payload = event.payload as RealtimeSosPayload | undefined;
        if (!payload || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
          return;
        }
        if (payload.client_mutation_id && payload.authorDeviceId) {
          setPublicationAuthorDevice(payload.client_mutation_id, payload.authorDeviceId);
        }
        window.dispatchEvent(
          new CustomEvent('redvecina_ws_sos_received', { detail: payload })
        );
        callbacks?.onRemoteSos?.(payload);
      })
      .on('broadcast', { event: 'new_publication' }, (event) => {
        const payload = event.payload as RealtimePublicationPayload | undefined;
        if (!payload) return;
        if (payload.client_mutation_id && payload.authorDeviceId) {
          setPublicationAuthorDevice(payload.client_mutation_id, payload.authorDeviceId);
        }
        void persistIncomingRealtimeRecord(payload.module, payload.storedRecord).then(() => {
          window.dispatchEvent(
            new CustomEvent('redvecina_ws_publication_received', { detail: payload })
          );
          callbacks?.onRemotePublication?.(payload);
        });
      })
      .on('broadcast', { event: 'solidarity_stage_changed' }, (event) => {
        const payload = event.payload as RealtimeSolidarityStagePayload | undefined;
        if (!payload) return;
        void applyIncomingSolidarityStage(payload);
      })
      .on('broadcast', { event: 'listing_endorsed' }, (event) => {
        const payload = event.payload as RealtimeEndorsementPayload | undefined;
        if (!payload) return;
        void applyIncomingEndorsement(payload);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_post' },
        (change) => {
          const row = change.new as Record<string, unknown>;
          void syncRealtimeInteractionsFromServer();
          if (change.eventType === 'INSERT' && row?.post_type === 'SOS_VULNERABLE') {
            const lat = Number(row.public_lat ?? -12.0528);
            const lng = Number(row.public_lng ?? -75.2155);
            const rawDesc = String(row.description ?? row.title ?? 'Emergencia vecinal SOS');
            const sosPayload: RealtimeSosPayload = {
              client_mutation_id: String(row.client_mutation_id ?? `sos-${Date.now()}`),
              title: String(row.title ?? '🚨 Emergencia SOS'),
              description: rawDesc,
              locationLabel: `Huancayo (Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)})`,
              lat,
              lng,
              createdAt: String(row.created_at ?? new Date().toISOString()),
            };
            window.dispatchEvent(
              new CustomEvent('redvecina_ws_sos_received', { detail: sosPayload })
            );
          } else {
            window.dispatchEvent(
              new CustomEvent('redvecina_ws_publication_received', {
                detail: {
                  client_mutation_id: String(row?.client_mutation_id ?? ''),
                  module: 'CADENA_FAVORES',
                  lat: Number(row?.public_lat ?? -12.0752),
                  lng: Number(row?.public_lng ?? -75.2173),
                },
              })
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proximity_listing' },
        (change) => {
          const row = change.new as Record<string, unknown>;
          void syncRealtimeInteractionsFromServer();
          window.dispatchEvent(
            new CustomEvent('redvecina_ws_publication_received', {
              detail: {
                client_mutation_id: String(row?.client_mutation_id ?? ''),
                module: 'OFICIOS_PRODUCTOS',
                lat: Number(row?.latitude ?? -12.0752),
                lng: Number(row?.longitude ?? -75.2173),
              },
            })
          );
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resource_commitment' },
        () => {
          void syncRealtimeInteractionsFromServer();
        }
      )
      .subscribe((status) => {
        isChannelSubscribed = status === 'SUBSCRIBED';
      });
  }

  if (!syncPollInterval && typeof window !== 'undefined') {
    void syncRealtimeInteractionsFromServer();
    syncPollInterval = setInterval(() => {
      void syncRealtimeInteractionsFromServer();
    }, 4000);
  }

  return realtimeChannel;
}

/**
 * Envía un evento por el canal WebSocket con reintento automático si aún se está suscribiendo.
 */
async function sendBroadcastEvent(event: string, payload: unknown): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const channel = ensureRealtimeChannel();
    if (!channel) return;
    if (isChannelSubscribed) {
      await channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    } else {
      setTimeout(() => {
        void channel.send({
          type: 'broadcast',
          event,
          payload,
        });
      }, 750);
    }
  } catch {
    // Fallback silencioso
  }
}

/**
 * Envía una alerta SOS en tiempo real por WebSocket a todos los dispositivos conectados.
 */
export async function broadcastRealtimeSos(payload: RealtimeSosPayload): Promise<void> {
  const enriched: RealtimeSosPayload = {
    ...payload,
    authorDeviceId: payload.authorDeviceId ?? getOrCreateDeviceId(),
  };
  await sendBroadcastEvent('sos_emergency', enriched);
}

/**
 * Registra al autor en el servidor y envía una publicación nueva (Oficio, Producto, Favor o SOS)
 * por WebSocket para que se actualice al instante en todos los dispositivos.
 */
export async function broadcastRealtimePublication(
  payload: RealtimePublicationPayload
): Promise<void> {
  const authorDeviceId = payload.authorDeviceId ?? getOrCreateDeviceId();
  setPublicationAuthorDevice(payload.client_mutation_id, authorDeviceId);

  if (typeof window !== 'undefined') {
    void fetch('/api/v1/realtime/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REGISTER_AUTHOR',
        client_mutation_id: payload.client_mutation_id,
        author_device_id: authorDeviceId,
      }),
    }).catch(() => {});
  }

  await sendBroadcastEvent('new_publication', {
    ...payload,
    authorDeviceId,
  });
}

/**
 * Envía un cambio de etapa solidaria (Me comprometo -> Marcar entregado -> Confirmar entrega)
 * al servidor y por WebSocket a todos los usuarios conectados.
 */
export async function broadcastSolidarityStageChange(params: {
  post: IPostLocal;
  stage: SolidarityFlowStage;
  helperName?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const myDeviceId = getOrCreateDeviceId();
  const mutId = params.post.client_mutation_id;
  const prevMeta = getSolidarityMeta(mutId);

  const authorDeviceId =
    getPublicationAuthorDevice(mutId) ??
    prevMeta?.authorDeviceId ??
    (isOwnPost(params.post) ? myDeviceId : undefined);

  let helperDeviceId = prevMeta?.helperDeviceId;
  if (params.stage === 'COMPROMETIDO') {
    helperDeviceId = myDeviceId;
    registerHelperPost(mutId);
  } else if (params.stage === 'PENDIENTE') {
    helperDeviceId = undefined;
    unregisterHelperPost(mutId);
  }

  const dedupKey = `${mutId}:${params.stage}`;
  processedStageEvents.add(dedupKey);

  setSolidarityStage(mutId, params.stage, {
    authorDeviceId,
    helperDeviceId,
    helperName: params.helperName ?? prevMeta?.helperName,
  });

  // Actualizar estado del post en IndexedDB local
  try {
    const nextStatus: IPostLocal['status'] =
      params.stage === 'RECIBIDO'
        ? 'ATENDIDO'
        : params.stage === 'PENDIENTE'
        ? 'ACTIVO'
        : 'EN_COORDINACION';
    await localDb.bulkCachePosts([
      {
        ...params.post,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      },
    ]);
  } catch {
    // Ignorar
  }

  const wsPayload: RealtimeSolidarityStagePayload = {
    post_client_mutation_id: mutId,
    post_title: params.post.title,
    stage: params.stage,
    authorDeviceId,
    helperDeviceId,
    helperName: params.helperName ?? prevMeta?.helperName,
    actorDeviceId: myDeviceId,
    updatedAt: new Date().toISOString(),
  };

  // 1. Enviar al servidor para persistir en PostgreSQL y sincronizar a todos
  void fetch('/api/v1/realtime/interaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'SOLIDARITY_STAGE',
      post_client_mutation_id: mutId,
      post_title: params.post.title,
      stage: params.stage,
      author_device_id: authorDeviceId,
      helper_device_id: helperDeviceId,
      helper_name: wsPayload.helperName,
    }),
  }).catch(() => {});

  // 2. Transmitir por WebSocket a todos los dispositivos conectados
  await sendBroadcastEvent('solidarity_stage_changed', wsPayload);
}

/**
 * Envía una recomendación de Oficio o Producto al servidor y por WebSocket a todos los usuarios,
 * disparando notificación en el dispositivo del autor de la publicación.
 */
export async function broadcastListingEndorsement(params: {
  listing: IListingLocal;
  proximityWeight?: number;
  skillTag?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const myDeviceId = getOrCreateDeviceId();
  const mutId = params.listing.client_mutation_id;
  const authorDeviceId = getPublicationAuthorDevice(mutId);

  const dedupKey = `${mutId}:count:${params.listing.endorsement_count}`;
  processedEndorseEvents.add(dedupKey);

  // 1. Enviar al servidor para actualizar PostgreSQL (proximity_listing)
  void fetch('/api/v1/realtime/interaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'LISTING_ENDORSE',
      listing_client_mutation_id: mutId,
      listing_id: params.listing.id,
      proximity_weight: params.proximityWeight ?? 1.0,
    }),
  }).catch(() => {});

  // 2. Transmitir por WebSocket a todos los usuarios (y notificar al autor)
  const wsPayload: RealtimeEndorsementPayload = {
    listing_client_mutation_id: mutId,
    listing_id: params.listing.id,
    listing_title: params.listing.title,
    authorDeviceId,
    endorserDeviceId: myDeviceId,
    endorsement_count: params.listing.endorsement_count,
    weighted_trust_score: params.listing.weighted_trust_score,
    skill_tag: params.skillTag,
    updatedAt: new Date().toISOString(),
  };

  await sendBroadcastEvent('listing_endorsed', wsPayload);
}

/**
 * Guarda inmediatamente un registro recibido por WebSocket en la caché IndexedDB (Dexie)
 * para que se refleje sin latencia en el Mapa, Oficios y Muro Solidario.
 */
export async function persistIncomingRealtimeRecord(
  module: 'OFICIOS_PRODUCTOS' | 'CADENA_FAVORES' | 'EMERGENCIA_SOS',
  record?: IListingLocal | IPostLocal
): Promise<void> {
  if (!record) return;
  try {
    if (module === 'OFICIOS_PRODUCTOS') {
      await localDb.bulkCacheListings([record as IListingLocal]);
    } else {
      await localDb.bulkCachePosts([record as IPostLocal]);
    }
  } catch {
    // Ignorar colisiones
  }
}
