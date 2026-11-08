'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LocateFixed,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from '@/context/location-context';
import { useOperationalMode } from '@/context/mode-context';
import { getOrCreateDeviceId } from '@/lib/ownership';
import { calculateDistanceMeters } from '@/lib/geo-utils';
import type { GeocodedPlace } from '@/server/geocoder/types';
import type { NeighborhoodMeeting } from '@/server/meetings/types';
import {
  cancelMeeting,
  PRELOADED_MEETING_PLACES,
  readStoredMeetings,
  writeStoredMeetings,
  type PreloadedMeetingPlace,
} from '@/lib/meetings/meetings-client';

export interface MeetingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated?: (meeting: NeighborhoodMeeting) => void;
}

type ScheduledOption = 'AHORA' | 'HOY' | 'MANANA';

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*)/i;

export function MeetingSheet({
  isOpen,
  onClose,
  onMeetingCreated,
}: MeetingSheetProps): React.ReactElement | null {
  const { currentSector, userCoords, isRealLocationActive, realGpsCoords } = useLocation();
  const { activeRole } = useOperationalMode();

  const [activeTabMode, setActiveTabMode] = useState<'BUSCADOR' | 'MAPA_PIN' | 'TIPICOS'>('BUSCADOR');

  // Campo 1: Lugar seleccionado
  const [selectedPlace, setSelectedPlace] = useState<{
    name: string;
    lat: number;
    lng: number;
    display_name?: string;
    is_residential?: boolean;
  } | null>(null);

  // Buscador
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodedPlace[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Mini-mapa con pin movible
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>({
    lat: userCoords?.lat ?? -12.0528,
    lng: userCoords?.lng ?? -75.2155,
  });
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [reverseGeocodedName, setReverseGeocodedName] = useState<string>('');
  const miniMapRef = useRef<HTMLDivElement>(null);

  // Campo 2: Motivo (máx 140 chars)
  const [motive, setMotive] = useState<string>('');

  // Campo 3: Cuándo
  const [scheduledOption, setScheduledOption] = useState<ScheduledOption>('AHORA');
  const [selectedHour, setSelectedHour] = useState<string>('18:00');

  // Campo 4: Referencia (opcional, máx 80 chars)
  const [referenceNote, setReferenceNote] = useState<string>('');

  // Errores y estado de envío
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [userOriginCoords, setUserOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Referencia a coordenadas activas del brigadista
  const effectiveUserLat = isRealLocationActive
    ? (realGpsCoords?.lat ?? userCoords?.lat ?? -12.0528)
    : (userCoords?.lat ?? currentSector?.centerLat ?? -12.0528);
  const effectiveUserLng = isRealLocationActive
    ? (realGpsCoords?.lng ?? userCoords?.lng ?? -75.2155)
    : (userCoords?.lng ?? currentSector?.centerLng ?? -75.2155);

  useEffect(() => {
    if (isOpen) {
      setPinCoords({ lat: effectiveUserLat, lng: effectiveUserLng });
      setFormError(null);
    }
  }, [isOpen, effectiveUserLat, effectiveUserLng]);

  // Tecla Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 1. Ejecutar búsqueda en Nominatim (disparada al pulsar "Buscar" o Enter, sin autocompletado en tecleo)
  const handlePerformSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchError('Ingresa al menos 2 letras para buscar un lugar.');
      return;
    }
    setSearchError(null);
    setIsSearching(true);

    try {
      const res = await fetch(`/api/v1/geocoder/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok || !json.data?.places) {
        setSearchError('No se encontraron resultados para ese lugar.');
        setSearchResults([]);
      } else {
        const places = json.data.places as GeocodedPlace[];
        setSearchResults(places);
        if (places.length === 0) {
          setSearchError('No encontramos ese punto. Prueba marcarlo con el pin en el mapa.');
        }
      }
    } catch {
      setSearchError('Sin conexión. Puedes elegir un lugar típico o marcar el pin en el mapa.');
    } finally {
      setIsSearching(false);
    }
  };

  // 2. Seleccionar resultado de búsqueda
  const handleSelectSearchResult = (place: GeocodedPlace) => {
    setSelectedPlace({
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      display_name: place.display_name,
      is_residential: place.is_residential,
    });
    setFormError(null);
  };

  // 3. Seleccionar lugar típico offline
  const handleSelectPreloadedPlace = (place: PreloadedMeetingPlace) => {
    setSelectedPlace({
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      display_name: place.reference,
      is_residential: false,
    });
    setReferenceNote(place.reference);
    setFormError(null);
  };

  // 4. Mover pin en el mini-mapa y consultar dirección inversa
  const handleMiniMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!miniMapRef.current) return;
    const rect = miniMapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const zoom = 16;
    const n = Math.pow(2, zoom);
    const latRad = (pinCoords.lat * Math.PI) / 180;

    const deltaLng = ((clickX - centerX) / (256 * n)) * 360;
    const deltaLat = -((clickY - centerY) / (256 * n)) * 360 * Math.cos(latRad);

    const nextLat = Number((pinCoords.lat + deltaLat).toFixed(6));
    const nextLng = Number((pinCoords.lng + deltaLng).toFixed(6));

    setPinCoords({ lat: nextLat, lng: nextLng });

    // Geocodificación inversa para obtener el nombre de la calle más cercana
    setIsReverseGeocoding(true);
    try {
      const res = await fetch(`/api/v1/geocoder/reverse?lat=${nextLat}&lng=${nextLng}`);
      const json = await res.json();
      const place = json.data?.place as GeocodedPlace | undefined;
      const resolvedName = place?.name || `Punto en ${nextLat.toFixed(4)}, ${nextLng.toFixed(4)}`;
      setReverseGeocodedName(resolvedName);
      setSelectedPlace({
        name: resolvedName,
        lat: nextLat,
        lng: nextLng,
        display_name: place?.display_name,
        is_residential: place?.is_residential,
      });
      setFormError(null);
    } catch {
      const fallback = `Punto marcado (${nextLat.toFixed(4)}, ${nextLng.toFixed(4)})`;
      setReverseGeocodedName(fallback);
      setSelectedPlace({
        name: fallback,
        lat: nextLat,
        lng: nextLng,
        is_residential: false,
      });
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // 5. Usar mi ubicación actual como punto de reunión (Respuesta Inmediata)
  const handleUseCurrentLocation = async () => {
    setIsReverseGeocoding(true);

    // 1. Coordenadas inmediatas de alta disponibilidad
    const instantLat = realGpsCoords?.lat ?? userCoords?.lat ?? effectiveUserLat;
    const instantLng = realGpsCoords?.lng ?? userCoords?.lng ?? effectiveUserLng;
    let targetLat = instantLat;
    let targetLng = instantLng;

    // Actualizar de inmediato el pin, el mapa y el punto de origen del brigadista
    setPinCoords({ lat: targetLat, lng: targetLng });
    setUserOriginCoords({ lat: targetLat, lng: targetLng });

    // 2. Si el navegador puede aportar una lectura rápida, usarla con timeout ágil (máx 2s)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 2000,
            maximumAge: 60000,
          });
        });
        targetLat = Number(pos.coords.latitude.toFixed(6));
        targetLng = Number(pos.coords.longitude.toFixed(6));
        setPinCoords({ lat: targetLat, lng: targetLng });
        setUserOriginCoords({ lat: targetLat, lng: targetLng });
      } catch {
        // Mantiene las coordenadas instantáneas
      }
    }

    try {
      const res = await fetch(`/api/v1/geocoder/reverse?lat=${targetLat}&lng=${targetLng}`);
      const json = await res.json();
      const place = json.data?.place as GeocodedPlace | undefined;
      const resolvedName =
        place?.name || `Mi ubicación actual (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`;

      setReverseGeocodedName(resolvedName);
      setSelectedPlace({
        name: resolvedName,
        lat: targetLat,
        lng: targetLng,
        display_name: place?.display_name,
        is_residential: place?.is_residential,
      });
      setFormError(null);
      toast.success('Ubicación fijada en el mapa', {
        description: resolvedName,
      });
    } catch {
      const fallback = `Mi ubicación actual (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`;
      setReverseGeocodedName(fallback);
      setSelectedPlace({
        name: fallback,
        lat: targetLat,
        lng: targetLng,
        is_residential: false,
      });
      toast.info('Ubicación fijada en tus coordenadas actuales');
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Tiles de OpenStreetMap para el mini-mapa (Centrados exactamente en el pin 50%/50%)
  const miniMapTiles = useMemo(() => {
    const zoom = 16;
    const n = Math.pow(2, zoom);
    const latRad = (pinCoords.lat * Math.PI) / 180;
    const worldX = ((pinCoords.lng + 180) / 360) * n * 256;
    const worldY =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;

    const tileX = Math.floor(worldX / 256);
    const tileY = Math.floor(worldY / 256);
    const pixelOffsetX = Math.round(worldX % 256);
    const pixelOffsetY = Math.round(worldY % 256);

    const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        tiles.push({
          key: `meeting-mini-${zoom}-${tx}-${ty}`,
          url: `/api/v1/tiles/maptiler-omt?z=${zoom}&x=${tx}&y=${ty}`,
          left: dx * 256 - pixelOffsetX,
          top: dy * 256 - pixelOffsetY,
        });
      }
    }
    return tiles;
  }, [pinCoords.lat, pinCoords.lng]);

  const activeOriginLat = userOriginCoords?.lat ?? effectiveUserLat;
  const activeOriginLng = userOriginCoords?.lng ?? effectiveUserLng;

  // Cálculo de distancia al lugar seleccionado
  const distanceToPlace = useMemo(() => {
    if (!selectedPlace) return 0;
    // Si la ubicación seleccionada proviene de "Usar mi ubicación", la distancia es 0 metros
    if (
      userOriginCoords &&
      Math.abs(userOriginCoords.lat - selectedPlace.lat) < 0.0001 &&
      Math.abs(userOriginCoords.lng - selectedPlace.lng) < 0.0001
    ) {
      return 0;
    }
    return calculateDistanceMeters(
      activeOriginLat,
      activeOriginLng,
      selectedPlace.lat,
      selectedPlace.lng
    );
  }, [selectedPlace, activeOriginLat, activeOriginLng, userOriginCoords]);

  // Validación de formulario para habilitar el botón "Convocar junta"
  const isFormValid = useMemo(() => {
    if (!selectedPlace) return false;
    const trimmedMotive = motive.trim();
    if (trimmedMotive.length < 5 || trimmedMotive.length > 140) return false;
    if (URL_REGEX.test(trimmedMotive)) return false;
    if (distanceToPlace > 2000) return false;
    return true;
  }, [selectedPlace, motive, distanceToPlace]);

  // Formatear texto de hora
  const resolvedScheduledText = useMemo(() => {
    if (scheduledOption === 'AHORA') return 'Ahora (Convocatoria Inmediata)';
    if (scheduledOption === 'HOY') return `Hoy a las ${selectedHour}`;
    return `Mañana a las ${selectedHour}`;
  }, [scheduledOption, selectedHour]);

  // 5. Convocar Junta
  const handleConvocarJunta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !selectedPlace) return;

    setIsSubmitting(true);
    setFormError(null);

    const deviceId = getOrCreateDeviceId();
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('redvecina_brigadista_token') || 'BRIG-TOKEN-DEMO'
        : 'BRIG-TOKEN-DEMO';
    const verifiedName =
      typeof window !== 'undefined'
        ? localStorage.getItem('redvecina_verified_name') || 'Brigadista Barrial'
        : 'Brigadista Barrial';

    const payload = {
      device_id: deviceId,
      sector_id: currentSector?.id || 'huancayo-el-tambo',
      brigadista_name: verifiedName,
      brigadista_token: token,
      meeting_place_name: selectedPlace.name,
      meeting_lat: selectedPlace.lat,
      meeting_lng: selectedPlace.lng,
      user_lat: activeOriginLat,
      user_lng: activeOriginLng,
      motive: motive.trim(),
      scheduled_option: scheduledOption,
      scheduled_time: resolvedScheduledText,
      reference_note: referenceNote.trim() || undefined,
    };

    try {
      const res = await fetch('/api/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': activeRole,
          'x-device-id': deviceId,
          'x-brigadista-token': token,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.data?.meeting) {
        setFormError(json.error?.message || 'No se pudo convocar la junta.');
        setIsSubmitting(false);
        return;
      }

      const createdMeeting = json.data.meeting as NeighborhoodMeeting;

      // Guardar localmente
      const currentList = readStoredMeetings();
      writeStoredMeetings([createdMeeting, ...currentList]);

      onMeetingCreated?.(createdMeeting);
      onClose();

      // Aviso breve "Junta convocada" con botón "Deshacer" durante 5 segundos
      toast.success(
        `🏛️ Junta convocada: ${createdMeeting.meeting_place_name} · ${createdMeeting.scheduled_time}`,
        {
          description: `Motivo: ${createdMeeting.motive}`,
          duration: 5000,
          action: {
            label: 'Deshacer (5s)',
            onClick: () => {
              void cancelMeeting(createdMeeting.id);
              toast.info('Convocatoria deshecha', {
                description: 'La junta fue cancelada inmediatamente.',
              });
            },
          },
        }
      );
    } catch {
      // Fallback offline: registrar junta localmente para sincronizar en reconexión
      const fallbackMeeting: NeighborhoodMeeting = {
        id: `junta-offline-${Date.now()}`,
        sector_id: currentSector?.id || 'huancayo-el-tambo',
        brigadista_device_id: deviceId,
        brigadista_name: verifiedName,
        meeting_place_name: selectedPlace.name,
        meeting_lat: selectedPlace.lat,
        meeting_lng: selectedPlace.lng,
        motive: motive.trim(),
        scheduled_option: scheduledOption,
        scheduled_time: resolvedScheduledText,
        reference_note: referenceNote.trim() || undefined,
        status: 'ACTIVA',
        report_count: 0,
        reporting_devices: [],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const currentList = readStoredMeetings();
      writeStoredMeetings([fallbackMeeting, ...currentList]);
      onMeetingCreated?.(fallbackMeeting);
      onClose();

      toast.warning('Junta guardada localmente (Sin conexión)', {
        description: 'Se difundirá automáticamente al reconectar la red.',
        duration: 5000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            void cancelMeeting(fallbackMeeting.id);
          },
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-t-[32px] sm:rounded-[28px] bg-white dark:bg-[#0F172A] text-[#0B1E3F] dark:text-slate-100 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#0F2A56] text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5 text-amber-300 stroke-[2.2]" />
            </div>
            <div>
              <h2 id="meeting-sheet-title" className="text-base sm:text-lg font-black leading-tight">
                Convocar Junta Vecinal
              </h2>
              <p className="text-xs text-[#5B6068] dark:text-slate-400 font-medium">
                Exclusivo Brigadistas · Sector: {currentSector?.name || 'El Tambo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario de junta"
            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConvocarJunta} className="space-y-4">
          {/* CAMPO 1: LUGAR DE REUNIÓN (NO TEXTO LIBRE) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-[#0B1E3F] dark:text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#2F62D6]" />
                <span>1. Lugar de reunión (Obligatorio)</span>
              </label>
              {selectedPlace && (
                <span className="text-[11px] font-extrabold text-[#15795A] bg-[#E3F4EB] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ubicación válida</span>
                </span>
              )}
            </div>

            {/* Pestañas de Selección de Lugar */}
            <div className="flex items-center rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1 gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTabMode('BUSCADOR')}
                className={`flex-1 min-h-[48px] py-1.5 px-2 rounded-xl transition-all ${
                  activeTabMode === 'BUSCADOR'
                    ? 'bg-white dark:bg-slate-900 text-[#0F2A56] dark:text-white shadow-xs font-black'
                    : 'text-[#5B6068] hover:text-[#0B1E3F]'
                }`}
              >
                Buscar lugar
              </button>
              <button
                type="button"
                onClick={() => setActiveTabMode('MAPA_PIN')}
                className={`flex-1 min-h-[48px] py-1.5 px-2 rounded-xl transition-all ${
                  activeTabMode === 'MAPA_PIN'
                    ? 'bg-white dark:bg-slate-900 text-[#0F2A56] dark:text-white shadow-xs font-black'
                    : 'text-[#5B6068] hover:text-[#0B1E3F]'
                }`}
              >
                Marcar en el mapa
              </button>
              <button
                type="button"
                onClick={() => setActiveTabMode('TIPICOS')}
                className={`flex-1 min-h-[48px] py-1.5 px-2 rounded-xl transition-all ${
                  activeTabMode === 'TIPICOS'
                    ? 'bg-white dark:bg-slate-900 text-[#0F2A56] dark:text-white shadow-xs font-black'
                    : 'text-[#5B6068] hover:text-[#0B1E3F]'
                }`}
              >
                Lugares típicos
              </button>
            </div>

            {/* MODO A: Buscador (sin autocompletado en tecleo, se ejecuta al tocar "Buscar" o Enter) */}
            {activeTabMode === 'BUSCADOR' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handlePerformSearch();
                        }
                      }}
                      placeholder="Ej. Parque Bolognesi, Coliseo Wanka, etc."
                      className="w-full min-h-[48px] h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pl-4 pr-10 text-xs sm:text-sm font-semibold text-[#0B1E3F] dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#2F62D6]"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePerformSearch()}
                    disabled={isSearching}
                    className="min-h-[48px] h-12 px-4 rounded-2xl bg-[#0F2A56] hover:bg-[#0B1E3F] text-white font-extrabold text-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isSearching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>

                {searchError && (
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {searchError}
                  </p>
                )}

                {/* Lista de Resultados (Debe tocar uno para elegirlo) */}
                {searchResults.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 max-h-44 overflow-y-auto shadow-xs">
                    {searchResults.map((place) => (
                      <button
                        key={place.place_id}
                        type="button"
                        onClick={() => handleSelectSearchResult(place)}
                        className={`w-full text-left p-3 text-xs flex items-start gap-2.5 transition-colors cursor-pointer ${
                          selectedPlace?.lat === place.lat && selectedPlace?.lng === place.lng
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-[#0F2A56] dark:text-sky-200 font-extrabold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-[#0B1E3F] dark:text-slate-200 font-medium'
                        }`}
                      >
                        <MapPin className="w-4 h-4 text-[#2F62D6] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{place.name}</p>
                          <p className="text-[11px] text-[#5B6068] dark:text-slate-400 truncate">
                            {place.display_name}
                          </p>
                        </div>
                      </button>
                    ))}
                    <div className="p-2 text-[10px] text-slate-400 text-center select-none">
                      © OpenStreetMap · Datos geográficos públicos
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODO B: Marcar en el mapa con pin movible */}
            {activeTabMode === 'MAPA_PIN' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-[#5B6068] dark:text-slate-400 font-medium min-w-0">
                    Toca el mapa para mover el pin o usa tu ubicación actual:
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleUseCurrentLocation()}
                    className="min-h-[48px] px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[#0F2A56] dark:text-sky-300 border border-[#0F2A56]/20 font-black text-xs inline-flex items-center gap-1.5 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
                    title="Fijar punto en mi ubicación actual"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-[#2F62D6]" />
                    <span>Usar mi ubicación</span>
                  </button>
                </div>
                <div
                  ref={miniMapRef}
                  onClick={handleMiniMapClick}
                  className="relative h-44 w-full rounded-2xl overflow-hidden border-2 border-slate-300 dark:border-slate-700 bg-slate-200 cursor-crosshair shadow-inner"
                  title="Haz clic para posicionar el punto de reunión"
                >
                  {/* Botón flotante para usar ubicación directa dentro del mapa */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleUseCurrentLocation();
                    }}
                    title="Usar mi ubicación actual"
                    aria-label="Usar mi ubicación actual"
                    className="absolute top-2.5 right-2.5 z-20 min-h-[48px] px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 hover:bg-white text-[#0F2A56] dark:text-sky-300 border border-slate-300 dark:border-slate-700 shadow-md text-xs font-black flex items-center gap-1.5 backdrop-blur-sm cursor-pointer active:scale-95 transition-all"
                  >
                    <LocateFixed className="w-4 h-4 text-[#2F62D6]" />
                    <span className="text-[11px] font-extrabold">Usar ubicación</span>
                  </button>

                  {/* Tiles cartográficos centrados matemáticamente en 50% */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {miniMapTiles.map((t) => (
                      <img
                        key={t.key}
                        src={t.url}
                        alt=""
                        loading="eager"
                        decoding="async"
                        className="absolute w-64 h-64 select-none pointer-events-none"
                        style={{
                          left: `calc(50% + ${t.left}px)`,
                          top: `calc(50% + ${t.top}px)`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Pin central interactivo */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10 flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-[#0F2A56] border-2 border-white shadow-md flex items-center justify-center text-amber-300 animate-bounce">
                      <Users className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className="w-2 h-2 rounded-full bg-slate-900/60 shadow-xs" />
                  </div>

                  <div className="absolute bottom-1 right-2 bg-white/80 dark:bg-black/80 px-2 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-300">
                    © OpenStreetMap
                  </div>
                </div>

                {isReverseGeocoding && (
                  <p className="text-xs text-[#2F62D6] font-bold">
                    Identificando calle y barrio...
                  </p>
                )}
                {reverseGeocodedName && !isReverseGeocoding && (
                  <p className="text-xs text-[#15795A] font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Calle detectada: {reverseGeocodedName}</span>
                  </p>
                )}
              </div>
            )}

            {/* MODO C: Lugares típicos precargados offline */}
            {activeTabMode === 'TIPICOS' && (
              <div className="space-y-2">
                <p className="text-xs text-[#5B6068] dark:text-slate-400 font-medium">
                  Lugares públicos conocidos de la zona (disponibles 100% sin internet):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                  {PRELOADED_MEETING_PLACES.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => handleSelectPreloadedPlace(place)}
                      className={`min-h-[48px] text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                        selectedPlace?.name === place.name
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-[#2F62D6] text-[#0F2A56] dark:text-sky-200 font-bold'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-[#0B1E3F] dark:text-slate-200'
                      }`}
                    >
                      <p className="font-extrabold truncate">{place.name}</p>
                      <p className="text-[10px] text-[#5B6068] dark:text-slate-400 truncate">
                        {place.reference}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Visualización del lugar elegido */}
            {selectedPlace && (
              <div className="p-3 rounded-2xl bg-[#F4F5F7] dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <p className="text-xs font-black text-[#0B1E3F] dark:text-white flex items-center justify-between">
                  <span>📍 Lugar: {selectedPlace.name}</span>
                  <span className="text-[11px] font-bold text-[#5B6068] dark:text-slate-400">
                    a {distanceToPlace} m de ti
                  </span>
                </p>
                {selectedPlace.display_name && (
                  <p className="text-[11px] text-[#5B6068] dark:text-slate-400 truncate">
                    {selectedPlace.display_name}
                  </p>
                )}

                {/* Aviso suave si parece vivienda */}
                {selectedPlace.is_residential && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-bold pt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Aviso: Este lugar parece una vivienda. Recuerda preferir un parque, plaza o local comunal público.
                    </span>
                  </div>
                )}
                {!selectedPlace.is_residential && (
                  <p className="text-[11px] text-[#5B6068] dark:text-slate-400 italic">
                    Elige un lugar público: parque, plaza o local comunal.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* CAMPO 2: MOTIVO DE LA REUNIÓN (Máx. 140 chars) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="meeting-motive-input"
                className="text-xs font-black uppercase tracking-wider text-[#0B1E3F] dark:text-white"
              >
                2. Motivo de la reunión (Obligatorio)
              </label>
              <span
                className={`text-[11px] font-bold ${
                  motive.length > 140
                    ? 'text-red-600 font-black'
                    : motive.length >= 120
                    ? 'text-amber-600'
                    : 'text-[#5B6068]'
                }`}
              >
                {motive.length} / 140
              </span>
            </div>
            <textarea
              id="meeting-motive-input"
              rows={2}
              maxLength={140}
              value={motive}
              onChange={(e) => {
                setMotive(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Ej. Coordinación de rondas vecinales y acopio de víveres tras corte de energía"
              className="w-full p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs sm:text-sm font-semibold text-[#0B1E3F] dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#2F62D6] resize-none"
            />
          </div>

          {/* CAMPO 3: ¿CUÁNDO? (Ahora, Hoy a las..., Mañana a las...) */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-[#0B1E3F] dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#2F62D6]" />
              <span>3. ¿Cuándo? (Obligatorio)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScheduledOption('AHORA')}
                className={`min-h-[48px] py-2 px-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  scheduledOption === 'AHORA'
                    ? 'bg-[#0F2A56] text-white border-[#0F2A56] shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 text-[#0B1E3F] dark:text-slate-300'
                }`}
              >
                Ahora mismo
              </button>
              <button
                type="button"
                onClick={() => setScheduledOption('HOY')}
                className={`min-h-[48px] py-2 px-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  scheduledOption === 'HOY'
                    ? 'bg-[#0F2A56] text-white border-[#0F2A56] shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 text-[#0B1E3F] dark:text-slate-300'
                }`}
              >
                Hoy a las…
              </button>
              <button
                type="button"
                onClick={() => setScheduledOption('MANANA')}
                className={`min-h-[48px] py-2 px-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  scheduledOption === 'MANANA'
                    ? 'bg-[#0F2A56] text-white border-[#0F2A56] shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 text-[#0B1E3F] dark:text-slate-300'
                }`}
              >
                Mañana a las…
              </button>
            </div>

            {scheduledOption !== 'AHORA' && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-bold text-[#5B6068]">Hora programada:</span>
                <input
                  type="time"
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(e.target.value)}
                  className="min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-[#0B1E3F] dark:text-white"
                />
              </div>
            )}
          </div>

          {/* CAMPO OPCIONAL: REFERENCIA (Máx. 80 chars) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="meeting-ref-input"
                className="text-xs font-bold text-[#5B6068] dark:text-slate-400"
              >
                Referencia (Opcional)
              </label>
              <span className="text-[11px] text-slate-400">{referenceNote.length} / 80</span>
            </div>
            <input
              id="meeting-ref-input"
              type="text"
              maxLength={80}
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
              placeholder="Ej. Frente a la farmacia, junto a la banca central"
              className="w-full min-h-[44px] h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 text-xs font-medium text-[#0B1E3F] dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#2F62D6]"
            />
          </div>

          {/* Mensaje de Error */}
          {formError && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] h-12 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[#0B1E3F] dark:text-slate-300 font-extrabold text-xs active:scale-95 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="flex-1 min-h-[48px] h-12 rounded-full bg-[#0F2A56] hover:bg-[#0B1E3F] active:scale-95 text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <Users className="w-4 h-4 text-amber-300" />
              <span>{isSubmitting ? 'Convocando...' : 'Convocar junta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MeetingSheet;
