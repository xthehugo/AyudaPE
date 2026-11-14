'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CheckCircle2, MapPin, ShieldAlert, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import type { NavigationTabId } from '@/components/layout/bottom-nav';
import { QuickPublishSheet } from '@/components/publish/quick-publish-sheet';
import { IncidentCheckinBanner } from '@/components/safety/incident-checkin-banner';
import { OfflineEmergencyPrompt } from '@/components/safety/offline-emergency-prompt';
import { SwipeableNotification } from '@/components/ui/swipeable-notification';
import { CopilotView } from '@/components/views/copilot-view';
import { ProximityCatalogView } from '@/components/views/proximity-catalog-view';
import { SolidarityWallView } from '@/components/views/solidarity-wall-view';

const NeighborhoodMap = dynamic(
  () => import('@/components/map/neighborhood-map').then((mod) => mod.NeighborhoodMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-3xl animate-pulse text-sm text-slate-500 font-bold">
        Cargando mapa barrial...
      </div>
    ),
  }
);
import { useOperationalMode } from '@/context/mode-context';
import { useLocation } from '@/context/location-context';
import { useNetworkSync } from '@/hooks/use-network-sync';
import { useDownlinkSync } from '@/hooks/use-downlink-sync';
import {
  ALL_SEEDED_LISTINGS,
  ALL_SEEDED_POSTS,
} from '@/lib/initial-data';
import { localDb } from '@/lib/offline/db';
import { syncManager } from '@/lib/offline/sync-manager';
import { addNotification, dispatchNativePushNotification } from '@/lib/notifications/notifications-manager';
import { setPublicationAuthorDevice } from '@/lib/ownership';
import type { IPostLocal } from '@shared/types';
import {
  ensureRealtimeChannel,
  isSosWithinActiveLocality,
  persistIncomingRealtimeRecord,
  type RealtimePublicationPayload,
  type RealtimeSosPayload,
} from '@/lib/realtime/sos-realtime';

interface ActiveSosAlertPayload {
  description: string;
  locationLabel: string;
  lat: number;
  lng: number;
  createdAt: string;
}

/**
 * Punto de Entrada Principal de Next.js (`http://localhost:3000`):
 * Conecta `<AppShell>` (con `MobileShell`, `TopBar`, `BottomNavigation` y `GuidedTourModal`),
 * la Alerta Fija Superior SOS de alta visibilidad (Punto 5),
 * las vistas hiperlocales (`ProximityCatalogView`, `NeighborhoodMap`, `SolidarityWallView`, `CopilotView`)
 * y el panel de publicación `<QuickPublishSheet>` (Puntos 4 y 5).
 */
export default function HomePage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<NavigationTabId>('DIRECTORIO');
  const [isPublishSheetOpen, setIsPublishSheetOpen] = useState<boolean>(false);
  const [isSosPublish, setIsSosPublish] = useState<boolean>(false);
  const [lastPublishedToast, setLastPublishedToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [lastPublishedListing, setLastPublishedListing] = useState<any>(null);
  const [lastPublishedPost, setLastPublishedPost] = useState<any>(null);
  const [activeSosAlert, setActiveSosAlert] = useState<ActiveSosAlertPayload | null>(null);
  const [focusedMapCoords, setFocusedMapCoords] = useState<{
    lat: number;
    lng: number;
    timestamp?: number;
  } | null>(null);

  const { mode, setMode } = useOperationalMode();
  const { currentSector, userCoords, realGpsCoords, isRealLocationActive } = useLocation();
  const { isOnline } = useNetworkSync(1);
  const [hasEmergencyPosts, setHasEmergencyPosts] = useState<boolean>(true);
  const [showOfflinePrompt, setShowOfflinePrompt] = useState<boolean>(false);
  const [prevOnline, setPrevOnline] = useState<boolean>(true);

  // Referencia estable para coordenadas activas (evita desmontar y reconectar WebSockets con cada micro-cambio de GPS)
  const coordsRef = useRef({
    activeLat: -12.0528,
    activeLng: -75.2155,
  });

  coordsRef.current = {
    activeLat: isRealLocationActive
      ? (realGpsCoords?.lat ?? userCoords?.lat ?? currentSector?.centerLat ?? -12.0528)
      : (currentSector?.centerLat ?? userCoords?.lat ?? -12.0528),
    activeLng: isRealLocationActive
      ? (realGpsCoords?.lng ?? userCoords?.lng ?? currentSector?.centerLng ?? -75.2155)
      : (currentSector?.centerLng ?? userCoords?.lng ?? -75.2155),
  };

  // Al perder la conexión a internet: activar automáticamente el modo emergencia y preguntar al vecino
  useEffect(() => {
    if (prevOnline && !isOnline) {
      setMode('EMERGENCIA');
      setShowOfflinePrompt(true);
    }
    setPrevOnline(isOnline);
  }, [isOnline, prevOnline, setMode]);

  // Cargar y escuchar alertas SOS en tiempo real (localStorage + CustomEvent + BroadcastChannel + IndexedDB)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('redvecina_active_sos_alert');
      if (saved) {
        const parsed = JSON.parse(saved) as ActiveSosAlertPayload;
        if (parsed && parsed.description) {
          setActiveSosAlert(parsed);
          setMode('EMERGENCIA');
          // Disparar notificación nativa y háptica al abrir la app si hay un SOS activo en curso
          void dispatchNativePushNotification('🚨 Emergencia SOS Activa en tu barrio', {
            body: `${parsed.description}\n📍 ${parsed.locationLabel}`,
            tag: 'redvecina-sos-push',
          });
        }
      }
    } catch {
      // Ignorar
    }

    const handleLocalSos = (e: Event) => {
      const customEvent = e as CustomEvent<ActiveSosAlertPayload>;
      if (customEvent.detail?.description) {
        setActiveSosAlert(customEvent.detail);
        setHasEmergencyPosts(true);
        setMode('EMERGENCIA');
      }
    };

    window.addEventListener('redvecina_sos_alert_dispatched', handleLocalSos);

    // Conectar canal WebSocket en tiempo real (Supabase Realtime)
    ensureRealtimeChannel();

    const handleWebSocketSos = (e: Event) => {
      const customEvent = e as CustomEvent<RealtimeSosPayload>;
      const incoming = customEvent.detail;
      if (!incoming || !incoming.description) return;

      const postToPersist: IPostLocal = (incoming.storedRecord as IPostLocal) ?? {
        client_mutation_id: incoming.client_mutation_id || `sos-${Date.now()}`,
        sector_id: 1,
        category_id: 1,
        operational_mode: 'EMERGENCIA',
        post_type: 'SOS_VULNERABLE',
        title: incoming.title || '🚨 ALERTA SOS - Emergencia Inmediata',
        description: incoming.description,
        urgency_level: 'CRITICA',
        public_lat: incoming.lat,
        public_lng: incoming.lng,
        privacy_radius_meters: 50,
        status: 'ACTIVO',
        client_created_at: incoming.createdAt || new Date().toISOString(),
        is_pending_sync: false,
      };

      if (incoming.client_mutation_id && incoming.authorDeviceId) {
        setPublicationAuthorDevice(incoming.client_mutation_id, incoming.authorDeviceId);
      }

      void localDb.bulkCachePosts([postToPersist]).then(() => {
        setRefreshKey((k) => k + 1);
        setLastPublishedPost(postToPersist);
      });

      void persistIncomingRealtimeRecord('CADENA_FAVORES', incoming.storedRecord);
      void syncManager.hydrateDownlink(1);
      setRefreshKey((k) => k + 1);

      const activeLat = coordsRef.current.activeLat;
      const activeLng = coordsRef.current.activeLng;

      // Filtrar notificación SOS por localidad activa
      if (!isSosWithinActiveLocality(incoming.lat, incoming.lng, activeLat, activeLng)) {
        return;
      }

      const alertData: ActiveSosAlertPayload = {
        description: incoming.description,
        locationLabel: incoming.locationLabel,
        lat: incoming.lat,
        lng: incoming.lng,
        createdAt: incoming.createdAt,
      };

      try {
        localStorage.setItem('redvecina_active_sos_alert', JSON.stringify(alertData));
      } catch {
        // Ignorar
      }

      setActiveSosAlert(alertData);
      setHasEmergencyPosts(true);
      setMode('EMERGENCIA');

      addNotification({
        id: `sos-${incoming.createdAt || Date.now()}`,
        type: 'SOS_ALERT',
        title: `🚨 Emergencia SOS: ${incoming.description}`,
        description: `📍 Ubicación: ${incoming.locationLabel}`,
        priority: 'CRITICAL',
        metadata: {
          client_mutation_id: incoming.client_mutation_id,
          tab: 'MAPA',
          lat: incoming.lat,
          lng: incoming.lng,
          actionLabel: 'Ver emergencia en mapa',
        },
      });

      void dispatchNativePushNotification('🚨 Emergencia SOS en tu barrio', {
        body: `${incoming.description}\n📍 Ubicación: ${incoming.locationLabel}`,
        tag: 'redvecina-sos-push',
      });
    };

    const handleWebSocketPublication = (e: Event) => {
      const customEvent = e as CustomEvent<RealtimePublicationPayload>;
      const incoming = customEvent.detail;
      if (!incoming) return;
      void persistIncomingRealtimeRecord(incoming.module, incoming.storedRecord);
      void syncManager.hydrateDownlink(1);
      setRefreshKey((k) => k + 1);
    };

    window.addEventListener('redvecina_ws_sos_received', handleWebSocketSos);
    window.addEventListener('redvecina_ws_publication_received', handleWebSocketPublication);

    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('redvecina_sos_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'SOS_EMERGENCY' && event.data?.payload) {
          const incoming = event.data.payload as ActiveSosAlertPayload;
          const activeLat = coordsRef.current.activeLat;
          const activeLng = coordsRef.current.activeLng;

          if (!isSosWithinActiveLocality(incoming.lat, incoming.lng, activeLat, activeLng)) {
            return;
          }

          setActiveSosAlert(incoming);
          setHasEmergencyPosts(true);
          setMode('EMERGENCIA');

          addNotification({
            id: `sos-${incoming.createdAt || Date.now()}`,
            type: 'SOS_ALERT',
            title: `🚨 Emergencia SOS: ${incoming.description}`,
            description: `📍 Ubicación: ${incoming.locationLabel}`,
            priority: 'CRITICAL',
            metadata: {
              tab: 'MAPA',
              lat: incoming.lat,
              lng: incoming.lng,
              actionLabel: 'Ver emergencia en mapa',
            },
          });
          void dispatchNativePushNotification('🚨 Emergencia SOS en tu barrio', {
            body: `${incoming.description}\n📍 Ubicación: ${incoming.locationLabel}`,
            tag: 'redvecina-sos-push',
          });
        }
      };
    }

    return () => {
      window.removeEventListener('redvecina_sos_alert_dispatched', handleLocalSos);
      window.removeEventListener('redvecina_ws_sos_received', handleWebSocketSos);
      window.removeEventListener('redvecina_ws_publication_received', handleWebSocketPublication);
      if (channel) {
        channel.close();
      }
    };
  }, [setMode]);

  useEffect(() => {
    let mounted = true;
    async function checkEmergencies() {
      try {
        const posts = await localDb.posts.toArray();
        const sosPosts = posts.filter(
          (p) =>
            p.operational_mode === 'EMERGENCIA' ||
            p.post_type === 'SOS_VULNERABLE' ||
            p.urgency_level === 'CRITICA'
        );
        if (mounted) {
          setHasEmergencyPosts(sosPosts.length > 0);
        }
      } catch {
        // En SSR o entorno sin IndexedDB
      }
    }
    void checkEmergencies();
    return () => {
      mounted = false;
    };
  }, [currentSector?.name, refreshKey]);

  const hasEmergency = mode === 'EMERGENCIA' || hasEmergencyPosts || Boolean(activeSosAlert);

  const handleOpenStandardPublish = () => {
    setIsSosPublish(false);
    setIsPublishSheetOpen(true);
  };

  const handleOpenSosPublish = () => {
    setMode('EMERGENCIA');
    setIsSosPublish(true);
    setIsPublishSheetOpen(true);
  };

  const handleDismissSosAlert = () => {
    setActiveSosAlert(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('redvecina_active_sos_alert');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleExitEmergency = () => {
      setActiveSosAlert(null);
      try {
        localStorage.removeItem('redvecina_active_sos_alert');
      } catch {}
    };

    const handleTabChange = (e: Event) => {
      const custom = e as CustomEvent<{
        tab: NavigationTabId;
        focusedCoords?: { lat: number; lng: number };
      }>;
      if (custom.detail?.tab) {
        setActiveTab(custom.detail.tab);
        if (custom.detail.focusedCoords) {
          const coords = {
            lat: custom.detail.focusedCoords.lat,
            lng: custom.detail.focusedCoords.lng,
            timestamp: Date.now(),
          };
          setFocusedMapCoords(coords);
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('redvecina_focus_map_coords', { detail: coords })
            );
          }, 40);
        }
      }
    };

    const handleMeetingBroadcast = (e: Event) => {
      const custom = e as CustomEvent<{ meeting: any }>;
      const meeting = custom.detail?.meeting;
      if (!meeting) return;

      addNotification({
        id: `meeting-${meeting.id}`,
        type: 'MEETING_CONVOKED',
        title: `📢 Junta Vecinal: ${meeting.motive}`,
        description: `Convocada en ${meeting.meeting_place_name} (${meeting.scheduled_time})`,
        priority: 'HIGH',
        metadata: {
          client_mutation_id: String(meeting.id),
          tab: 'MAPA',
          lat: meeting.meeting_lat,
          lng: meeting.meeting_lng,
          meetingPlace: meeting.meeting_place_name,
          scheduledTime: meeting.scheduled_time,
          actionLabel: 'Ver junta en mapa',
        },
      });
    };

    window.addEventListener('redvecina_exit_emergency_mode', handleExitEmergency);
    window.addEventListener('redvecina_change_tab', handleTabChange);
    window.addEventListener('redvecina_meeting_broadcast', handleMeetingBroadcast);
    return () => {
      window.removeEventListener('redvecina_exit_emergency_mode', handleExitEmergency);
      window.removeEventListener('redvecina_change_tab', handleTabChange);
      window.removeEventListener('redvecina_meeting_broadcast', handleMeetingBroadcast);
    };
  }, []);

  // Hidratación incremental Downlink desde GET /api/v1/sync/delta
  useDownlinkSync(1);

  // Asegurar semilla inicial y sincronización de registros en IndexedDB local
  useEffect(() => {
    async function seedLocalCacheIfEmpty() {
      try {
        const DATA_CLEANUP_KEY = 'redvecina_dataset_version';
        const CURRENT_DATA_VERSION = 'v4_huancayo_exposicion_profesional';
        const currentVersion = typeof window !== 'undefined' ? localStorage.getItem(DATA_CLEANUP_KEY) : null;

        if (currentVersion !== CURRENT_DATA_VERSION) {
          // Purgar caché obsoleta o con datos de pruebas no realistas
          await localDb.listings.clear();
          await localDb.posts.clear();
          await localDb.bulkCacheListings(ALL_SEEDED_LISTINGS);
          await localDb.bulkCachePosts(ALL_SEEDED_POSTS);
          if (typeof window !== 'undefined') {
            localStorage.setItem(DATA_CLEANUP_KEY, CURRENT_DATA_VERSION);
          }
        } else {
          const existingListings = await localDb.listings.count();
          if (existingListings === 0) {
            await localDb.bulkCacheListings(ALL_SEEDED_LISTINGS);
          }
          const existingPosts = await localDb.posts.count();
          if (existingPosts === 0) {
            await localDb.bulkCachePosts(ALL_SEEDED_POSTS);
          }
        }
        setRefreshKey((k) => k + 1);
      } catch {
        // Ignorar en entornos sin IndexedDB
      }
    }
    void seedLocalCacheIfEmpty();

    const unsubDownlink = syncManager.subscribe('downlink_hydrated', () => {
      setRefreshKey((k) => k + 1);
    });
    const unsubOutbox = syncManager.subscribe('outbox_synced', () => {
      setRefreshKey((k) => k + 1);
    });

    return () => {
      unsubDownlink();
      unsubOutbox();
    };
  }, []);

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onOpenQuickPublish={handleOpenStandardPublish}
      onOpenSosPublish={handleOpenSosPublish}
      hasEmergency={hasEmergency}
    >
      <h1 className="sr-only">RedVecina · Economía Barrial y Soporte de Proximidad</h1>
      {/* PUNTO 5: Alerta fija en la parte superior de la app con la descripción de lo ocurrido y la ubicación */}
      {activeSosAlert && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="fixed-top-sos-alert"
          className="sticky top-0 z-30 mb-3.5 w-full max-w-full box-border overflow-hidden rounded-2xl bg-[#991B1B] text-[#FFFFFF] border-2 border-[#FDE047] p-3.5 shadow-xl"
        >
          {/* Fila superior: Icono + Insignia a la izquierda, botones "Ver mapa" y "X" alineados horizontalmente a la derecha */}
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-[#7F1D1D] border border-[#FDE047] flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-[#FDE047] animate-pulse" aria-hidden="true" />
              </div>
              <span className="inline-flex items-center text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#FDE047] text-[#450A0A] leading-tight truncate">
                🚨 Alerta SOS en tu barrio
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const focusTarget = {
                    lat: activeSosAlert.lat,
                    lng: activeSosAlert.lng,
                    timestamp: Date.now(),
                  };
                  setFocusedMapCoords(focusTarget);
                  setActiveTab('MAPA');
                  if (typeof window !== 'undefined') {
                    setTimeout(() => {
                      window.dispatchEvent(
                        new CustomEvent('redvecina_focus_map_coords', { detail: focusTarget })
                      );
                    }, 30);
                  }
                }}
                className="min-h-[48px] h-10 w-auto px-3 py-1.5 rounded-xl bg-[#FDE047] hover:bg-[#FEF08A] text-[#450A0A] text-xs font-black whitespace-nowrap shrink-0 inline-flex items-center justify-center transition-all cursor-pointer shadow-xs"
              >
                Ver mapa
              </button>
              <button
                type="button"
                onClick={handleDismissSosAlert}
                aria-label="Cerrar alerta SOS fija"
                className="min-h-[48px] min-w-[40px] w-10 h-10 rounded-xl bg-[#7F1D1D] hover:bg-[#450A0A] text-[#FFFFFF] border border-[#FCA5A5] shrink-0 inline-flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fila inferior: Descripción y ubicación ocupando el 100% del ancho disponible de la tarjeta */}
          <div className="mt-2.5 pt-2 border-t border-[#FCA5A5]/25 space-y-1.5 w-full">
            <p className="text-sm font-black text-[#FFFFFF] leading-snug break-words w-full">
              {activeSosAlert.description}
            </p>
            <p className="text-xs font-extrabold text-[#FEF08A] flex items-start gap-1.5 w-full break-words">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-[#FDE047] mt-0.5" aria-hidden="true" />
              <span>Ubicación: {activeSosAlert.locationLabel}</span>
            </p>
          </div>
        </div>
      )}

      <SwipeableNotification
        isOpen={Boolean(lastPublishedToast)}
        onDismiss={() => setLastPublishedToast(null)}
        variant="emerald"
        className="mb-3"
        showCloseButton={true}
        action={
          <button
            type="button"
            onClick={() => setLastPublishedToast(null)}
            className="min-h-[48px] h-12 px-3.5 rounded-xl border border-emerald-400/60 hover:bg-emerald-900/60 text-sm font-extrabold transition-colors"
          >
            Entendido
          </button>
        }
      >
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" strokeWidth={2} aria-hidden="true" />
          <span>Publicado en tu barrio: “{lastPublishedToast}”</span>
        </span>
      </SwipeableNotification>

      {/* Banner de Check-in Barrial ante Incidentes y Emergencias */}
      <IncidentCheckinBanner
        onOpenSosPublish={handleOpenSosPublish}
        className="mb-3.5"
      />

      {activeTab === 'DIRECTORIO' && (
        <ProximityCatalogView
          initialListings={ALL_SEEDED_LISTINGS}
          refreshKey={refreshKey}
          injectedListing={lastPublishedListing}
        />
      )}

      {activeTab === 'MAPA' && (
        <NeighborhoodMap
          initialListings={ALL_SEEDED_LISTINGS}
          initialPosts={ALL_SEEDED_POSTS}
          refreshKey={refreshKey}
          focusCoords={focusedMapCoords}
        />
      )}

      {activeTab === 'MURO' && (
        <SolidarityWallView
          initialPosts={ALL_SEEDED_POSTS}
          refreshKey={refreshKey}
          injectedPost={lastPublishedPost}
        />
      )}

      {activeTab === 'COPILOTO' && <CopilotView />}

      <OfflineEmergencyPrompt
        isOpen={showOfflinePrompt}
        onJustNoSignal={() => {
          setMode('HABITUAL');
          setShowOfflinePrompt(false);
        }}
        onNeedHelp={() => {
          setShowOfflinePrompt(false);
          handleOpenSosPublish();
        }}
      />

      <QuickPublishSheet
        isOpen={isPublishSheetOpen}
        initialSos={isSosPublish}
        onClose={() => {
          setIsPublishSheetOpen(false);
          setIsSosPublish(false);
        }}
        onPublished={(summary) => {
          setLastPublishedToast(summary.title);
          setRefreshKey((k) => k + 1);
          if (summary.is_sos) {
            setMode('EMERGENCIA');
            setActiveSosAlert({
              description: summary.description,
              locationLabel: summary.location_label,
              lat: summary.coords.lat,
              lng: summary.coords.lng,
              createdAt: new Date().toISOString(),
            });
          }
          if (summary.module === 'OFICIOS_PRODUCTOS') {
            if (summary.storedRecord) {
              setLastPublishedListing(summary.storedRecord);
            }
            setActiveTab('DIRECTORIO');
          } else {
            if (summary.storedRecord) {
              setLastPublishedPost(summary.storedRecord);
            }
            setActiveTab('MURO');
          }
        }}
      />
    </AppShell>
  );
}
