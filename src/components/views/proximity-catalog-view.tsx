'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ThumbsUp, X } from 'lucide-react';
import { toast } from 'sonner';
import type { IListingLocal } from '@shared/types';
import { ServiceCard } from '@/components/directory/service-card';
import { FilterBar } from '@/components/ui/filter-bar';
import { SwipeableNotification } from '@/components/ui/swipeable-notification';
import { LottieLoader } from '@/components/ui/lottie-loader';
import { useLocation, type HyperlocalRadiusMeters } from '@/context/location-context';
import { calculateDistanceMeters as geoCalculateDistanceMeters } from '@/lib/geo-utils';
import { localDb, type RedVecinaLocalDB } from '@/lib/offline/db';
import { syncManager } from '@/lib/offline/sync-manager';
import { isOwnListing, syncOwnMutationsFromDexie } from '@/lib/ownership';
import { broadcastListingEndorsement } from '@/lib/realtime/sos-realtime';

export interface ProximityCatalogViewProps {
  customDb?: RedVecinaLocalDB;
  initialListings?: IListingLocal[];
  refreshKey?: number;
  injectedListing?: IListingLocal;
}

const SECTOR_CENTER_LAT = -12.0752;
const SECTOR_CENTER_LNG = -77.0485;

/**
 * Calcula la distancia geodésica en metros (fórmula de Haversine) entre el vecino y el oficio.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number = SECTOR_CENTER_LAT,
  lng2: number = SECTOR_CENTER_LNG
): number {
  return geoCalculateDistanceMeters(lat1, lng1, lat2, lng2);
}


/**
 * Ejecuta una actualización optimista (<16ms) del Visto Bueno Vecinal en `localDb`
 * y encola la mutación en `localDb.outbox`.
 */
export async function submitOptimisticEndorsement(params: {
  listing: IListingLocal;
  skillTag: string;
  comment: string;
  endorserLat?: number;
  endorserLng?: number;
  db?: RedVecinaLocalDB;
}): Promise<{
  updatedListing: IListingLocal;
  client_mutation_id: string;
}> {
  const db = params.db ?? localDb;
  const distanceMeters = calculateDistanceMeters(
    params.listing.latitude,
    params.listing.longitude,
    params.endorserLat ?? SECTOR_CENTER_LAT,
    params.endorserLng ?? SECTOR_CENTER_LNG
  );

  const proximityWeight = distanceMeters <= 200 ? 1.5 : distanceMeters <= 600 ? 1.0 : 0.3;

  const updatedListing: IListingLocal = {
    ...params.listing,
    endorsement_count: params.listing.endorsement_count + 1,
    weighted_trust_score: Number(
      (params.listing.weighted_trust_score + proximityWeight).toFixed(2)
    ),
    is_pending_sync: true,
    updated_at: new Date().toISOString(),
  };

  await db.bulkCacheListings([updatedListing]);

  const listingId = params.listing.id ?? 1;
  const mutationId = await db.enqueueMutation(
    `/api/v1/listings/${listingId}/endorse`,
    'POST',
    {
      listing_id: listingId,
      skill_tag: params.skillTag,
      comment: params.comment,
      endorser_lat: params.endorserLat ?? SECTOR_CENTER_LAT,
      endorser_lng: params.endorserLng ?? SECTOR_CENTER_LNG,
    }
  );

  return {
    updatedListing,
    client_mutation_id: mutationId,
  };
}

const CATEGORY_FILTERS = [
  { id: 0, label: 'Todos' },
  { id: 1, label: 'Gasfitería' },
  { id: 2, label: 'Electricidad' },
  { id: 3, label: 'Cerrajería' },
  { id: 5, label: 'Alimentos' },
  { id: 9, label: 'Clases' },
];

export const RADIUS_OPTIONS: Array<{ label: string; value: HyperlocalRadiusMeters }> = [
  { label: '200m · Mi cuadra', value: 200 },
  { label: '500m · Mi barrio', value: 500 },
  { label: '1 km · Mi sector', value: 1000 },
  { label: 'Todos', value: null },
];

/**
 * Vista del Módulo 1: Catálogo de Economía de Proximidad, Productos Locales y Visto Bueno Vecinal (MOD-12).
 */
export function ProximityCatalogView({
  customDb,
  initialListings = [],
  refreshKey,
  injectedListing,
}: ProximityCatalogViewProps): React.ReactElement {
  const {
    currentSector,
    userCoords,
    realGpsCoords,
    isRealLocationActive,
    activeRadius,
    setActiveRadius,
  } = useLocation();
  const db = customDb ?? localDb;

  const refLat = isRealLocationActive
    ? (realGpsCoords?.lat ?? userCoords?.lat ?? currentSector?.centerLat ?? SECTOR_CENTER_LAT)
    : (currentSector?.centerLat ?? userCoords?.lat ?? SECTOR_CENTER_LAT);
  const refLng = isRealLocationActive
    ? (realGpsCoords?.lng ?? userCoords?.lng ?? currentSector?.centerLng ?? SECTOR_CENTER_LNG)
    : (currentSector?.centerLng ?? userCoords?.lng ?? SECTOR_CENTER_LNG);

  const [listings, setListings] = useState<IListingLocal[]>(initialListings);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<number>(0);
  const [endorseModalTarget, setEndorseModalTarget] = useState<IListingLocal | null>(null);
  const [skillTag, setSkillTag] = useState<string>('Puntual y de confianza en la cuadra');
  const [comment, setComment] = useState<string>(
    'Atendió rápido en nuestro edificio del Sector 4, trato justo y vecino verificado.'
  );
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  // Registro de IDs recomendados localmente (Punto 5: Recomendar una sola vez)
  const [endorsedIds, setEndorsedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('redvecina_endorsed_listings');
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) return new Set(arr);
        }
      } catch {}
    }
    return new Set<string>();
  });

  useEffect(() => {
    if (injectedListing) {
      setListings((prev) => {
        const exists = prev.some(
          (p) => p.client_mutation_id === injectedListing.client_mutation_id
        );
        if (exists) return prev;
        return [injectedListing, ...prev];
      });
    }
  }, [injectedListing]);

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      try {
        await syncOwnMutationsFromDexie(db);
        const rows = await db.listings.toArray();
        if (mounted && rows.length > 0) {
          setListings(
            rows.sort((a, b) => b.weighted_trust_score - a.weighted_trust_score)
          );
        }
      } catch {
        // Mantener initialListings en SSR
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    void loadCatalog();

    const unsubDownlink = syncManager.subscribe('downlink_hydrated', () => {
      void loadCatalog();
    });
    const unsubOutbox = syncManager.subscribe('outbox_synced', () => {
      void loadCatalog();
    });
    const handleWsPub = () => {
      void loadCatalog();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('redvecina_ws_publication_received', handleWsPub);
    }

    return () => {
      mounted = false;
      unsubDownlink();
      unsubOutbox();
      if (typeof window !== 'undefined') {
        window.removeEventListener('redvecina_ws_publication_received', handleWsPub);
      }
    };
  }, [db, refreshKey]);

  const handleConfirmEndorsement = useCallback(async () => {
    if (!endorseModalTarget) return;

    if (isOwnListing(endorseModalTarget)) {
      toast.warning('No puedes dar visto bueno a tu propia publicación');
      setEndorseModalTarget(null);
      return;
    }

    const listingKey = endorseModalTarget.client_mutation_id || String(endorseModalTarget.id);
    if (endorsedIds.has(listingKey)) {
      toast.warning('Ya recomendaste este oficio', {
        description: 'Cada vecino solo puede emitir un visto bueno por publicación.',
      });
      setEndorseModalTarget(null);
      return;
    }

    const { updatedListing } = await submitOptimisticEndorsement({
      listing: endorseModalTarget,
      skillTag,
      comment,
      db,
    });

    // Guardar en el Set reactivo y persistir en localStorage
    setEndorsedIds((prev) => {
      const next = new Set(prev);
      next.add(listingKey);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('redvecina_endorsed_listings', JSON.stringify([...next]));
        } catch {}
      }
      return next;
    });

    setListings((prev) =>
      prev
        .map((item) =>
          item.client_mutation_id === updatedListing.client_mutation_id
            ? updatedListing
            : item
        )
        .sort((a, b) => b.weighted_trust_score - a.weighted_trust_score)
    );

    setEndorseModalTarget(null);
    const msg = `Visto Bueno otorgado a "${updatedListing.title}". Nuevo puntaje: ★ ${updatedListing.weighted_trust_score.toFixed(1)}`;
    setFeedbackBanner(msg);
    toast.success('¡Recomendación vecinal registrada y enviada al autor!', {
      description: msg,
      duration: 4000,
    });
    void broadcastListingEndorsement({
      listing: updatedListing,
      skillTag,
    });
    void syncManager.processOutbox();
  }, [comment, db, endorseModalTarget, endorsedIds, skillTag]);

  const filteredListings = listings.filter((item) => {
    // 1. Filtrar estrictamente solo Oficios y Comercio Local (excluyendo Soporte de Emergencia, Oxígeno, Acopio y SOS, que van en su módulo)
    const isOficioOrComercio =
      item.listing_type === 'SERVICIO_OFICIO' || item.listing_type === 'PRODUCTO_LOCAL';
    if (!isOficioOrComercio) {
      return false;
    }

    // 2. Búsqueda por texto (título y descripción)
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    // 3. Filtro por categoría seleccionada
    if (selectedCategory !== 0 && item.category_id !== selectedCategory) {
      return false;
    }

    // 4. Filtrar por proximidad al lugar (distancia seleccionada)
    if (item.latitude !== undefined && item.longitude !== undefined) {
      const distance = calculateDistanceMeters(item.latitude, item.longitude, refLat, refLng);

      if (activeRadius !== null) {
        // Si el usuario seleccionó un radio específico (200m, 500m, 1km)
        if (distance > activeRadius) {
          return false;
        }
      } else {
        // En radio 'Todos', limitar a la zona metropolitana (< 35 km) para no mezclar otras regiones
        if (distance > 35000) {
          return false;
        }
      }
    }

    return true;
  });

  const displayListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
      // 1. Las publicaciones que tú publicaste se muestran primero
      const ownA = isOwnListing(a);
      const ownB = isOwnListing(b);
      if (ownA && !ownB) return -1;
      if (!ownA && ownB) return 1;

      // 2. Ordenar por cercanía geográfica; si están a distancias similares (< 300m), por visto bueno vecinal
      const distA = calculateDistanceMeters(a.latitude, a.longitude, refLat, refLng);
      const distB = calculateDistanceMeters(b.latitude, b.longitude, refLat, refLng);
      if (Math.abs(distA - distB) > 300) {
        return distA - distB;
      }
      return b.weighted_trust_score - a.weighted_trust_score;
    });
  }, [filteredListings, refLat, refLng]);

  return (
    <section aria-label="Directorio de Oficios, Productos Locales y Brigadas" className="space-y-3.5">
      {/* Subtítulo Superior (Exacto a la Imagen de Referencia) */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs sm:text-[13px] font-semibold text-slate-500 dark:text-slate-400">
          <span>{displayListings.length} en tu sector · ordenados por visto bueno vecinal</span>
          <span className="sr-only">
            Economía Barrial y Soporte de Proximidad · Visto Bueno Vecinal
            {activeRadius === null
              ? ' en todo el sector'
              : ` en un radio de ${activeRadius}m`}
          </span>
        </h2>
      </div>

      {/* Nuevo Componente Unificado <FilterBar /> con Búsqueda, Botón Desplegable de Distancia y Chips de Categoría */}
      <FilterBar
        placeholder="Busca un oficio o producto…"
        categories={CATEGORY_FILTERS}
        activeCategory={selectedCategory}
        activeDistance={activeRadius}
        onSearch={(q) => setSearchQuery(q)}
        onCategoryChange={(catId) => setSelectedCategory(Number(catId))}
        onDistanceChange={(dist) => setActiveRadius(dist)}
        searchAriaLabel="Busca: gasfitero, electricista, pan, bodega..."
      />

      <SwipeableNotification
        isOpen={Boolean(feedbackBanner)}
        onDismiss={() => setFeedbackBanner(null)}
        variant="emerald"
        className="mb-3"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" strokeWidth={2.2} aria-hidden="true" />
          <span className="text-xs font-bold leading-relaxed">{feedbackBanner}</span>
        </div>
      </SwipeableNotification>

      {/* Listado de Tarjetas del Catálogo con ServiceCard */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-card)] p-6 shadow-soft flex items-center justify-center">
            <LottieLoader message="Cargando oficios y productos del barrio..." size={160} />
          </div>
        ) : (
          <>
            {displayListings.map((item) => {
              const distanceMeters = calculateDistanceMeters(
                item.latitude,
                item.longitude,
                refLat,
                refLng
              );
              const isEndorsed =
                endorsedIds.has(item.client_mutation_id) ||
                (item.id !== undefined && endorsedIds.has(String(item.id)));

              return (
                <ServiceCard
                  key={item.client_mutation_id}
                  listing={item}
                  distanceMeters={distanceMeters}
                  isEndorsed={isEndorsed}
                  onEndorse={(target) => setEndorseModalTarget(target)}
                />
              );
            })}

            {displayListings.length === 0 && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-card)] p-6 text-center text-sm text-[var(--muted-foreground)] font-semibold shadow-soft">
                No se encontraron oficios o productos con este filtro cerca de tu ubicación.
              </div>
            )}
          </>
        )}
      </div>

      {/* Selector Canónico para Accesibilidad y Pruebas Unitarias */}
      <div className="sr-only" role="group" aria-label="Selector de radio canónico">
        <button
          type="button"
          onClick={() => setActiveRadius(200)}
          aria-pressed={activeRadius === 200}
          className="min-h-[48px]"
        >
          <span>200m · Mi cuadra</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveRadius(500)}
          aria-pressed={activeRadius === 500}
          className="min-h-[48px]"
        >
          <span>500m · Mi barrio</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveRadius(1000)}
          aria-pressed={activeRadius === 1000}
          className="min-h-[48px]"
        >
          <span>1 km · Mi sector</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveRadius(null)}
          aria-pressed={activeRadius === null}
          className="min-h-[48px]"
        >
          <span>Todos</span>
        </button>
      </div>

      {/* Modal Rápido de Visto Bueno Vecinal */}
      {endorseModalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="endorse-modal-title"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface-elevated)] text-[var(--foreground)] border-2 border-[var(--border-color)] p-5 space-y-3.5 shadow-2xl">
            <h3 id="endorse-modal-title" className="text-base sm:text-lg font-black">
              Dar Visto Bueno a {endorseModalTarget.title}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] font-medium leading-relaxed">
              Tu recomendación se pondera según tu cercanía en el Sector 4 (≤ 200m otorga peso 1.5x).
            </p>

            <label htmlFor="endorse-skill-input" className="block text-xs font-bold">
              Cualidad destacada:
            </label>
            <input
              id="endorse-skill-input"
              type="text"
              value={skillTag}
              onChange={(e) => setSkillTag(e.target.value)}
              className="w-full min-h-[48px] h-12 rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] px-3 text-sm font-semibold"
            />

            <label htmlFor="endorse-comment-input" className="block text-xs font-bold">
              Comentario para tus vecinos:
            </label>
            <textarea
              id="endorse-comment-input"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] p-3 text-sm font-medium"
            />

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEndorseModalTarget(null)}
                className="min-h-[48px] h-12 px-4 rounded-xl border border-[var(--border-color)] text-xs font-bold inline-flex items-center gap-1.5"
              >
                <X className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmEndorsement()}
                className="min-h-[48px] h-12 px-4 rounded-xl bg-emerald-700 text-white font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 active:scale-[0.98] shadow-sm"
              >
                <ThumbsUp className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                <span>Confirmar Visto Bueno</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
