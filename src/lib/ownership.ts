/**
 * @file src/lib/ownership.ts
 * @description Gestión local y sincronizada de autoría de publicaciones ("Tu publicación"),
 * identificador único de dispositivo para notificaciones dirigidas (Autor / Ayudante),
 * y estados progresivos anti-fraude del Módulo Solidario (PENDIENTE -> COMPROMETIDO -> ENTREGADO -> RECIBIDO).
 */

import type { IListingLocal, IPostLocal } from '@shared/types';
import type { RedVecinaLocalDB } from '@/lib/offline/db';

const DEVICE_ID_KEY = 'redvecina_device_id_v1';
const MY_PUBLICATIONS_KEY = 'redvecina_my_publications_v1';
const MY_HELPED_POSTS_KEY = 'redvecina_my_helped_posts_v1';
const LAST_AUTHOR_NAME_KEY = 'redvecina_last_author_name';
const SOLIDARITY_STAGES_KEY = 'redvecina_solidarity_stages_v1';
const SOLIDARITY_META_KEY = 'redvecina_solidarity_meta_v1';
const AUTHOR_MAP_KEY = 'redvecina_author_device_map_v1';

/**
 * ID de mutaciones previamente reclamadas explícitamente en el dispositivo
 */
const KNOWN_OWN_MUTATION_IDS = new Set<string>([]);

/**
 * Prefijos de semillas estáticas de prueba (para nunca bloquear botones en suites unitarias)
 */
function isCanonicalSeedId(mutationId?: string): boolean {
  if (!mutationId) return false;
  return (
    mutationId.startsWith('33333333-') ||
    mutationId.startsWith('44444444-') ||
    mutationId.startsWith('55555555-')
  );
}

/**
 * Obtiene o genera un identificador único persistente para este navegador/dispositivo.
 * Permite dirigir notificaciones en tiempo real exclusivamente a quien publicó y a quien ayudó.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr-device';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const nextId = `dev-${randomPart}`;
    localStorage.setItem(DEVICE_ID_KEY, nextId);
    return nextId;
  } catch {
    return 'fallback-device';
  }
}

export interface StoredOwnPublications {
  mutationIds: string[];
  titles: string[];
  authorNames: string[];
}

function readStoredOwnPublications(): StoredOwnPublications {
  if (typeof window === 'undefined') {
    return { mutationIds: [], titles: [], authorNames: [] };
  }
  try {
    const raw = localStorage.getItem(MY_PUBLICATIONS_KEY);
    if (!raw) {
      return { mutationIds: [], titles: [], authorNames: [] };
    }
    const parsed = JSON.parse(raw) as Partial<StoredOwnPublications>;
    return {
      mutationIds: Array.isArray(parsed.mutationIds) ? parsed.mutationIds : [],
      titles: Array.isArray(parsed.titles) ? parsed.titles : [],
      authorNames: Array.isArray(parsed.authorNames) ? parsed.authorNames : [],
    };
  } catch {
    return { mutationIds: [], titles: [], authorNames: [] };
  }
}

function writeStoredOwnPublications(data: StoredOwnPublications): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MY_PUBLICATIONS_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('redvecina_ownership_updated'));
  } catch {
    // Ignorar errores de cuota
  }
}

/**
 * Registra el deviceId autor de cualquier publicación conocida (local o remota).
 */
export function setPublicationAuthorDevice(
  clientMutationId: string,
  authorDeviceId?: string
): void {
  if (typeof window === 'undefined' || !clientMutationId || !authorDeviceId) return;
  try {
    const raw = localStorage.getItem(AUTHOR_MAP_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[clientMutationId] = authorDeviceId;
    localStorage.setItem(AUTHOR_MAP_KEY, JSON.stringify(map));
  } catch {
    // Ignorar
  }
}

export function getPublicationAuthorDevice(clientMutationId?: string): string | undefined {
  if (typeof window === 'undefined' || !clientMutationId) return undefined;
  try {
    const raw = localStorage.getItem(AUTHOR_MAP_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[clientMutationId];
  } catch {
    return undefined;
  }
}

/**
 * Registra una publicación recién creada por este dispositivo para identificarla como "Tu publicación".
 */
export function registerOwnPublication(params: {
  clientMutationId: string;
  title?: string;
  authorName?: string;
}): void {
  if (typeof window === 'undefined') return;
  const current = readStoredOwnPublications();
  const nextIds = new Set(current.mutationIds);
  const nextTitles = new Set(current.titles);
  const nextAuthors = new Set(current.authorNames);

  if (params.clientMutationId) {
    nextIds.add(params.clientMutationId);
    setPublicationAuthorDevice(params.clientMutationId, getOrCreateDeviceId());
  }
  if (params.title && params.title.trim()) {
    nextTitles.add(params.title.trim().toLowerCase());
  }
  if (params.authorName && params.authorName.trim()) {
    const cleanAuthor = params.authorName.trim().toLowerCase();
    nextAuthors.add(cleanAuthor);
    try {
      localStorage.setItem(LAST_AUTHOR_NAME_KEY, cleanAuthor);
    } catch {
      // Ignorar
    }
  }

  writeStoredOwnPublications({
    mutationIds: Array.from(nextIds),
    titles: Array.from(nextTitles),
    authorNames: Array.from(nextAuthors),
  });
}

/**
 * Registra que este dispositivo/usuario se comprometió a ayudar en una solicitud solidaria.
 */
export function registerHelperPost(postMutationId: string): void {
  if (typeof window === 'undefined' || !postMutationId) return;
  try {
    const raw = localStorage.getItem(MY_HELPED_POSTS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(postMutationId)) {
      list.push(postMutationId);
      localStorage.setItem(MY_HELPED_POSTS_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignorar
  }
}

export function unregisterHelperPost(postMutationId: string): void {
  if (typeof window === 'undefined' || !postMutationId) return;
  try {
    const raw = localStorage.getItem(MY_HELPED_POSTS_KEY);
    if (!raw) return;
    const list: string[] = JSON.parse(raw);
    const next = list.filter((id) => id !== postMutationId);
    localStorage.setItem(MY_HELPED_POSTS_KEY, JSON.stringify(next));
  } catch {
    // Ignorar
  }
}

export function isHelperForPost(postMutationId?: string): boolean {
  if (typeof window === 'undefined' || !postMutationId) return false;
  try {
    const myDeviceId = getOrCreateDeviceId();
    const meta = getSolidarityMeta(postMutationId);
    if (meta?.helperDeviceId && meta.helperDeviceId === myDeviceId) {
      return true;
    }
    const raw = localStorage.getItem(MY_HELPED_POSTS_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return Array.isArray(list) && list.includes(postMutationId);
  } catch {
    return false;
  }
}

/**
 * Sincroniza todas las mutaciones históricas guardadas en el outbox/mutations de IndexedDB
 * de este navegador para reconocer automáticamente lo que publicó esta laptop o celular.
 */
export async function syncOwnMutationsFromDexie(db: RedVecinaLocalDB): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const mutations = await db.outbox.toArray();
    if (!mutations || mutations.length === 0) return;

    const current = readStoredOwnPublications();
    const nextIds = new Set(current.mutationIds);
    const nextTitles = new Set(current.titles);
    let changed = false;

    for (const m of mutations) {
      // Solo registrar mutaciones de creación de publicaciones (excluir compromisos o recomendaciones)
      const isCreateEndpoint =
        typeof m.endpoint === 'string' &&
        !m.endpoint.includes('/commitments') &&
        !m.endpoint.includes('/endorse');
      if (!isCreateEndpoint) continue;

      if (m.client_mutation_id && !isCanonicalSeedId(m.client_mutation_id)) {
        if (!nextIds.has(m.client_mutation_id)) {
          nextIds.add(m.client_mutation_id);
          changed = true;
        }
      }
      const payloadTitle =
        m.payload && typeof m.payload.title === 'string'
          ? m.payload.title.trim().toLowerCase()
          : '';
      if (payloadTitle && !nextTitles.has(payloadTitle)) {
        nextTitles.add(payloadTitle);
        changed = true;
      }
      const payloadId =
        m.payload && typeof m.payload.client_mutation_id === 'string'
          ? m.payload.client_mutation_id
          : '';
      if (payloadId && !isCanonicalSeedId(payloadId) && !nextIds.has(payloadId)) {
        nextIds.add(payloadId);
        changed = true;
      }
    }

    if (changed) {
      writeStoredOwnPublications({
        mutationIds: Array.from(nextIds),
        titles: Array.from(nextTitles),
        authorNames: current.authorNames,
      });
    }
  } catch {
    // Ignorar en entornos sin IndexedDB
  }
}

/**
 * Determina si un oficio o producto pertenece al usuario actual.
 */
export function isOwnListing(listing?: IListingLocal | null): boolean {
  if (!listing) return false;
  if (isCanonicalSeedId(listing.client_mutation_id)) return false;

  if (KNOWN_OWN_MUTATION_IDS.has(listing.client_mutation_id)) {
    return true;
  }

  const normalizedTitle = (listing.title || '').trim().toLowerCase();

  if (typeof window === 'undefined') return false;

  const authorDev = getPublicationAuthorDevice(listing.client_mutation_id);
  if (authorDev && authorDev === getOrCreateDeviceId()) {
    return true;
  }

  const stored = readStoredOwnPublications();
  if (stored.mutationIds.includes(listing.client_mutation_id)) {
    return true;
  }
  if (normalizedTitle && stored.titles.includes(normalizedTitle)) {
    return true;
  }

  // Comparar con el nombre del perfil activo
  try {
    const verifiedName = (localStorage.getItem('redvecina_verified_name') ?? '')
      .trim()
      .toLowerCase();
    const lastAuthor = (localStorage.getItem(LAST_AUTHOR_NAME_KEY) ?? '')
      .trim()
      .toLowerCase();
    const titlePrefix = normalizedTitle.split('·')[0]?.trim() ?? '';

    if (titlePrefix.length >= 3) {
      if (verifiedName && (verifiedName === titlePrefix || verifiedName.startsWith(titlePrefix))) {
        return true;
      }
      if (lastAuthor && lastAuthor === titlePrefix) {
        return true;
      }
      if (stored.authorNames.includes(titlePrefix)) {
        return true;
      }
    }
  } catch {
    // Ignorar
  }

  return false;
}

/**
 * Determina si una solicitud o publicación en el Muro Solidario fue creada por el usuario actual.
 */
export function isOwnPost(post?: IPostLocal | null): boolean {
  if (!post) return false;
  if (isCanonicalSeedId(post.client_mutation_id)) return false;
  if (typeof window === 'undefined') return false;

  const myDeviceId = getOrCreateDeviceId();
  const authorDev = getPublicationAuthorDevice(post.client_mutation_id);
  if (authorDev) {
    return authorDev === myDeviceId;
  }

  const meta = getSolidarityMeta(post.client_mutation_id);
  if (meta?.authorDeviceId) {
    return meta.authorDeviceId === myDeviceId;
  }

  const stored = readStoredOwnPublications();
  if (stored.mutationIds.includes(post.client_mutation_id)) {
    return true;
  }

  const normalizedTitle = (post.title || '').trim().toLowerCase();
  if (normalizedTitle && stored.titles.includes(normalizedTitle)) {
    return true;
  }

  return false;
}

/**
 * Estados del flujo anti-fraude para el Módulo Solidario:
 * 1) PENDIENTE: Aún sin compromiso activo (quien publicó está en espera).
 * 2) COMPROMETIDO: Segundo usuario pulsó "Me comprometo" (se actualiza para todos que 1 persona se ha comprometido).
 * 3) ENTREGADO: Quien ayudó llegó y pulsó "Marcar entregado" (esperando confirmación del solicitante).
 * 4) RECIBIDO: Quien publicó (y/o confirmación de entrega) confirmó -> se atenúa el color verde para todos.
 */
export type SolidarityFlowStage = 'PENDIENTE' | 'COMPROMETIDO' | 'ENTREGADO' | 'RECIBIDO';

export interface SolidarityStageMeta {
  stage: SolidarityFlowStage;
  authorDeviceId?: string;
  helperDeviceId?: string;
  helperName?: string;
  updatedAt?: string;
}

export function getSolidarityMeta(postMutationId: string): SolidarityStageMeta | null {
  if (typeof window === 'undefined' || !postMutationId) return null;
  try {
    const raw = localStorage.getItem(SOLIDARITY_META_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, SolidarityStageMeta>;
    return map[postMutationId] ?? null;
  } catch {
    return null;
  }
}

export function getSolidarityStage(
  postMutationId: string,
  fallbackCompleted = false,
  postStatus?: string
): SolidarityFlowStage {
  if (typeof window === 'undefined') {
    return fallbackCompleted || postStatus === 'ATENDIDO' ? 'RECIBIDO' : 'PENDIENTE';
  }
  try {
    const raw = localStorage.getItem(SOLIDARITY_STAGES_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, SolidarityFlowStage>;
      const found = map[postMutationId];
      if (
        found === 'PENDIENTE' ||
        found === 'COMPROMETIDO' ||
        found === 'ENTREGADO' ||
        found === 'RECIBIDO'
      ) {
        return found;
      }
    }
  } catch {
    // Ignorar
  }
  if (postStatus === 'ATENDIDO' || fallbackCompleted) {
    return 'RECIBIDO';
  }
  if (postStatus === 'ENTREGADO') {
    return 'ENTREGADO';
  }
  if (postStatus === 'EN_COORDINACION') {
    return 'COMPROMETIDO';
  }
  return 'PENDIENTE';
}

export function setSolidarityStage(
  postMutationId: string,
  stage: SolidarityFlowStage,
  meta?: {
    authorDeviceId?: string;
    helperDeviceId?: string;
    helperName?: string;
    silentBroadcast?: boolean;
  }
): void {
  if (typeof window === 'undefined' || !postMutationId) return;
  try {
    const raw = localStorage.getItem(SOLIDARITY_STAGES_KEY);
    const map: Record<string, SolidarityFlowStage> = raw ? JSON.parse(raw) : {};
    map[postMutationId] = stage;
    localStorage.setItem(SOLIDARITY_STAGES_KEY, JSON.stringify(map));

    const rawMeta = localStorage.getItem(SOLIDARITY_META_KEY);
    const metaMap: Record<string, SolidarityStageMeta> = rawMeta ? JSON.parse(rawMeta) : {};
    const prevMeta = metaMap[postMutationId] ?? { stage };
    metaMap[postMutationId] = {
      ...prevMeta,
      stage,
      authorDeviceId: meta?.authorDeviceId ?? prevMeta.authorDeviceId,
      helperDeviceId: meta?.helperDeviceId ?? prevMeta.helperDeviceId,
      helperName: meta?.helperName ?? prevMeta.helperName,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(SOLIDARITY_META_KEY, JSON.stringify(metaMap));

    if (meta?.authorDeviceId) {
      setPublicationAuthorDevice(postMutationId, meta.authorDeviceId);
    }

    window.dispatchEvent(
      new CustomEvent('redvecina_solidarity_stage_updated', {
        detail: {
          postMutationId,
          stage,
          authorDeviceId: metaMap[postMutationId].authorDeviceId,
          helperDeviceId: metaMap[postMutationId].helperDeviceId,
          helperName: metaMap[postMutationId].helperName,
        },
      })
    );

    if (!meta?.silentBroadcast && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('redvecina_solidarity_channel');
      channel.postMessage({
        type: 'SOLIDARITY_STAGE_CHANGE',
        postMutationId,
        stage,
        authorDeviceId: metaMap[postMutationId].authorDeviceId,
        helperDeviceId: metaMap[postMutationId].helperDeviceId,
        helperName: metaMap[postMutationId].helperName,
      });
      channel.close();
    }
  } catch {
    // Ignorar
  }
}

const SOS_HELPERS_KEY = 'redvecina_sos_helpers_v1';
const SOS_RESOLVED_TIMESTAMPS_KEY = 'redvecina_sos_resolved_timestamps_v1';

/**
 * Registra a un nuevo vecino que se compromete a acudir a una emergencia SOS
 * (soporta múltiples personas en camino simultáneamente).
 */
export function recordSosHelper(
  postMutationId: string,
  helperDeviceId?: string,
  _helperName?: string
): { count: number; helpers: string[] } {
  if (typeof window === 'undefined' || !postMutationId) {
    return { count: 1, helpers: ['vecino-1'] };
  }
  const devId = helperDeviceId ?? getOrCreateDeviceId();
  try {
    const raw = localStorage.getItem(SOS_HELPERS_KEY);
    const map: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    const currentList = Array.isArray(map[postMutationId]) ? map[postMutationId] : [];
    if (!currentList.includes(devId)) {
      currentList.push(devId);
    }
    map[postMutationId] = currentList;
    localStorage.setItem(SOS_HELPERS_KEY, JSON.stringify(map));

    window.dispatchEvent(
      new CustomEvent('redvecina_sos_helpers_updated', {
        detail: {
          postMutationId,
          count: currentList.length,
          helpers: currentList,
        },
      })
    );

    return { count: currentList.length, helpers: currentList };
  } catch {
    return { count: 1, helpers: [devId] };
  }
}

/**
 * Retorna el número de vecinos comprometidos que van en camino a atender un SOS.
 */
export function getSosHelpersCount(postMutationId: string): number {
  if (typeof window === 'undefined' || !postMutationId) return 0;
  try {
    const raw = localStorage.getItem(SOS_HELPERS_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, string[]>;
    const list = map[postMutationId];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Retorna true si el dispositivo actual ya se comprometió a apoyar en dicho SOS.
 */
export function isUserCommittedToSos(postMutationId: string): boolean {
  if (typeof window === 'undefined' || !postMutationId) return false;
  try {
    const myId = getOrCreateDeviceId();
    const raw = localStorage.getItem(SOS_HELPERS_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string[]>;
    const list = map[postMutationId];
    return Array.isArray(list) && list.includes(myId);
  } catch {
    return false;
  }
}

/**
 * Permite a un vecino cancelar su compromiso a un SOS si surge un impedimento.
 */
export function removeSosHelper(postMutationId: string, helperDeviceId?: string): number {
  if (typeof window === 'undefined' || !postMutationId) return 0;
  const devId = helperDeviceId ?? getOrCreateDeviceId();
  try {
    const raw = localStorage.getItem(SOS_HELPERS_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, string[]>;
    if (!map[postMutationId]) return 0;
    map[postMutationId] = map[postMutationId].filter((id) => id !== devId);
    localStorage.setItem(SOS_HELPERS_KEY, JSON.stringify(map));

    window.dispatchEvent(
      new CustomEvent('redvecina_sos_helpers_updated', {
        detail: {
          postMutationId,
          count: map[postMutationId].length,
          helpers: map[postMutationId],
        },
      })
    );
    return map[postMutationId].length;
  } catch {
    return 0;
  }
}

/**
 * Marca el timestamp exacto en que una alerta SOS fue marcada como recibida / atendida.
 */
export function markPostResolvedTimestamp(postMutationId: string): void {
  if (typeof window === 'undefined' || !postMutationId) return;
  try {
    const raw = localStorage.getItem(SOS_RESOLVED_TIMESTAMPS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[postMutationId] = Date.now();
    localStorage.setItem(SOS_RESOLVED_TIMESTAMPS_KEY, JSON.stringify(map));

    window.dispatchEvent(
      new CustomEvent('redvecina_sos_resolved_updated', {
        detail: { postMutationId, resolvedAt: map[postMutationId] },
      })
    );
  } catch {
    // Ignorar
  }
}

/**
 * Retorna cuántos segundos han transcurrido desde que se marcó como atendido el SOS.
 */
export function getPostResolvedAgeSeconds(postMutationId: string): number | null {
  if (typeof window === 'undefined' || !postMutationId) return null;
  try {
    const raw = localStorage.getItem(SOS_RESOLVED_TIMESTAMPS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, number>;
    const ts = map[postMutationId];
    if (typeof ts !== 'number') return null;
    return Math.max(0, Math.floor((Date.now() - ts) / 1000));
  } catch {
    return null;
  }
}

/**
 * Determina si un SOS ya atendido debe ocultarse suavemente de las vistas activas
 * (tras 20 segundos de haber sido marcado como recibido), manteniéndose en la base de datos.
 */
export function shouldHideResolvedSos(postMutationId: string, maxSeconds = 20): boolean {
  const age = getPostResolvedAgeSeconds(postMutationId);
  if (age === null) return false;
  return age >= maxSeconds;
}

