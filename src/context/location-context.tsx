'use client';

/**
 * @file src/context/location-context.tsx
 * @description Contexto hiperlocal de geolocalización GPS real, selección territorial y filtrado por radio para RedVecina.
 * Utiliza adquisición GPS de doble etapa (Fused Wi-Fi/Cell rápido + Satélite de alta precisión con watchPosition),
 * idéntico al comportamiento de Google Maps y OpenStreetMap Web en dispositivos móviles.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface ITerritorySector {
  id: string;
  name: string;
  district: string;
  department: string;
  centerLat: number;
  centerLng: number;
  zoomLevel: number;
  isCatastropheZone?: boolean;
}

export type HyperlocalRadiusMeters = 200 | 500 | 1000 | null;

export const SUCRE_HUANCAYO_COORDS = {
  lat: -12.0793449,
  lng: -75.2138727,
  name: 'Huancayo · Tu Ubicación (Chilca / Huancayo)',
};

export interface ILocationContextState {
  currentSector: ITerritorySector;
  availableSectors: ITerritorySector[];
  activeRadius: HyperlocalRadiusMeters;
  userCoords: { lat: number; lng: number };
  realGpsCoords: { lat: number; lng: number } | null;
  isRealLocationActive: boolean;
  setSector: (sectorId: string) => void;
  setUserCoords: (coords: { lat: number; lng: number }) => void;
  setActiveRadius: (radius: HyperlocalRadiusMeters) => void;
  recenterToUser: () => void;
  useRealLocation: () => void;
  isInsideProvider?: boolean;
}

export const AVAILABLE_SECTORS: ITerritorySector[] = [
  {
    id: 'huancayo-el-tambo',
    name: 'Huancayo · El Tambo',
    district: 'El Tambo',
    department: 'Junín',
    centerLat: -12.0528,
    centerLng: -75.2155,
    zoomLevel: 15,
  },
  {
    id: 'huancayo-san-carlos',
    name: 'Huancayo · San Carlos',
    district: 'Huancayo',
    department: 'Junín',
    centerLat: -12.0625,
    centerLng: -75.2005,
    zoomLevel: 15,
  },
  {
    id: 'huancayo-centro',
    name: 'Huancayo · Centro Urbano',
    district: 'Huancayo',
    department: 'Junín',
    centerLat: -12.0678,
    centerLng: -75.2085,
    zoomLevel: 15,
  },
  {
    id: 'zona-critica-huaytapallana',
    name: 'Zona Crítica Sismos · Falla Huaytapallana',
    district: 'Huancayo',
    department: 'Junín',
    centerLat: -12.048,
    centerLng: -75.195,
    zoomLevel: 14,
    isCatastropheZone: true,
  },
  {
    id: 'zona-critica-mantaro',
    name: 'Zona Crítica El Niño · Cuenca Mantaro',
    district: 'El Tambo / Huancayo',
    department: 'Junín',
    centerLat: -12.058,
    centerLng: -75.228,
    zoomLevel: 14,
    isCatastropheZone: true,
  },
  {
    id: 'lima-jesus-maria-4',
    name: 'Lima · Jesús María · Sector 4',
    district: 'Jesús María',
    department: 'Lima',
    centerLat: -12.0752,
    centerLng: -77.0485,
    zoomLevel: 15,
  },
];

export const DEFAULT_SECTOR = AVAILABLE_SECTORS[0]!;

const STORAGE_KEY_SECTOR = 'redvecina_active_sector_id';
const STORAGE_KEY_RADIUS = 'redvecina_active_radius';
const STORAGE_KEY_REAL_GPS = 'redvecina_real_gps_coords';

const defaultContextState: ILocationContextState = {
  currentSector: DEFAULT_SECTOR,
  availableSectors: AVAILABLE_SECTORS,
  activeRadius: null,
  userCoords: { lat: SUCRE_HUANCAYO_COORDS.lat, lng: SUCRE_HUANCAYO_COORDS.lng },
  realGpsCoords: null,
  isRealLocationActive: false,
  setSector: () => {},
  setUserCoords: () => {},
  setActiveRadius: () => {},
  recenterToUser: () => {},
  useRealLocation: () => {},
  isInsideProvider: false,
};

export const LocationContext = createContext<ILocationContextState>(defaultContextState);

export interface LocationProviderProps {
  children?: React.ReactNode;
  initialSectorId?: string;
  initialRadius?: HyperlocalRadiusMeters;
}

export function LocationProvider({
  children,
  initialSectorId,
  initialRadius,
}: LocationProviderProps): React.ReactElement {
  const [currentSector, setCurrentSectorState] = useState<ITerritorySector>(() => {
    if (initialSectorId) {
      const match = AVAILABLE_SECTORS.find((s) => s.id === initialSectorId);
      if (match) return match;
    }
    return DEFAULT_SECTOR;
  });

  const [activeRadius, setActiveRadiusState] = useState<HyperlocalRadiusMeters>(
    initialRadius ?? null
  );

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: currentSector.centerLat,
    lng: currentSector.centerLng,
  });

  const [realGpsCoords, setRealGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isRealLocationActive, setIsRealLocationActive] = useState<boolean>(false);
  const hasLockedRealGpsRef = useRef<boolean>(false);
  const bestAccuracyRef = useRef<number>(Infinity);
  const manualSectorModeRef = useRef<boolean>(false);

  // Guarda una coordenada GPS real verificada por el navegador/dispositivo
  const applyVerifiedGpsPosition = useCallback((pos: GeolocationPosition, forceRecenter = false) => {
    const detectedLat = Number(pos.coords.latitude.toFixed(6));
    const detectedLng = Number(pos.coords.longitude.toFixed(6));
    const accuracy = pos.coords.accuracy ?? 100;

    if (!Number.isFinite(detectedLat) || !Number.isFinite(detectedLng)) return;

    // Si ya tenemos una lectura muy precisa (<30m) y llega una lectura gruesa de red (>500m) sin haber pedido recentrar, ignorar la gruesa
    if (
      !forceRecenter &&
      hasLockedRealGpsRef.current &&
      bestAccuracyRef.current <= 50 &&
      accuracy > bestAccuracyRef.current * 4
    ) {
      return;
    }

    if (accuracy < bestAccuracyRef.current || forceRecenter) {
      bestAccuracyRef.current = accuracy;
    }

    hasLockedRealGpsRef.current = true;
    const coordsObj = { lat: detectedLat, lng: detectedLng };
    setRealGpsCoords(coordsObj);

    // Solo actualizar la ubicación activa si el usuario NO ha cambiado manualmente a un sector simulado
    if (!manualSectorModeRef.current) {
      setUserCoords(coordsObj);
      setIsRealLocationActive(true);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_KEY_REAL_GPS,
          JSON.stringify({ ...coordsObj, accuracy, timestamp: Date.now() })
        );
        const rawProfile = localStorage.getItem('redvecina_user_profile');
        const parsedProfile = rawProfile ? JSON.parse(rawProfile) : {};
        localStorage.setItem(
          'redvecina_user_profile',
          JSON.stringify({
            ...parsedProfile,
            last_lat: detectedLat,
            last_lng: detectedLng,
          })
        );
      } catch {
        // Ignorar errores de almacenamiento
      }
    }
  }, []);

  // Restaurar preferencias de radio y última ubicación GPS real guardada
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedRealGps = localStorage.getItem(STORAGE_KEY_REAL_GPS);
      if (savedRealGps && !initialSectorId) {
        const parsed = JSON.parse(savedRealGps) as {
          lat?: number;
          lng?: number;
        };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setRealGpsCoords({ lat: parsed.lat, lng: parsed.lng });
          setUserCoords({ lat: parsed.lat, lng: parsed.lng });
          setIsRealLocationActive(true);
        }
      }

      const savedRadius = localStorage.getItem(STORAGE_KEY_RADIUS);
      if (savedRadius !== null && initialRadius === undefined) {
        if (savedRadius === 'null') {
          setActiveRadiusState(null);
        } else {
          const num = Number(savedRadius);
          if (num === 200 || num === 500 || num === 1000) {
            setActiveRadiusState(num as HyperlocalRadiusMeters);
          }
        }
      }
    } catch {
      // Ignorar fallos de localStorage
    }
  }, [initialSectorId, initialRadius]);

  // Solicitar ubicación real del dispositivo (Doble etapa: Red rápida + GPS satelital de alta precisión + watchPosition)
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    // Etapa 1: Posición rápida (Wi-Fi / Antenas / Fused Location en celulares < 500ms)
    navigator.geolocation.getCurrentPosition(
      (pos) => applyVerifiedGpsPosition(pos, false),
      () => {
        // Silencioso: Etapa 2 o watchPosition tomarán el relevo
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );

    // Etapa 2: Posición satelital de alta precisión (igual que Google Maps / OpenStreetMap.org)
    navigator.geolocation.getCurrentPosition(
      (pos) => applyVerifiedGpsPosition(pos, true),
      () => {
        // Si el chip GPS satelital tarda en interiores, pedir lectura fusionada fresca sin sobreescribir con coordenadas falsas
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => applyVerifiedGpsPosition(fallbackPos, false),
          () => {},
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    // Etapa 3: Seguimiento continuo en vivo para afinar precisión en celulares
    const watchId = navigator.geolocation.watchPosition(
      (pos) => applyVerifiedGpsPosition(pos, false),
      () => {},
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 5000 }
    );

    return () => {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [applyVerifiedGpsPosition]);

  const setSector = useCallback((sectorId: string) => {
    const target = AVAILABLE_SECTORS.find((s) => s.id === sectorId);
    if (!target) return;

    manualSectorModeRef.current = true;
    setIsRealLocationActive(false);
    setCurrentSectorState(target);
    setUserCoords({ lat: target.centerLat, lng: target.centerLng });

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SECTOR, target.id);
      }
    } catch {
      // No-op
    }
  }, []);

  const requestFreshGpsLocation = useCallback(() => {
    manualSectorModeRef.current = false;
    if (realGpsCoords) {
      setUserCoords(realGpsCoords);
      setIsRealLocationActive(true);
    }

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => applyVerifiedGpsPosition(pos, true),
        () => {
          // Si falla alta precisión por tiempo de espera en interiores, usar ubicación de red/fusionada del celular
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => applyVerifiedGpsPosition(fallbackPos, true),
            () => {
              if (realGpsCoords) {
                setUserCoords(realGpsCoords);
                setIsRealLocationActive(true);
              }
            },
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  }, [applyVerifiedGpsPosition, realGpsCoords]);

  const useRealLocation = useCallback(() => {
    manualSectorModeRef.current = false;
    requestFreshGpsLocation();
  }, [requestFreshGpsLocation]);

  const setActiveRadius = useCallback((radius: HyperlocalRadiusMeters) => {
    setActiveRadiusState(radius);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_RADIUS, String(radius));
      }
    } catch {
      // No-op
    }
  }, []);

  const recenterToUser = useCallback(() => {
    if (manualSectorModeRef.current) {
      setUserCoords({ lat: currentSector.centerLat, lng: currentSector.centerLng });
      return;
    }
    requestFreshGpsLocation();
  }, [currentSector.centerLat, currentSector.centerLng, requestFreshGpsLocation]);

  const value: ILocationContextState = {
    currentSector,
    availableSectors: AVAILABLE_SECTORS,
    activeRadius,
    userCoords,
    realGpsCoords,
    isRealLocationActive,
    setSector,
    setUserCoords,
    setActiveRadius,
    recenterToUser,
    useRealLocation,
    isInsideProvider: true,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Hook de acceso seguro al contexto de ubicación territorial de RedVecina.
 */
export function useLocation(): ILocationContextState {
  const context = useContext(LocationContext);
  return context || defaultContextState;
}
