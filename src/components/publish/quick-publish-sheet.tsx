'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Crosshair,
  HeartHandshake,
  MapPin,
  Mic,
  MicOff,
  Package,
  Phone,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { NeighborIntent } from '@shared/schemas';
import type { UrgencyLevel } from '@shared/types';
import { useOperationalMode } from '@/context/mode-context';
import { useLocation } from '@/context/location-context';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import {
  fetchReverseGeocodeZone,
  resolveApproximateZoneLabel,
} from '@/lib/geo-utils';
import type { RedVecinaLocalDB } from '@/lib/offline/db';
import { syncManager } from '@/lib/offline/sync-manager';
import { getOrCreateDeviceId, registerOwnPublication } from '@/lib/ownership';
import {
  broadcastRealtimePublication,
  broadcastRealtimeSos,
} from '@/lib/realtime/sos-realtime';
import { executeQuickPublishPersist } from './quick-publish-modal';

export interface QuickPublishSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (summary: {
    client_mutation_id: string;
    module: NeighborIntent['module'];
    post_type?: NeighborIntent['post_type'];
    is_sos?: boolean;
    title: string;
    description: string;
    location_label: string;
    coords: { lat: number; lng: number };
    photo_url?: string;
    storedRecord?: any;
  }) => void;
  customDb?: RedVecinaLocalDB;
  initialSos?: boolean;
}

const DEFAULT_SECTOR_LAT = -12.07679;
const DEFAULT_SECTOR_LNG = -75.21735;
const PERU_CELL_REGEX = /^9\d{8}$/;

type PostCategoryTab = 'OFICIO' | 'PRODUCTO' | 'FAVOR' | 'SOS';

interface FormFieldErrors {
  authorName?: string;
  titleText?: string;
  inputText?: string;
  location?: string;
  contactPhone?: string;
}

/**
 * Envía una notificación push local (Web Notification API + BroadcastChannel)
 * a los vecinos cercanos cuando se publica una emergencia SOS.
 */
function dispatchSosPushNotification(payload: {
  description: string;
  locationLabel: string;
  lat: number;
  lng: number;
  createdAt: string;
}): void {
  if (typeof window === 'undefined') return;

  // 1. Persistir alerta SOS activa y notificar a otras pestañas/componentes
  try {
    localStorage.setItem('redvecina_active_sos_alert', JSON.stringify(payload));
    window.dispatchEvent(
      new CustomEvent('redvecina_sos_alert_dispatched', { detail: payload })
    );
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('redvecina_sos_channel');
      channel.postMessage({ type: 'SOS_EMERGENCY', payload });
      channel.close();
    }
  } catch {
    // Ignorar errores de almacenamiento
  }

  // 2. Web Notification API (Push al dispositivo)
  if ('Notification' in window) {
    const showNotification = () => {
      try {
        new Notification('🚨 Emergencia SOS en tu barrio', {
          body: `${payload.description}\n📍 Ubicación: ${payload.locationLabel}`,
          tag: 'redvecina-sos-push',
          requireInteraction: true,
        });
      } catch {
        // Algunos navegadores móviles requieren ServiceWorkerRegistration
      }
    };

    if (Notification.permission === 'granted') {
      showNotification();
    } else if (Notification.permission !== 'denied') {
      void Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          showNotification();
        }
      });
    }
  }
}

/**
 * QuickPublishSheet - Nuevo flujo de publicar (Puntos 4 y 5):
 * - En "¿Qué deseas compartir hoy?", cada opción abre un formulario corto y específico.
 * - Eliminados: "Asuntos más frecuentes", "Nivel de prioridad asignado" y bloques extra.
 * - Campos estrictos por tipo:
 *   - Oficio: Nombre, Título, Descripción, Ubicación, Foto (opcional)
 *   - Producto: Nombre, Título, Descripción, Ubicación, Número de contacto, Foto (opcional)
 *   - Favor solidario: Nombre, Título, Descripción, Ubicación, Número de contacto, Foto (opcional)
 *   - SOS: Solo "¿Qué sucedió?" (descripción). Ubicación automática por GPS / última conocida del perfil.
 * - Validación antes de enviar con errores debajo de cada campo.
 * - Autocompletado de Nombre con el del perfil del usuario (editable).
 * - Botón principal único: "Publicar".
 */
export function QuickPublishSheet({
  isOpen,
  onClose,
  onPublished,
  customDb,
  initialSos = false,
}: QuickPublishSheetProps): React.ReactElement | null {
  const { mode, setMode } = useOperationalMode();
  const { userCoords, realGpsCoords, currentSector, isRealLocationActive } = useLocation();
  const {
    isListening,
    transcript,
    statusMessage,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceRecognition();

  const [activeCategory, setActiveCategory] = useState<PostCategoryTab>(
    initialSos ? 'SOS' : 'OFICIO'
  );
  const [authorName, setAuthorName] = useState<string>('');
  const [titleText, setTitleText] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Ubicación inicial: si está en "Mi Ubicación (GPS Real)" usa el GPS real; si cambió de sector, usa el sector simulado
  const defaultLat = isRealLocationActive
    ? (realGpsCoords?.lat ?? userCoords?.lat ?? currentSector?.centerLat ?? DEFAULT_SECTOR_LAT)
    : (currentSector?.centerLat ?? userCoords?.lat ?? DEFAULT_SECTOR_LAT);
  const defaultLng = isRealLocationActive
    ? (realGpsCoords?.lng ?? userCoords?.lng ?? currentSector?.centerLng ?? DEFAULT_SECTOR_LNG)
    : (currentSector?.centerLng ?? userCoords?.lng ?? DEFAULT_SECTOR_LNG);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const miniMapRef = useRef<HTMLDivElement>(null);

  // Foto opcional y vista previa
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [attachedPhotoName, setAttachedPhotoName] = useState<string | null>(null);

  // Animación de salida
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  }, [onClose]);

  // Autocompletar Nombre y última ubicación conocida desde el perfil del usuario al abrir
  const syncProfileDefaults = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const verifiedName = localStorage.getItem('redvecina_verified_name') ?? '';
      const savedPhone = localStorage.getItem('redvecina_phone') ?? '';
      const rawProfile = localStorage.getItem('redvecina_user_profile');
      let profileName = verifiedName;
      let profilePhone = savedPhone;
      let lastKnownLat: number | undefined;
      let lastKnownLng: number | undefined;

      if (rawProfile) {
        try {
          const parsed = JSON.parse(rawProfile);
          if (!profileName && typeof parsed.nombre_completo === 'string') {
            profileName = parsed.nombre_completo;
          }
          if (!profilePhone && typeof parsed.celular === 'string') {
            profilePhone = parsed.celular;
          }
          if (typeof parsed.last_lat === 'number' && typeof parsed.last_lng === 'number') {
            lastKnownLat = parsed.last_lat;
            lastKnownLng = parsed.last_lng;
          }
        } catch {
          // Ignorar JSON malformado
        }
      }

      if (profileName) {
        setAuthorName((prev) => (prev.trim().length > 0 ? prev : profileName));
      }
      if (profilePhone && PERU_CELL_REGEX.test(profilePhone)) {
        setContactPhone((prev) => (prev.trim().length > 0 ? prev : profilePhone));
      }
      if (!isRealLocationActive && currentSector) {
        setCoords({ lat: currentSector.centerLat, lng: currentSector.centerLng });
      } else if (lastKnownLat !== undefined && lastKnownLng !== undefined) {
        setCoords({ lat: lastKnownLat, lng: lastKnownLng });
      }
    } catch {
      // Ignorar en SSR
    }
  }, [isRealLocationActive, currentSector]);

  useEffect(() => {
    if (isOpen) {
      syncProfileDefaults();
      setFieldErrors({});
      if (initialSos) {
        setActiveCategory('SOS');
      }
    }
  }, [isOpen, initialSos, syncProfileDefaults]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleIdentityUpdated = () => syncProfileDefaults();
    window.addEventListener('redvecina_identity_updated', handleIdentityUpdated);
    return () => {
      window.removeEventListener('redvecina_identity_updated', handleIdentityUpdated);
    };
  }, [syncProfileDefaults]);

  // Tecla Escape y bloqueo de scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleAnimatedClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleAnimatedClose]);

  // Transcripción de voz
  useEffect(() => {
    if (transcript.trim().length > 0) {
      setInputText(transcript);
      setFieldErrors((prev) => ({ ...prev, inputText: undefined }));
    }
  }, [transcript]);

  // Sincronizar ubicación al abrir:
  // - Si está en un sector simulado (!isRealLocationActive), ignorar el GPS real y poner las coordenadas del sector.
  // - Si está en "Mi Ubicación (GPS Real)" (isRealLocationActive), usar el GPS real del dispositivo.
  useEffect(() => {
    if (!isOpen) return;

    if (!isRealLocationActive) {
      if (currentSector && Number.isFinite(currentSector.centerLat) && Number.isFinite(currentSector.centerLng)) {
        setCoords({ lat: currentSector.centerLat, lng: currentSector.centerLng });
      } else if (userCoords && Number.isFinite(userCoords.lat) && Number.isFinite(userCoords.lng)) {
        setCoords({ lat: userCoords.lat, lng: userCoords.lng });
      }
      return;
    }

    if (realGpsCoords && Number.isFinite(realGpsCoords.lat) && Number.isFinite(realGpsCoords.lng)) {
      setCoords({ lat: realGpsCoords.lat, lng: realGpsCoords.lng });
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      const saveRealPos = (pos: GeolocationPosition) => {
        const nextLat = Number(pos.coords.latitude.toFixed(6));
        const nextLng = Number(pos.coords.longitude.toFixed(6));
        setCoords({ lat: nextLat, lng: nextLng });
        try {
          const rawProfile = localStorage.getItem('redvecina_user_profile');
          const parsed = rawProfile ? JSON.parse(rawProfile) : {};
          localStorage.setItem(
            'redvecina_user_profile',
            JSON.stringify({ ...parsed, last_lat: nextLat, last_lng: nextLng })
          );
        } catch {
          // Ignorar
        }
      };

      navigator.geolocation.getCurrentPosition(
        saveRealPos,
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );

      navigator.geolocation.getCurrentPosition(
        saveRealPos,
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }, [isOpen, isRealLocationActive, currentSector, userCoords, realGpsCoords]);

  // Acción para recentrar en GPS actual (Respuesta instantánea)
  const handleLocateCurrentGps = useCallback(() => {
    // 1. Si ya tenemos coordenadas conocidas (GPS real o del contexto), aplicarlas en 0ms
    const instant = realGpsCoords ?? userCoords;
    if (instant && Number.isFinite(instant.lat) && Number.isFinite(instant.lng)) {
      setCoords({ lat: instant.lat, lng: instant.lng });
      setFieldErrors((prev) => ({ ...prev, location: undefined }));
      toast.success('Ubicación confirmada', {
        description: `Lat: ${instant.lat.toFixed(4)}, Lng: ${instant.lng.toFixed(4)}`,
      });
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      if (!instant) {
        toast.error('Tu navegador no soporta geolocalización GPS');
      }
      return;
    }

    setIsLocatingGps(true);
    const applyGps = (pos: GeolocationPosition) => {
      setIsLocatingGps(false);
      const nextLat = Number(pos.coords.latitude.toFixed(6));
      const nextLng = Number(pos.coords.longitude.toFixed(6));
      setCoords({ lat: nextLat, lng: nextLng });
      setFieldErrors((prev) => ({ ...prev, location: undefined }));
      toast.success('Ubicación GPS confirmada', {
        description: `Lat: ${nextLat}, Lng: ${nextLng}`,
      });
    };

    // Lectura ágil de geolocalización (usar caché reciente sin encender satélite frío)
    navigator.geolocation.getCurrentPosition(
      applyGps,
      () => {
        navigator.geolocation.getCurrentPosition(
          applyGps,
          () => {
            setIsLocatingGps(false);
            if (instant) {
              setCoords(instant);
            } else {
              toast.warning('No se pudo acceder al GPS, usando ubicación predeterminada');
            }
          },
          { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 60000 }
    );
  }, [realGpsCoords, userCoords]);

  // Clic en el mini-mapa para ajustar posición
  const handleMiniMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!miniMapRef.current) return;
    const rect = miniMapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const zoom = 16;
    const n = Math.pow(2, zoom);
    const latRad = (coords.lat * Math.PI) / 180;

    const deltaLng = ((clickX - centerX) / (256 * n)) * 360;
    const deltaLat = -((clickY - centerY) / (256 * n)) * 360 * Math.cos(latRad);

    const nextLat = Number((coords.lat + deltaLat).toFixed(6));
    const nextLng = Number((coords.lng + deltaLng).toFixed(6));

    setCoords({ lat: nextLat, lng: nextLng });
    setFieldErrors((prev) => ({ ...prev, location: undefined }));
  };

  // Cálculo de los mosaicos de OpenStreetMap para el mini-mapa
  const MINI_TILE_SIZE = 256;
  const miniMapTileData = useMemo(() => {
    const zoom = 16;
    const n = Math.pow(2, zoom);
    const latRad = (coords.lat * Math.PI) / 180;
    const worldX = ((coords.lng + 180) / 360) * n * MINI_TILE_SIZE;
    const worldY =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * MINI_TILE_SIZE;

    const tileX = Math.floor(worldX / MINI_TILE_SIZE);
    const tileY = Math.floor(worldY / MINI_TILE_SIZE);
    const pixelOffsetX = worldX % MINI_TILE_SIZE;
    const pixelOffsetY = worldY % MINI_TILE_SIZE;

    const tiles: Array<{
      key: string;
      url: string;
      left: number;
      top: number;
    }> = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        const left = dx * MINI_TILE_SIZE - pixelOffsetX;
        const top = dy * MINI_TILE_SIZE - pixelOffsetY;
        tiles.push({
          key: `mini-maptiler-omt-${zoom}-${tx}-${ty}`,
          url: `/api/v1/tiles/maptiler-omt?z=${zoom}&x=${tx}&y=${ty}`,
          left,
          top,
        });
      }
    }
    return { tiles };
  }, [coords.lat, coords.lng]);

  const handleSelectCategory = (cat: PostCategoryTab) => {
    setActiveCategory(cat);
    setFieldErrors({});
  };

  // Manejo de carga de fotos con vista previa inmediata
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La foto no debe superar 5MB');
        return;
      }
      setAttachedPhotoName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPhotoPreview(base64);
        toast.success('Foto cargada con vista previa', {
          description: file.name,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setAttachedPhotoName(null);
  };

  // Validar campos según el tipo de formulario seleccionado y retornar errores por campo
  const validateForm = useCallback((): FormFieldErrors => {
    const errors: FormFieldErrors = {};

    if (activeCategory === 'SOS') {
      // SOS solo tiene el campo "¿Qué sucedió?" (descripción)
      if (inputText.trim().length < 5) {
        errors.inputText = 'Por favor describe qué sucedió (mínimo 5 caracteres).';
      }
      return errors;
    }

    // Oficio, Producto y Favor solidario requieren: Nombre, Título, Descripción y Ubicación
    if (authorName.trim().length < 2) {
      errors.authorName = 'Ingresa tu nombre (mínimo 2 caracteres).';
    }

    if (titleText.trim().length < 5) {
      errors.titleText = 'Ingresa un título claro (mínimo 5 caracteres).';
    }

    if (inputText.trim().length < 10) {
      errors.inputText = 'Ingresa una descripción detallada (mínimo 10 caracteres).';
    }

    if (
      !Number.isFinite(coords.lat) ||
      !Number.isFinite(coords.lng) ||
      coords.lat < -90 ||
      coords.lat > 90 ||
      coords.lng < -180 ||
      coords.lng > 180
    ) {
      errors.location = 'Selecciona una ubicación válida en el mapa.';
    }

    // Producto y Favor solidario requieren Número de contacto (9 dígitos peruanos que empiecen con 9)
    if (activeCategory === 'PRODUCTO' || activeCategory === 'FAVOR') {
      const cleanPhone = contactPhone.replace(/\D/g, '');
      if (!PERU_CELL_REGEX.test(cleanPhone)) {
        errors.contactPhone =
          'Ingresa un número de contacto válido (9 dígitos que empiecen con 9).';
      }
    }

    return errors;
  }, [activeCategory, authorName, titleText, inputText, coords.lat, coords.lng, contactPhone]);

  // Resolver ubicación automática para SOS:
  // - Si el usuario cambió a un sector simulado (!isRealLocationActive), ignorar el GPS físico y usar el sector simulado.
  // - Si está en "Mi Ubicación (GPS Real)" (isRealLocationActive), usar el GPS físico del dispositivo.
  const resolveAutomaticSosCoordinates = useCallback(async (): Promise<{
    lat: number;
    lng: number;
  }> => {
    if (!isRealLocationActive) {
      return {
        lat: currentSector?.centerLat ?? userCoords?.lat ?? coords.lat ?? DEFAULT_SECTOR_LAT,
        lng: currentSector?.centerLng ?? userCoords?.lng ?? coords.lng ?? DEFAULT_SECTOR_LNG,
      };
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            () => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 60000,
              });
            },
            {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 30000,
            }
          );
        });
        return {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
      } catch {
        // Fallback a la última ubicación GPS real conocida
      }
    }

    if (realGpsCoords && Number.isFinite(realGpsCoords.lat) && Number.isFinite(realGpsCoords.lng)) {
      return { lat: realGpsCoords.lat, lng: realGpsCoords.lng };
    }

    if (typeof window !== 'undefined') {
      try {
        const rawProfile = localStorage.getItem('redvecina_user_profile');
        if (rawProfile) {
          const parsed = JSON.parse(rawProfile);
          if (typeof parsed.last_lat === 'number' && typeof parsed.last_lng === 'number') {
            return { lat: parsed.last_lat, lng: parsed.last_lng };
          }
        }
      } catch {
        // Ignorar
      }
    }

    return {
      lat: userCoords?.lat ?? coords.lat ?? DEFAULT_SECTOR_LAT,
      lng: userCoords?.lng ?? coords.lng ?? DEFAULT_SECTOR_LNG,
    };
  }, [isRealLocationActive, currentSector?.centerLat, currentSector?.centerLng, realGpsCoords, coords.lat, coords.lng, userCoords?.lat, userCoords?.lng]);

  // Enviar formulario ("Publicar")
  const handlePublish = useCallback(async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    if (isListening) {
      stopListening();
    }

    setIsPublishing(true);

    try {
      const isSos = activeCategory === 'SOS';

      // Para SOS la ubicación se toma automáticamente del GPS o última conocida del perfil
      const targetCoords = isSos ? await resolveAutomaticSosCoordinates() : coords;

      const rawDescription = inputText.trim();
      // Garantizar mínimo 10 caracteres requeridos por el esquema backend si el texto SOS es muy breve
      const textToPublish =
        rawDescription.length >= 10
          ? rawDescription
          : `Emergencia SOS: ${rawDescription}`;

      const rawAuthor = authorName.trim();
      let finalTitle = '';

      if (isSos) {
        finalTitle = `🚨 SOS: ${rawDescription}`.slice(0, 80);
        if (finalTitle.length < 5) {
          finalTitle = '🚨 Alerta SOS Vecinal';
        }
      } else {
        const cleanTitle = titleText.trim();
        finalTitle =
          rawAuthor && !cleanTitle.toLowerCase().includes(rawAuthor.toLowerCase())
            ? `${rawAuthor} · ${cleanTitle}`.slice(0, 80)
            : cleanTitle.slice(0, 80);
      }

      let targetModule: NeighborIntent['module'] = 'CADENA_FAVORES';
      let targetType: NeighborIntent['post_type'] = 'OFERTA_FAVOR';
      let urgency: UrgencyLevel = 'MEDIA';
      let hasMonetary = false;
      let zeroMoney = true;

      if (activeCategory === 'OFICIO') {
        targetModule = 'OFICIOS_PRODUCTOS';
        targetType = 'SERVICIO_OFICIO';
        urgency = 'BAJA';
        hasMonetary = true;
        zeroMoney = false;
      } else if (activeCategory === 'PRODUCTO') {
        targetModule = 'OFICIOS_PRODUCTOS';
        targetType = 'PRODUCTO_LOCAL';
        urgency = 'BAJA';
        hasMonetary = true;
        zeroMoney = false;
      } else if (activeCategory === 'SOS') {
        targetModule = 'CADENA_FAVORES';
        targetType = 'SOS_VULNERABLE';
        urgency = 'CRITICA';
        hasMonetary = false;
        zeroMoney = true;
      } else {
        targetModule = 'CADENA_FAVORES';
        targetType = 'OFERTA_FAVOR';
        urgency = 'MEDIA';
        hasMonetary = false;
        zeroMoney = true;
      }

      const resolvedCategory =
        activeCategory === 'OFICIO'
          ? 'Oficio'
          : activeCategory === 'PRODUCTO'
          ? 'Producto'
          : activeCategory === 'SOS'
          ? 'Emergencia'
          : 'Favor solidario';

      // Para Oficio (que no pide teléfono en el formulario), usar el celular del perfil del usuario o fallback válido
      const savedProfilePhone =
        typeof window !== 'undefined' ? localStorage.getItem('redvecina_phone') ?? '' : '';
      const resolvedPhone =
        activeCategory === 'PRODUCTO' || activeCategory === 'FAVOR'
          ? contactPhone.replace(/\D/g, '')
          : PERU_CELL_REGEX.test(savedProfilePhone)
          ? savedProfilePhone
          : '987654321';

      const intentToPublish: NeighborIntent = {
        module: targetModule,
        post_type: targetType,
        title: finalTitle,
        description: textToPublish,
        category: resolvedCategory,
        urgency,
        has_monetary_intent: hasMonetary,
        zero_money_compliant: zeroMoney,
        is_pii_redacted: isSos,
      };

      const res = await executeQuickPublishPersist({
        intent: intentToPublish,
        latitude: targetCoords.lat,
        longitude: targetCoords.lng,
        contactPhone: resolvedPhone,
        operationalMode: isSos ? 'EMERGENCIA' : 'HABITUAL',
        photoUrl: isSos ? undefined : photoPreview ?? undefined,
        db: customDb,
      });

      const myDeviceId = getOrCreateDeviceId();

      registerOwnPublication({
        clientMutationId: res.client_mutation_id,
        title: intentToPublish.title,
        authorName: rawAuthor,
      });

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(isSos ? [150, 80, 150] : 80);
      }

      void fetchReverseGeocodeZone(targetCoords.lat, targetCoords.lng);
      const resolvedZoneName = resolveApproximateZoneLabel(
        targetCoords.lat,
        targetCoords.lng,
        intentToPublish.title,
        rawDescription
      );
      const locationLabel = `${resolvedZoneName} (Lat ${targetCoords.lat.toFixed(4)}, Lng ${targetCoords.lng.toFixed(4)})`;

      // Si es SOS, activar automáticamente el modo emergencia, disparar notificación push + WebSocket en tiempo real
      if (isSos) {
        const nowIso = new Date().toISOString();
        setMode('EMERGENCIA');
        dispatchSosPushNotification({
          description: rawDescription,
          locationLabel,
          lat: targetCoords.lat,
          lng: targetCoords.lng,
          createdAt: nowIso,
        });
        void broadcastRealtimeSos({
          client_mutation_id: res.client_mutation_id,
          title: intentToPublish.title,
          description: rawDescription,
          locationLabel,
          lat: targetCoords.lat,
          lng: targetCoords.lng,
          sectorId: currentSector?.id,
          createdAt: nowIso,
          authorDeviceId: myDeviceId,
          storedRecord: res.storedRecord,
        });
      }

      // Notificar cualquier publicación nueva (Oficio, Producto, Favor o SOS) por WebSocket a todos los dispositivos
      void broadcastRealtimePublication({
        client_mutation_id: res.client_mutation_id,
        module: intentToPublish.module,
        lat: targetCoords.lat,
        lng: targetCoords.lng,
        sectorId: currentSector?.id,
        authorDeviceId: myDeviceId,
        storedRecord: res.storedRecord,
      });

      const isCurrentlyOnline =
        typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
          ? navigator.onLine && syncManager.getState().isOnline
          : syncManager.getState().isOnline;

      if (!isCurrentlyOnline) {
        toast.warning('Aviso guardado localmente (Sin red)', {
          description: 'Se sincronizará automáticamente al recuperar conexión.',
          duration: 4500,
        });
      } else {
        void syncManager.processOutbox().then(() => {
          void broadcastRealtimePublication({
            client_mutation_id: res.client_mutation_id,
            module: intentToPublish.module,
            lat: targetCoords.lat,
            lng: targetCoords.lng,
            sectorId: currentSector?.id,
            authorDeviceId: myDeviceId,
            storedRecord: res.storedRecord,
          });
        });
        toast.success(
          isSos
            ? '🚨 Emergencia SOS publicada y notificada a tus vecinos cercanos'
            : '¡Publicado con éxito! En espera de respuesta de tus vecinos.'
        );
      }

      onPublished?.({
        client_mutation_id: res.client_mutation_id,
        module: intentToPublish.module,
        post_type: intentToPublish.post_type,
        is_sos: isSos,
        title: intentToPublish.title,
        description: rawDescription,
        location_label: locationLabel,
        coords: { lat: targetCoords.lat, lng: targetCoords.lng },
        photo_url: isSos ? undefined : photoPreview ?? undefined,
        storedRecord: res.storedRecord,
      });

      // Limpiar campos del formulario y cerrar de inmediato
      setTitleText('');
      setInputText('');
      setPhotoPreview(null);
      setAttachedPhotoName(null);
      setFieldErrors({});
      resetTranscript();
      handleAnimatedClose();
    } catch {
      toast.error('No se pudo publicar el aviso. Inténtalo de nuevo.');
    } finally {
      setIsPublishing(false);
    }
  }, [
    activeCategory,
    authorName,
    contactPhone,
    coords,
    currentSector?.name,
    customDb,
    handleAnimatedClose,
    inputText,
    isListening,
    mode,
    onPublished,
    photoPreview,
    resetTranscript,
    resolveAutomaticSosCoordinates,
    setMode,
    stopListening,
    titleText,
    validateForm,
  ]);

  if (!isOpen) {
    return null;
  }

  const isSos = activeCategory === 'SOS';
  const showContactPhone = activeCategory === 'PRODUCTO' || activeCategory === 'FAVOR';
  const isEmergencyMode = mode === 'EMERGENCIA';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-publish-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div
        onClick={handleAnimatedClose}
        className={`fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-200 ${
          isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
        }`}
        aria-hidden="true"
      />

      {/* Contenedor del Formulario */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full sm:max-w-lg rounded-t-[28px] sm:rounded-3xl shadow-2xl border-2 p-5 sm:p-6 max-h-[92vh] sm:max-h-[88vh] overflow-y-auto no-scrollbar flex flex-col gap-4 transition-all duration-200 ${
          isEmergencyMode
            ? 'bg-[#141A24] border-[#FB7185] text-[#FFFFFF]'
            : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700 text-[#0F172A] dark:text-[#F8FAFC]'
        } ${
          isClosing
            ? 'animate-out slide-out-to-bottom duration-200'
            : 'animate-in slide-in-from-bottom duration-200'
        }`}
      >
        {/* Manija táctil móvil */}
        <div
          className={`mx-auto -mt-2 mb-0.5 h-1.5 w-12 rounded-full sm:hidden ${
            isEmergencyMode ? 'bg-slate-400' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />

        {/* Encabezado */}
        <div
          className={`flex items-start justify-between gap-3 border-b pb-3 ${
            isEmergencyMode ? 'border-slate-600' : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          <div>
            <h2
              id="quick-publish-title"
              className={`text-xl font-black tracking-tight leading-tight ${
                isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
              }`}
            >
              ¿Qué deseas compartir hoy?
            </h2>
            <p
              className={`text-xs mt-0.5 font-semibold ${
                isEmergencyMode ? 'text-[#E2E8F0]' : 'text-[#334155] dark:text-[#E2E8F0]'
              }`}
            >
              {isSos
                ? 'Emergencia vecinal inmediata · Tu ubicación GPS se enviará automáticamente'
                : 'Los campos con (*) son obligatorios'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAnimatedClose();
            }}
            aria-label="Cerrar ventana de publicación"
            className={`min-h-[48px] min-w-[48px] w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer border ${
              isEmergencyMode
                ? 'bg-[#1E2636] hover:bg-[#283246] text-white border-[#FB7185]'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600'
            }`}
          >
            <X className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
          </button>
        </div>

        {/* Selector de Tipo de Publicación */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="Tipo de publicación">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'OFICIO'}
            onClick={() => handleSelectCategory('OFICIO')}
            className={`min-h-[48px] p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all text-xs font-extrabold cursor-pointer border-2 ${
              activeCategory === 'OFICIO'
                ? 'bg-[#014069] text-white border-[#38BDF8] shadow-md'
                : isEmergencyMode
                  ? 'bg-[#1E2636] text-white hover:bg-[#283246] border-[#FB7185]/80'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Oficio</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'PRODUCTO'}
            onClick={() => handleSelectCategory('PRODUCTO')}
            className={`min-h-[48px] p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all text-xs font-extrabold cursor-pointer border-2 ${
              activeCategory === 'PRODUCTO'
                ? 'bg-[#9A3412] text-white border-[#FDBA74] shadow-md'
                : isEmergencyMode
                  ? 'bg-[#1E2636] text-white hover:bg-[#283246] border-[#FB7185]/80'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Producto</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'FAVOR'}
            onClick={() => handleSelectCategory('FAVOR')}
            className={`min-h-[48px] p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all text-xs font-extrabold cursor-pointer border-2 ${
              activeCategory === 'FAVOR'
                ? 'bg-[#065F46] text-white border-[#6EE7B7] shadow-md'
                : isEmergencyMode
                  ? 'bg-[#1E2636] text-white hover:bg-[#283246] border-[#FB7185]/80'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            <span>Favor solidario</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'SOS'}
            onClick={() => handleSelectCategory('SOS')}
            className={`min-h-[48px] p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all text-xs font-black cursor-pointer border-2 ${
              activeCategory === 'SOS'
                ? 'bg-[#B91C1C] text-white border-[#FCA5A5] shadow-md'
                : isEmergencyMode
                  ? 'bg-[#4C0519] text-[#FFE4E6] hover:bg-[#881337] border-[#FB7185]'
                  : 'bg-red-50 dark:bg-red-950/60 text-[#991B1B] dark:text-[#FCA5A5] hover:bg-red-100 border-red-300 dark:border-red-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>SOS</span>
          </button>
        </div>

        {/* FORMULARIO CORTO Y ESPECÍFICO SEGÚN EL TIPO */}
        {isSos ? (
          /* FLUJO SOS: Un solo campo "¿Qué sucedió?" (descripción) */
          <div className="space-y-3">
            <div>
              <label
                htmlFor="publish-sos-description"
                className={`text-xs font-black block mb-1.5 uppercase tracking-wide ${
                  isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                }`}
              >
                ¿Qué sucedió? <span className={isEmergencyMode ? 'text-[#FCA5A5]' : 'text-[#DC2626] dark:text-[#FCA5A5]'}>*</span>
              </label>
              <div className="relative">
                <textarea
                  id="publish-sos-description"
                  rows={4}
                  maxLength={300}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value.slice(0, 300));
                    if (fieldErrors.inputText) {
                      setFieldErrors((prev) => ({ ...prev, inputText: undefined }));
                    }
                  }}
                  placeholder="Describe brevemente la emergencia que está ocurriendo..."
                  aria-invalid={Boolean(fieldErrors.inputText)}
                  aria-describedby={fieldErrors.inputText ? 'error-sos-description' : undefined}
                  className={`w-full rounded-2xl border-2 p-3.5 pr-14 text-sm font-bold leading-relaxed resize-none outline-none ${
                    isEmergencyMode
                      ? 'bg-[#1E2636] text-[#FFFFFF] placeholder:text-[#CBD5E1] border-[#FB7185] focus:border-[#FDE047]'
                      : 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-slate-500 dark:placeholder:text-slate-400 border-slate-300 dark:border-slate-600 focus:border-[#B91C1C]'
                  } ${
                    fieldErrors.inputText
                      ? 'border-[#DC2626] dark:border-[#F87171]'
                      : ''
                  }`}
                />

                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  aria-label={isListening ? 'Detener dictado por voz' : 'Dictar emergencia con micrófono'}
                  className={`absolute right-2.5 bottom-2.5 min-h-[48px] min-w-[48px] w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    isListening
                      ? 'bg-[#B91C1C] text-white animate-pulse'
                      : isEmergencyMode
                        ? 'bg-[#283246] hover:bg-[#334155] text-white border border-[#FB7185]'
                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-[#0F172A] dark:text-white border border-slate-300 dark:border-slate-500'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              </div>

              {fieldErrors.inputText && (
                <p
                  id="error-sos-description"
                  role="alert"
                  className="mt-1.5 text-xs font-extrabold text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-1.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fieldErrors.inputText}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          /* FLUJO OFICIO / PRODUCTO / FAVOR SOLIDARIO */
          <div className="space-y-3.5">
            {/* 1. Nombre (Obligatorio, autocompletado con el perfil del usuario y editable) */}
            <div>
              <label
                htmlFor="publish-author-name"
                className={`text-xs font-black block mb-1 uppercase tracking-wide ${
                  isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                }`}
              >
                Nombre <span className={isEmergencyMode ? 'text-[#FCA5A5]' : 'text-[#DC2626] dark:text-[#FCA5A5]'}>*</span>
              </label>
              <input
                id="publish-author-name"
                type="text"
                maxLength={60}
                value={authorName}
                onChange={(e) => {
                  setAuthorName(e.target.value.slice(0, 60));
                  if (fieldErrors.authorName) {
                    setFieldErrors((prev) => ({ ...prev, authorName: undefined }));
                  }
                }}
                placeholder="Tu nombre completo"
                aria-invalid={Boolean(fieldErrors.authorName)}
                aria-describedby={fieldErrors.authorName ? 'error-author-name' : undefined}
                className={`w-full min-h-[48px] h-12 px-3.5 rounded-xl border-2 text-sm font-bold outline-none ${
                  isEmergencyMode
                    ? 'bg-[#1E2636] text-[#FFFFFF] placeholder:text-[#CBD5E1] border-[#FB7185] focus:border-[#FDE047]'
                    : 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-slate-500 dark:placeholder:text-slate-400 border-slate-300 dark:border-slate-600 focus:border-[#014069] dark:focus:border-[#38BDF8]'
                } ${
                  fieldErrors.authorName
                    ? 'border-[#DC2626] dark:border-[#F87171]'
                    : ''
                }`}
              />
              {fieldErrors.authorName && (
                <p
                  id="error-author-name"
                  role="alert"
                  className="mt-1 text-xs font-extrabold text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-1.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fieldErrors.authorName}</span>
                </p>
              )}
            </div>

            {/* 2. Título (Obligatorio) */}
            <div>
              <label
                htmlFor="publish-title-text"
                className={`text-xs font-black block mb-1 uppercase tracking-wide ${
                  isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                }`}
              >
                Título <span className={isEmergencyMode ? 'text-[#FCA5A5]' : 'text-[#DC2626] dark:text-[#FCA5A5]'}>*</span>
              </label>
              <input
                id="publish-title-text"
                type="text"
                maxLength={80}
                value={titleText}
                onChange={(e) => {
                  setTitleText(e.target.value.slice(0, 80));
                  if (fieldErrors.titleText) {
                    setFieldErrors((prev) => ({ ...prev, titleText: undefined }));
                  }
                }}
                placeholder={
                  activeCategory === 'OFICIO'
                    ? 'Ej. Gasfitería y reparación de fugas'
                    : activeCategory === 'PRODUCTO'
                    ? 'Ej. Pan artesanal y queques caseros'
                    : 'Ej. Préstamo de silla de ruedas o apoyo vecinal'
                }
                aria-invalid={Boolean(fieldErrors.titleText)}
                aria-describedby={fieldErrors.titleText ? 'error-title-text' : undefined}
                className={`w-full min-h-[48px] h-12 px-3.5 rounded-xl border-2 text-sm font-bold outline-none ${
                  isEmergencyMode
                    ? 'bg-[#1E2636] text-[#FFFFFF] placeholder:text-[#CBD5E1] border-[#FB7185] focus:border-[#FDE047]'
                    : 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-slate-500 dark:placeholder:text-slate-400 border-slate-300 dark:border-slate-600 focus:border-[#014069] dark:focus:border-[#38BDF8]'
                } ${
                  fieldErrors.titleText
                    ? 'border-[#DC2626] dark:border-[#F87171]'
                    : ''
                }`}
              />
              {fieldErrors.titleText && (
                <p
                  id="error-title-text"
                  role="alert"
                  className="mt-1 text-xs font-extrabold text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-1.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fieldErrors.titleText}</span>
                </p>
              )}
            </div>

            {/* 3. Descripción (Obligatorio) */}
            <div>
              <label
                htmlFor="publish-input-text"
                className={`text-xs font-black block mb-1 uppercase tracking-wide ${
                  isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                }`}
              >
                Descripción <span className={isEmergencyMode ? 'text-[#FCA5A5]' : 'text-[#DC2626] dark:text-[#FCA5A5]'}>*</span>
              </label>
              <div className="relative">
                <textarea
                  id="publish-input-text"
                  rows={3}
                  maxLength={300}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value.slice(0, 300));
                    if (fieldErrors.inputText) {
                      setFieldErrors((prev) => ({ ...prev, inputText: undefined }));
                    }
                  }}
                  placeholder="Describe brevemente lo que ofreces o necesitas..."
                  aria-invalid={Boolean(fieldErrors.inputText)}
                  aria-describedby={fieldErrors.inputText ? 'error-input-text' : undefined}
                  className={`w-full rounded-2xl border-2 p-3.5 pr-14 text-sm font-bold leading-relaxed resize-none outline-none ${
                    isEmergencyMode
                      ? 'bg-[#1E2636] text-[#FFFFFF] placeholder:text-[#CBD5E1] border-[#FB7185] focus:border-[#FDE047]'
                      : 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-slate-500 dark:placeholder:text-slate-400 border-slate-300 dark:border-slate-600 focus:border-[#014069] dark:focus:border-[#38BDF8]'
                  } ${
                    fieldErrors.inputText
                      ? 'border-[#DC2626] dark:border-[#F87171]'
                      : ''
                  }`}
                />

                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  aria-label={isListening ? 'Detener dictado por voz' : 'Dictar descripción con micrófono'}
                  className={`absolute right-2.5 bottom-2.5 min-h-[48px] min-w-[48px] w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    isListening
                      ? 'bg-[#B91C1C] text-white animate-pulse'
                      : isEmergencyMode
                        ? 'bg-[#283246] hover:bg-[#334155] text-white border border-[#FB7185]'
                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-[#014069] dark:text-white border border-slate-300 dark:border-slate-500'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              </div>
              {isListening && (
                <p className="mt-1 text-xs font-bold text-[#B91C1C] dark:text-[#FCA5A5]">
                  Escuchando... ({statusMessage || 'Habla claro'})
                </p>
              )}
              {fieldErrors.inputText && (
                <p
                  id="error-input-text"
                  role="alert"
                  className="mt-1 text-xs font-extrabold text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-1.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fieldErrors.inputText}</span>
                </p>
              )}
            </div>

            {/* 4. Ubicación (Obligatorio en Oficio, Producto y Favor solidario) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className={`text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${
                    isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-[#C2570C] dark:text-[#FDBA74]" />
                  <span>
                    Ubicación <span className={isEmergencyMode ? 'text-[#FCA5A5]' : 'text-[#DC2626] dark:text-[#FCA5A5]'}>*</span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleLocateCurrentGps}
                  disabled={isLocatingGps}
                  className={`min-h-[48px] px-3 py-1 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                    isEmergencyMode
                      ? 'text-[#38BDF8] bg-[#1E2636] hover:bg-[#283246] border-[#38BDF8]/60'
                      : 'text-[#014069] dark:text-[#38BDF8] bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 border-sky-300 dark:border-slate-600'
                  }`}
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-spin' : ''}`} />
                  <span>{isLocatingGps ? 'Buscando GPS...' : 'Usar mi GPS'}</span>
                </button>
              </div>

              <div
                ref={miniMapRef}
                onClick={handleMiniMapClick}
                className="h-40 w-full rounded-2xl overflow-hidden relative border-2 border-slate-300 dark:border-slate-600 shadow-inner bg-slate-100 cursor-crosshair select-none"
                title="Toca para confirmar o ajustar la ubicación en el mapa"
              >
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {miniMapTileData.tiles.map((tile) => (
                    <img
                      key={tile.key}
                      src={tile.url}
                      alt=""
                      style={{
                        position: 'absolute',
                        width: `${MINI_TILE_SIZE}px`,
                        height: `${MINI_TILE_SIZE}px`,
                        left: `calc(50% + ${tile.left}px)`,
                        top: `calc(50% + ${tile.top}px)`,
                        maxWidth: 'none',
                        maxHeight: 'none',
                      }}
                      className="select-none pointer-events-none"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ))}
                </div>

                {/* Pin Central */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative -mt-6 flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-[#B91C1C] text-white flex items-center justify-center shadow-lg border-2 border-white">
                      <MapPin className="w-5 h-5 fill-white text-[#B91C1C]" />
                    </div>
                    <div className="w-4 h-1.5 rounded-full bg-black/40 blur-[1px] mt-0.5" />
                  </div>
                </div>

                <div className="absolute top-2 left-2 bg-white/95 dark:bg-slate-900/95 text-[11px] font-extrabold text-slate-900 dark:text-white px-2.5 py-1 rounded-full shadow-xs border border-slate-300 dark:border-slate-600 pointer-events-none">
                  Toca el mapa para ajustar la ubicación
                </div>

                <div className="absolute bottom-1.5 left-2 right-2 bg-slate-900/90 text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full text-center truncate pointer-events-none">
                  📍 Lat: {coords.lat.toFixed(5)} · Lng: {coords.lng.toFixed(5)}
                </div>
              </div>

              {fieldErrors.location && (
                <p
                  role="alert"
                  className="mt-1 text-xs font-extrabold text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-1.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fieldErrors.location}</span>
                </p>
              )}
            </div>

            {/* 5. Número de contacto (Solo para Producto y Favor solidario) */}
            {showContactPhone && (
              <div>
                <label
                  htmlFor="publish-phone"
                  className={`text-xs font-black flex items-center gap-1.5 mb-1 uppercase tracking-wide ${
                    isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                  }`}
                >
                  <Phone className={isEmergencyMode ? 'w-3.5 h-3.5 text-[#38BDF8]' : 'w-3.5 h-3.5 text-[#014069] dark:text-[#38BDF8]'} />
                  <span>
                    Número de contacto <span className={isEmergencyMode ? 'text-[#FCA5A5]' : 'text-[#DC2626] dark:text-[#FCA5A5]'}>*</span>
                  </span>
                </label>
                <input
                  id="publish-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 9));
                    if (fieldErrors.contactPhone) {
                      setFieldErrors((prev) => ({ ...prev, contactPhone: undefined }));
                    }
                  }}
                  placeholder="9 dígitos (ej. 987654321)"
                  aria-invalid={Boolean(fieldErrors.contactPhone)}
                  aria-describedby={fieldErrors.contactPhone ? 'error-contact-phone' : undefined}
                  className={`w-full min-h-[48px] h-12 px-3.5 rounded-xl border-2 font-bold text-sm outline-none ${
                    isEmergencyMode
                      ? 'bg-[#1E2636] text-[#FFFFFF] placeholder:text-[#CBD5E1] border-[#FB7185] focus:border-[#FDE047]'
                      : 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-slate-500 dark:placeholder:text-slate-400 border-slate-300 dark:border-slate-600 focus:border-[#014069] dark:focus:border-[#38BDF8]'
                  } ${
                    fieldErrors.contactPhone
                      ? 'border-[#DC2626] dark:border-[#F87171]'
                      : ''
                  }`}
                />
                {fieldErrors.contactPhone && (
                  <p
                    id="error-contact-phone"
                    role="alert"
                    className="mt-1 text-xs font-extrabold text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{fieldErrors.contactPhone}</span>
                  </p>
                )}
              </div>
            )}

            {/* 6. Foto (Opcional en Oficio, Producto y Favor solidario) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${
                    isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                  }`}
                >
                  <Camera className={isEmergencyMode ? 'w-4 h-4 text-[#38BDF8]' : 'w-4 h-4 text-[#014069] dark:text-[#38BDF8]'} />
                  <span>Foto (opcional)</span>
                </span>

                <label
                  className={`min-h-[48px] px-3.5 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                    isEmergencyMode
                      ? 'bg-[#1E2636] hover:bg-[#283246] text-[#FFFFFF] border-[#FB7185]'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#0F172A] dark:text-[#F8FAFC] border-slate-300 dark:border-slate-600'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{photoPreview ? 'Cambiar foto' : '+ Subir foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handlePhotoSelect}
                  />
                </label>
              </div>

              {photoPreview && (
                <div className="relative inline-block mt-1">
                  <img
                    src={photoPreview}
                    alt="Vista previa adjunta"
                    className="w-24 h-24 object-cover rounded-2xl border-2 border-slate-300 dark:border-slate-600 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    aria-label="Quitar foto adjunta"
                    className="absolute -top-3 -right-3 min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-900 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-all active:scale-90 cursor-pointer"
                  >
                    <X className="w-5 h-5 stroke-[2.5]" />
                  </button>
                  <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1 truncate max-w-[140px]">
                    {attachedPhotoName}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botón Principal Único: “Publicar” */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={isPublishing}
            className={`w-full min-h-[52px] h-13 rounded-2xl font-black text-base tracking-wide inline-flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 text-white cursor-pointer border-2 ${
              isSos
                ? 'bg-[#B91C1C] hover:bg-[#991B1B] border-[#FCA5A5]'
                : 'bg-[#014069] hover:bg-[#0B2545] border-[#38BDF8]/40'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
            <span>{isPublishing ? 'Publicando...' : 'Publicar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickPublishSheet;
