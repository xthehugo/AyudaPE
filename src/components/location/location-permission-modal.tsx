'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, ShieldCheck, X } from 'lucide-react';
import { useLocation, SUCRE_HUANCAYO_COORDS } from '@/context/location-context';

const STORAGE_KEY_LOCATION_PROMPTED = 'redvecina_location_prompted_v1';

/**
 * Diálogo accesible e interactivo que solicita permiso de ubicación GPS
 * al usuario para filtrar oficios y alertas vecinales en tiempo real.
 * Fallback inmediato y fluido a Jr. Sucre 656, Huancayo (Chilca).
 */
export function LocationPermissionModal(): React.ReactElement | null {
  const { setUserCoords } = useLocation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const alreadyPrompted = localStorage.getItem(STORAGE_KEY_LOCATION_PROMPTED);
      if (!alreadyPrompted) {
        setIsOpen(true);
      }
    } catch {
      // Ignorar en entornos sin localStorage
    }
  }, []);

  const notifyLocationClosed = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_LOCATION_PROMPTED, 'true');
        window.dispatchEvent(new CustomEvent('ayudape_location_prompt_closed'));
      } catch {}
    }
  };

  const handleAllowGps = () => {
    setIsLocating(true);
    let resolved = false;

    // Timer de seguridad: máximo 3 segundos esperando respuesta de GPS
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setUserCoords({
          lat: SUCRE_HUANCAYO_COORDS.lat,
          lng: SUCRE_HUANCAYO_COORDS.lng,
        });
        setIsLocating(false);
        notifyLocationClosed();
      }
    }, 3200);

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(safetyTimer);
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setIsLocating(false);
          notifyLocationClosed();
        },
        () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(safetyTimer);
          setUserCoords({
            lat: SUCRE_HUANCAYO_COORDS.lat,
            lng: SUCRE_HUANCAYO_COORDS.lng,
          });
          setIsLocating(false);
          notifyLocationClosed();
        },
        { timeout: 3000, enableHighAccuracy: false, maximumAge: 60000 }
      );
    } else {
      clearTimeout(safetyTimer);
      setUserCoords({
        lat: SUCRE_HUANCAYO_COORDS.lat,
        lng: SUCRE_HUANCAYO_COORDS.lng,
      });
      setIsLocating(false);
      notifyLocationClosed();
    }
  };

  const handleUseSucreHuancayo = () => {
    setUserCoords({
      lat: SUCRE_HUANCAYO_COORDS.lat,
      lng: SUCRE_HUANCAYO_COORDS.lng,
    });
    notifyLocationClosed();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white text-slate-900 border border-slate-200 p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6 text-sky-600" strokeWidth={2.2} />
          </div>
          <button
            type="button"
            onClick={handleUseSucreHuancayo}
            aria-label="Cerrar modal de ubicación"
            className="min-h-[48px] h-12 min-w-[48px] text-slate-400 hover:text-slate-600 rounded-xl flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h2
            id="location-modal-title"
            className="text-lg font-black tracking-tight text-slate-900 leading-snug"
          >
            ¿Permitir tu ubicación en AyudaPE?
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Necesitamos conocer tu ubicación para calcular las distancias en metros a oficios
            locales, pedidos solidarios y centros de emergencia en tu cuadra.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.2} />
          <span>Cumplimiento Ley N° 29733: Tus datos de GPS son locales y nunca se comparten sin autorización.</span>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleAllowGps}
            disabled={isLocating}
            className="w-full min-h-[48px] h-12 px-4 rounded-xl bg-[#014069] hover:bg-[#012d4a] text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-sky-300" strokeWidth={2.2} />
            <span>{isLocating ? 'Detectando GPS...' : 'Permitir Ubicación GPS'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocationPermissionModal;
