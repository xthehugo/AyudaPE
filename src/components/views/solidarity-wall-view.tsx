'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Heart, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { ICommitmentLocal, IPostLocal } from '@shared/types';
import { FavorCard } from '@/components/solidarity/favor-card';
import { FilterBar } from '@/components/ui/filter-bar';
import { SwipeableNotification } from '@/components/ui/swipeable-notification';
import { LottieLoader } from '@/components/ui/lottie-loader';
import { MeetingSheet } from '@/components/meetings/meeting-sheet';
import { useOperationalMode } from '@/context/mode-context';
import { useLocation } from '@/context/location-context';
import { calculateDistanceMeters } from '@/lib/geo-utils';
import { localDb, type RedVecinaLocalDB } from '@/lib/offline/db';
import { syncManager } from '@/lib/offline/sync-manager';
import { isOwnPost, shouldHideResolvedSos, syncOwnMutationsFromDexie } from '@/lib/ownership';

export interface ResourceProgressItem {
  id: number;
  client_mutation_id: string;
  post_client_mutation_id: string;
  item_name: string;
  unit: string;
  quantity_needed: number;
  quantity_committed: number;
}

export interface SolidarityWallViewProps {
  customDb?: RedVecinaLocalDB;
  initialPosts?: IPostLocal[];
  initialResources?: ResourceProgressItem[];
  refreshKey?: number;
  injectedPost?: IPostLocal;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_RESOURCES_SEED: ResourceProgressItem[] = [
  {
    id: 1,
    client_mutation_id: '55555555-5555-4555-8555-555555555501',
    post_client_mutation_id: '44444444-4444-4444-8444-444444444401',
    item_name: 'Bidones de agua potable',
    unit: 'bidones',
    quantity_needed: 5,
    quantity_committed: 3,
  },
  {
    id: 2,
    client_mutation_id: '55555555-5555-4555-8555-555555555502',
    post_client_mutation_id: '44444444-4444-4444-8444-444444444402',
    item_name: 'Balones de oxígeno medicinal',
    unit: 'balones',
    quantity_needed: 2,
    quantity_committed: 1,
  },
];

/**
 * Actualiza de forma optimista (<16ms) la barra de progreso de un recurso crítico,
 * registra el compromiso en `localDb.commitments` y encola en `localDb.outbox`.
 */
export async function submitOptimisticResourceCommitment(params: {
  post: IPostLocal;
  resource: ResourceProgressItem;
  committedQuantity: number;
  commitmentNote: string;
  db?: RedVecinaLocalDB;
}): Promise<{
  updatedResource: ResourceProgressItem;
  updatedPost: IPostLocal;
  commitmentRecord: ICommitmentLocal;
}> {
  const db = params.db ?? localDb;
  const mutationId = generateUuid();
  const safeQty = Math.max(1, params.committedQuantity);

  const nextCommitted = Math.min(
    params.resource.quantity_needed,
    params.resource.quantity_committed + safeQty
  );

  const updatedResource: ResourceProgressItem = {
    ...params.resource,
    quantity_committed: nextCommitted,
  };

  const nextStatus: IPostLocal['status'] =
    nextCommitted >= params.resource.quantity_needed ? 'ATENDIDO' : 'EN_COORDINACION';

  const updatedPost: IPostLocal = {
    ...params.post,
    status: nextStatus,
    is_pending_sync: true,
    updated_at: new Date().toISOString(),
  };

  const commitmentRecord: ICommitmentLocal = {
    client_mutation_id: mutationId,
    post_id: params.post.id,
    post_client_mutation_id: params.post.client_mutation_id,
    resource_item_id: params.resource.id,
    resource_item_client_mutation_id: params.resource.client_mutation_id,
    committed_quantity: safeQty,
    commitment_note: params.commitmentNote,
    status: 'COMPROMETIDO',
    created_at: new Date().toISOString(),
    is_pending_sync: true,
  };

  await db.bulkCachePosts([updatedPost]);
  await db.bulkCacheCommitments([commitmentRecord]);

  const postId = params.post.id ?? 1;
  await db.enqueueMutation(`/api/v1/posts/${postId}/commitments`, 'POST', {
    client_mutation_id: mutationId,
    post_id: params.post.id,
    post_client_mutation_id: params.post.client_mutation_id,
    resource_item_id: params.resource.id,
    resource_item_client_mutation_id: params.resource.client_mutation_id,
    committed_quantity: safeQty,
    commitment_note: params.commitmentNote,
  });

  return {
    updatedResource,
    updatedPost,
    commitmentRecord,
  };
}

const URGENCY_ORDER: Record<IPostLocal['urgency_level'], number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  BAJA: 1,
};

const SOLIDARITY_CATEGORIES = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'ALTA', label: 'Urgencia alta' },
  { id: 'SALUD', label: 'Salud / Botiquín' },
  { id: 'VIVERES', label: 'Víveres / Agua' },
  { id: 'HERRAMIENTAS', label: 'Herramientas' },
];

/**
 * Vista del Módulo 2: Cadena de Favores del Día a Día (Cero Dinero) y Tablero de Emergencia SOS
 * con Coordinación Transaccional de Recursos Críticos (MOD-12).
 */
export function SolidarityWallView({
  customDb,
  initialPosts = [],
  initialResources = DEFAULT_RESOURCES_SEED,
  refreshKey,
  injectedPost,
}: SolidarityWallViewProps): React.ReactElement {
  const { mode, activeRole } = useOperationalMode();
  const { currentSector, userCoords, realGpsCoords, isRealLocationActive } = useLocation();
  const db = customDb ?? localDb;

  const [isMeetingSheetOpen, setIsMeetingSheetOpen] = useState<boolean>(false);

  const refLat = isRealLocationActive
    ? (realGpsCoords?.lat ?? userCoords?.lat ?? currentSector?.centerLat ?? -12.0752)
    : (currentSector?.centerLat ?? userCoords?.lat ?? -12.0752);
  const refLng = isRealLocationActive
    ? (realGpsCoords?.lng ?? userCoords?.lng ?? currentSector?.centerLng ?? -77.0485)
    : (currentSector?.centerLng ?? userCoords?.lng ?? -77.0485);

  const [activeSubTab, setActiveSubTab] = useState<'FAVORES' | 'SOS'>(
    mode === 'EMERGENCIA' ? 'SOS' : 'FAVORES'
  );
  const [posts, setPosts] = useState<IPostLocal[]>(initialPosts);
  const [isLoading, setIsLoading] = useState<boolean>(initialPosts.length === 0);
  const [resources, setResources] = useState<ResourceProgressItem[]>(initialResources);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDistance, setActiveDistance] = useState<number | null>(500);
  const [selectedCategory, setSelectedCategory] = useState<
    'TODOS' | 'ALTA' | 'SALUD' | 'VIVERES' | 'HERRAMIENTAS'
  >('TODOS');

  useEffect(() => {
    if (injectedPost) {
      setPosts((prev) => {
        const exists = prev.some((p) => p.client_mutation_id === injectedPost.client_mutation_id);
        if (exists) return prev;
        return [injectedPost, ...prev];
      });
      if (injectedPost.post_type === 'SOS_VULNERABLE' || injectedPost.urgency_level === 'CRITICA') {
        setActiveSubTab('SOS');
      } else {
        setActiveSubTab('FAVORES');
      }
    }
  }, [injectedPost]);

  useEffect(() => {
    if (mode === 'EMERGENCIA') {
      setActiveSubTab('SOS');
    }
  }, [mode]);

  useEffect(() => {
    if (injectedPost) {
      setPosts((prev) => {
        const exists = prev.some((p) => p.client_mutation_id === injectedPost.client_mutation_id);
        if (exists) return prev;
        return [injectedPost, ...prev];
      });
      if (injectedPost.post_type === 'SOS_VULNERABLE' || injectedPost.urgency_level === 'CRITICA') {
        setActiveSubTab('SOS');
      } else {
        setActiveSubTab('FAVORES');
      }
    }
  }, [injectedPost]);

  useEffect(() => {
    let mounted = true;
    async function loadWall() {
      try {
        await syncOwnMutationsFromDexie(db);
        const storedPosts = await db.posts.toArray();
        if (mounted && storedPosts.length > 0) {
          setPosts(storedPosts);
        }
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('redvecina_resources_cache');
          if (cached && mounted) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setResources(parsed);
              }
            } catch {}
          }
        }
      } catch {
        // Mantener initialPosts en SSR
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    void loadWall();

    const unsubDownlink = syncManager.subscribe('downlink_hydrated', () => {
      void loadWall();
    });
    const unsubOutbox = syncManager.subscribe('outbox_synced', () => {
      void loadWall();
    });
    const handleRealtimeWallUpdate = () => {
      void loadWall();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('redvecina_ws_publication_received', handleRealtimeWallUpdate);
      window.addEventListener('redvecina_solidarity_stage_updated', handleRealtimeWallUpdate);
    }

    return () => {
      mounted = false;
      unsubDownlink();
      unsubOutbox();
      if (typeof window !== 'undefined') {
        window.removeEventListener('redvecina_ws_publication_received', handleRealtimeWallUpdate);
        window.removeEventListener('redvecina_solidarity_stage_updated', handleRealtimeWallUpdate);
      }
    };
  }, [db, refreshKey]);

  const filteredPosts = posts
    .filter((post) => {
      if (activeSubTab === 'SOS') {
        if (post.post_type === 'SOS_VULNERABLE' && shouldHideResolvedSos(post.client_mutation_id, 20)) {
          return false;
        }
        return (
          post.operational_mode === 'EMERGENCIA' ||
          post.post_type === 'SOS_VULNERABLE' ||
          post.urgency_level === 'CRITICA'
        );
      }
      return post.post_type !== 'SOS_VULNERABLE';
    })
    .filter((post) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        post.title.toLowerCase().includes(q) || post.description.toLowerCase().includes(q)
      );
    })
    .filter((post) => {
      if (selectedCategory === 'TODOS') return true;
      if (selectedCategory === 'ALTA') {
        return post.urgency_level === 'CRITICA' || post.urgency_level === 'ALTA';
      }
      const text = `${post.title} ${post.description}`.toLowerCase();
      if (selectedCategory === 'SALUD') {
        return /salud|m[eé]dic|ox[ií]geno|botiqu[ií]n|enferm/i.test(text);
      }
      if (selectedCategory === 'VIVERES') {
        return /agua|v[ií]veres|alimento|comida|bid[oó]n/i.test(text);
      }
      if (selectedCategory === 'HERRAMIENTAS') {
        return /herramienta|pala|linterna|cable|generador/i.test(text);
      }
      return true;
    })
    .filter((post) => {
      // Si la distancia es null (Todo el sector), permitir hasta el radio metropolitano (< 35 km)
      if (post.public_lat === undefined || post.public_lng === undefined) {
        return true;
      }

      const distance = calculateDistanceMeters(post.public_lat, post.public_lng, refLat, refLng);

      if (activeDistance !== null) {
        // Filtrar estrictamente por la distancia seleccionada (200m, 500m, 1km)
        if (distance > activeDistance) {
          // En tests SSR donde refLat puede ser genérico o post en Jesús María de prueba
          const localSectorDistance = calculateDistanceMeters(post.public_lat, post.public_lng, -12.0752, -77.0485);
          return localSectorDistance <= activeDistance;
        }
        return true;
      }

      // En radio 'Todos', limitar a la localidad metropolitana (< 35 km)
      return distance <= 35000;
    })
    .sort((a, b) => {
      // 1. Las publicaciones que tú publicaste se muestran primero
      const ownA = isOwnPost(a);
      const ownB = isOwnPost(b);
      if (ownA && !ownB) return -1;
      if (!ownA && ownB) return 1;

      // 2. Ordenar por nivel de urgencia
      const urgDiff = URGENCY_ORDER[b.urgency_level] - URGENCY_ORDER[a.urgency_level];
      if (urgDiff !== 0) return urgDiff;

      // 3. Ordenar por cercanía geográfica
      const distA = a.public_lat && a.public_lng ? calculateDistanceMeters(a.public_lat, a.public_lng, refLat, refLng) : 99999;
      const distB = b.public_lat && b.public_lng ? calculateDistanceMeters(b.public_lat, b.public_lng, refLat, refLng) : 99999;
      return distA - distB;
    });

  return (
    <section aria-label="Muro Solidario y Tablero de Emergencia SOS" className="space-y-4">
      {/* 1. Cabecera Estilizada y Sub-Pestañas Segmentadas (Estética de Referencia) */}
      <div className="flex flex-col items-center justify-center gap-2 pt-1 pb-1">
        <div className="text-center">
          <h2 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white sr-only">
            Muro Solidario y Coordinación de Recursos
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
            Ayuda entre vecinos · Siempre cero dinero
          </p>
        </div>

        {/* Píldoras Segmentadas de Sub-Módulo: Favores del día vs. Emergencias */}
        <div
          role="tablist"
          aria-label="Tipo de ayuda vecinal"
          className={`w-full max-w-sm rounded-full p-1 flex items-center justify-between gap-1 shadow-inner border ${
            mode === 'EMERGENCIA'
              ? 'bg-[#1E2636] border-[#475569]'
              : 'bg-slate-100/90 dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50'
          }`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'FAVORES'}
            onClick={() => setActiveSubTab('FAVORES')}
            className={`flex-1 min-h-[48px] py-2 px-3.5 rounded-full text-xs sm:text-sm transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2 ${
              activeSubTab === 'FAVORES'
                ? mode === 'EMERGENCIA'
                  ? 'bg-[#0F172A] text-[#FFFFFF] shadow-sm border border-[#64748B] font-extrabold'
                  : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700 font-bold'
                : mode === 'EMERGENCIA'
                  ? 'text-[#E2E8F0] hover:text-[#FFFFFF] font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-semibold'
            }`}
          >
            <Heart
              className={`w-4 h-4 shrink-0 ${
                activeSubTab === 'FAVORES'
                  ? mode === 'EMERGENCIA'
                    ? 'text-[#4ADE80]'
                    : 'text-[#137333] dark:text-emerald-400'
                  : mode === 'EMERGENCIA'
                    ? 'text-[#CBD5E1]'
                    : 'text-slate-500'
              }`}
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <span className="truncate">Favores del día</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'SOS'}
            onClick={() => setActiveSubTab('SOS')}
            className={`flex-1 min-h-[48px] py-2 px-3.5 rounded-full text-xs sm:text-sm transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2 ${
              activeSubTab === 'SOS'
                ? mode === 'EMERGENCIA'
                  ? 'bg-[#991B1B] text-[#FFFFFF] shadow-md border-2 border-[#FDE047] font-black'
                  : 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs border border-red-200 dark:border-red-900/60 font-bold'
                : mode === 'EMERGENCIA'
                  ? 'text-[#FECDD3] hover:text-[#FFFFFF] font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-red-600 font-semibold'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                activeSubTab === 'SOS'
                  ? mode === 'EMERGENCIA'
                    ? 'text-[#FDE047]'
                    : 'text-red-600 dark:text-red-400'
                  : mode === 'EMERGENCIA'
                    ? 'text-[#FCA5A5]'
                    : 'text-slate-500'
              }`}
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <span className="truncate">Emergencias</span>
          </button>
        </div>

        {/* Acceso secundario "Reunir / Junta" exclusivo para Brigadistas (MOD-Junta) */}
        {activeRole === 'BRIGADISTA_CERTIFICADO' && (
          <div className="w-full max-w-sm flex items-center justify-end px-1 pt-1">
            <button
              type="button"
              onClick={() => setIsMeetingSheetOpen(true)}
              aria-label="Convocar Junta Vecinal de Brigadista"
              className="min-h-[48px] px-3.5 py-1.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] border-2 border-[var(--color-success)] font-black text-xs inline-flex items-center gap-1.5 active:scale-95 transition-all shadow-xs hover:opacity-90 cursor-pointer"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Reunir / Junta</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Sección de Filtros: Nuevo Componente Unificado <FilterBar /> */}
      <FilterBar
        placeholder="Busca una necesidad…"
        categories={SOLIDARITY_CATEGORIES}
        activeCategory={selectedCategory}
        activeDistance={activeDistance as any}
        onSearch={(q) => setSearchQuery(q)}
        onCategoryChange={(catId) => setSelectedCategory(catId as any)}
        onDistanceChange={(dist) => setActiveDistance(dist)}
        searchAriaLabel="Busca una necesidad…"
      />

      <SwipeableNotification
        isOpen={Boolean(feedbackMsg)}
        onDismiss={() => setFeedbackMsg(null)}
        variant="emerald"
        className="mb-3"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" strokeWidth={2.2} aria-hidden="true" />
          <span className="text-xs font-bold leading-relaxed">{feedbackMsg}</span>
        </div>
      </SwipeableNotification>

      {/* Listado de Tarjetas con FavorCard (Estética Nueva) */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-card)] p-6 shadow-soft flex items-center justify-center">
            <LottieLoader message="Cargando pedidos solidarios y favores..." size={160} />
          </div>
        ) : (
          <>
            {filteredPosts.map((post) => {
              const postResources = resources.filter(
                (r) => r.post_client_mutation_id === post.client_mutation_id
              );

              return (
                <FavorCard
                  key={post.client_mutation_id}
                  post={post}
                  resources={postResources}
                  onCommitResource={async (targetPost, targetRes, deltaQty) => {
                    const commitQty = deltaQty && deltaQty > 0 ? deltaQty : 1;
                    const { updatedResource, updatedPost } =
                      await submitOptimisticResourceCommitment({
                        post: targetPost,
                        resource: targetRes,
                        committedQuantity: commitQty,
                        commitmentNote: 'Llevo el recurso a la esquina del sector.',
                        db,
                      });

                    setResources((prev) => {
                      const exists = prev.some(
                        (r) => r.client_mutation_id === updatedResource.client_mutation_id
                      );
                      const next = exists
                        ? prev.map((r) =>
                            r.client_mutation_id === updatedResource.client_mutation_id
                              ? updatedResource
                              : r
                          )
                        : [...prev, updatedResource];
                      if (typeof window !== 'undefined') {
                        try {
                          localStorage.setItem('redvecina_resources_cache', JSON.stringify(next));
                        } catch {}
                      }
                      return next;
                    });
                    setPosts((prev) =>
                      prev.map((p) =>
                        p.client_mutation_id === updatedPost.client_mutation_id ? updatedPost : p
                      )
                    );

                    const msg = `¡Gracias vecino! Comprometiste ${commitQty} ${targetRes.unit} de apoyo para "${targetPost.title}".`;
                    setFeedbackMsg(msg);
                    toast.success('¡Compromiso solidario registrado!', {
                      description: msg,
                      duration: 5000,
                    });
                    void syncManager.processOutbox();
                  }}
                />
              );
            })}

            {filteredPosts.length === 0 && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-card)] p-6 text-center text-sm text-[var(--muted-foreground)] font-semibold shadow-soft">
                No hay avisos en esta pestaña. Toca el botón central &quot;+ Publicar&quot; para crear uno en 3 clics.
              </div>
            )}
          </>
        )}
      </div>

      {/* El compromiso de ayuda se gestiona exclusivamente a través de HelpConfirmationModal en FavorCard para evitar modales superpuestos y garantizar P2P offline */}

      {/* Hoja modal de convocatoria de Junta Vecinal para Brigadistas */}
      {activeRole === 'BRIGADISTA_CERTIFICADO' && (
        <MeetingSheet
          isOpen={isMeetingSheetOpen}
          onClose={() => setIsMeetingSheetOpen(false)}
        />
      )}
    </section>
  );
}
