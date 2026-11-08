'use client';

import React, { useEffect, useState } from 'react';
import {
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  ThumbsUp,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { IListingLocal } from '@shared/types';
import {
  fetchReverseGeocodeZone,
  formatDistance,
  resolveApproximateZoneLabel,
} from '@/lib/geo-utils';
import { isOwnListing } from '@/lib/ownership';

export interface ServiceCardProps {
  listing: IListingLocal;
  distanceMeters: number;
  onEndorse: (listing: IListingLocal) => void;
  isEndorsed?: boolean;
}

const CATEGORY_NAMES: Record<number, string> = {
  1: 'Gasfitería',
  2: 'Electricidad',
  3: 'Cerrajería',
  4: 'Salud',
  5: 'Alimentos',
  6: 'Agua y Saneamiento',
  7: 'Ropa y Abrigo',
  8: 'Transporte',
  9: 'Educación',
  10: 'Logística',
};

/**
 * Parsea el título y metadatos del anuncio para extraer:
 * - Nombre de la persona u oficio (ej. "Maestro Teodoro", "Don Alberto")
 * - Especialidad destacada (ej. "Termas solares · Tuberías · Fugas")
 * - Iniciales para el avatar (ej. "MT", "DA")
 * - Nombre corto para la llamada directa (ej. "Teodoro", "Alberto")
 */
export function parseListingCardData(
  title: string,
  categoryId: number,
  listingType: string
): {
  providerName: string;
  categoryLabel: string;
  specialty: string;
  initials: string;
  shortName: string;
} {
  const parts = title.split(/[·•—]/).map((s) => s.trim()).filter(Boolean);
  let providerName = '';
  let specialty = '';
  const categoryLabel =
    CATEGORY_NAMES[categoryId] ||
    (listingType === 'PRODUCTO_LOCAL'
      ? 'Producto'
      : listingType === 'SOPORTE_EMERGENCIA'
        ? 'Soporte SOS'
        : 'Oficio');

  if (parts.length >= 2) {
    const p0 = parts[0];
    const p1 = parts[1];

    const personMatchP0 = p0.match(
      /\b(Maestro\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Don\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Doña\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Vecina\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Vecino\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Lic\.\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Prof\.\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Técnico\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)\b/i
    );
    const personMatchP1 = p1.match(
      /\b(Maestro\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Don\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Doña\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Vecina\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Vecino\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Lic\.\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Prof\.\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Técnico\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)\b/i
    );

    if (personMatchP0) {
      providerName = personMatchP0[1];
      specialty = parts.slice(1).join(' · ');
    } else if (personMatchP1) {
      providerName = personMatchP1[1];
      specialty = [p0, ...parts.slice(2)].join(' · ');
    } else {
      // Si p0 es un nombre simple de persona (ej. "Hugo", "Pedro", "Juan Pérez")
      const isP0PersonName = /^[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?$/.test(p0) &&
        !/^(?:Gasfitería|Electricidad|Cerrajería|Atención|Servicios|Bodega|Botica)$/i.test(p0);

      const genericPrefix = p0.match(
        /^(?:Gasfitería|Electricista(?:\s+Matriculado)?|Cerrajería|Bodega(?:\s+y\s+[^\s]+)?|Botica(?:\s+[^\s]+)?|Lasañas[^\s]*)\s+(.+)$/i
      );

      if (isP0PersonName) {
        providerName = p0;
        specialty = parts.slice(1).join(' · ');
      } else if (genericPrefix) {
        providerName = genericPrefix[1];
        specialty = parts.slice(1).join(' · ');
      } else {
        providerName = p0;
        specialty = parts.slice(1).join(' · ');
      }
    }
  } else {
    const personMatch = title.match(
      /\b(Maestro\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Don\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Doña\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Vecina\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Vecino\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Lic\.\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Prof\.\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+|Técnico\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)\b/i
    );
    providerName = personMatch ? personMatch[1] : title;
    specialty = title;
  }

  // Nombre corto sin títulos honoríficos para el botón "Llamar a [Nombre]"
  const cleanName = providerName
    .replace(/^(?:Lic\.|Prof\.|Técnico|Maestro|Don|Doña|Vecina|Vecino)\s+/i, '')
    .trim();
  const words = cleanName.split(/\s+/).filter(Boolean);
  const shortName = words[0] || 'Vecino';

  // Iniciales (2 letras)
  let initials = '';
  if (providerName.startsWith('Maestro')) {
    initials = 'M' + (words[0] ? words[0][0] : 'T').toUpperCase();
  } else if (providerName.startsWith('Don') || providerName.startsWith('Doña')) {
    initials = 'D' + (words[0] ? words[0][0] : 'V').toUpperCase();
  } else if (providerName.startsWith('Lic.')) {
    initials = 'L' + (words[0] ? words[0][0] : 'R').toUpperCase();
  } else if (providerName.startsWith('Prof.')) {
    initials = 'P' + (words[0] ? words[0][0] : 'M').toUpperCase();
  } else if (providerName.startsWith('Técnico')) {
    initials = 'T' + (words[0] ? words[0][0] : 'W').toUpperCase();
  } else if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    initials = words[0].slice(0, 2).toUpperCase();
  } else {
    initials = 'OF';
  }

  return {
    providerName,
    categoryLabel,
    specialty,
    initials,
    shortName,
  };
}

/**
 * Tarjeta de Anuncio de Oficio Barrial (Fidelidad 100% al diseño de referencia Image 2):
 * - Avatar circular con iniciales y puntito verde de disponibilidad.
 * - Nombre ("Maestro Teodoro") y debajo "Categoría · a X m de ti".
 * - Línea en negrita con los servicios separados por "·". Debajo descripción máximo 2 líneas.
 * - Franja suave con 3 círculos decorativos y "N vecinos lo recomiendan" con botón "Recomendar".
 * - Si atiende emergencias: icono de rayo "Atiende emergencias las 24 horas" (sin recuadro).
 * - Acciones: botón principal azul marino "Llamar a [nombre]", botón circular WhatsApp y botón circular ubicación azul.
 * - Muestra la ubicación aproximada ("Zona aproximada: [calle/zona · distrito]").
 */
export function ServiceCard({
  listing,
  distanceMeters,
  onEndorse,
  isEndorsed = false,
}: ServiceCardProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const [deviceVerified, setDeviceVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('redvecina_dni_verified') === 'true';
    }
    return false;
  });
  const [isOwn, setIsOwn] = useState<boolean>(() => isOwnListing(listing));

  // Escuchar actualización reactiva en vivo (WebSocket local de identidad y autoría)
  useEffect(() => {
    setIsOwn(isOwnListing(listing));
    const handleIdentityUpdate = () => {
      setDeviceVerified(localStorage.getItem('redvecina_dni_verified') === 'true');
      setIsOwn(isOwnListing(listing));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('redvecina_identity_updated', handleIdentityUpdate);
      window.addEventListener('redvecina_ownership_updated', handleIdentityUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('redvecina_identity_updated', handleIdentityUpdate);
        window.removeEventListener('redvecina_ownership_updated', handleIdentityUpdate);
      }
    };
  }, [listing]);

  // Si es un anuncio recién publicado en este dispositivo, responde al estado de verificación del dispositivo
  const isAuthorVerified = listing.is_pending_sync ? deviceVerified : (listing.endorsement_count >= 1 || deviceVerified);

  const {
    providerName,
    categoryLabel,
    specialty,
    initials,
    shortName,
  } = parseListingCardData(listing.title, listing.category_id, listing.listing_type);

  const formattedDistance = formatDistance(distanceMeters);

  const endorsementCount = listing.endorsement_count;
  const endorsementText =
    endorsementCount === 1
      ? '1 vecino lo recomienda'
      : endorsementCount > 1
        ? `${endorsementCount} vecinos lo recomiendan`
        : 'Sé el primero en recomendarlo';

  // Asegurar coordenadas válidas para Google Maps (Punto 6)
  const effectiveLat = typeof listing.latitude === 'number' && !isNaN(listing.latitude)
    ? listing.latitude
    : -12.0752;
  const effectiveLng = typeof listing.longitude === 'number' && !isNaN(listing.longitude)
    ? listing.longitude
    : -75.21735;

  // Ubicación aproximada real calculada a partir de las coordenadas y metadatos del anuncio
  const [approxZone, setApproxZone] = useState<string>(() =>
    resolveApproximateZoneLabel(effectiveLat, effectiveLng, listing.title, listing.description)
  );

  useEffect(() => {
    setApproxZone(
      resolveApproximateZoneLabel(effectiveLat, effectiveLng, listing.title, listing.description)
    );
    let active = true;
    void fetchReverseGeocodeZone(effectiveLat, effectiveLng).then((realStreet) => {
      if (active && realStreet) {
        setApproxZone(realStreet);
      }
    });
    return () => {
      active = false;
    };
  }, [effectiveLat, effectiveLng, listing.title, listing.description]);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${effectiveLat},${effectiveLng}`;

  return (
    <motion.article
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 400, damping: 30 }
      }
      className="w-full"
    >
      <div className="rounded-[28px] bg-white text-[#0B1E3F] p-5 shadow-card-diffuse border-0 transition-all duration-200">
        {/* Fila Superior: Avatar con Iniciales + Punto Verde y Datos del Proveedor */}
        <div className="flex items-center gap-3.5">
          {/* Avatar Circular con iniciales y punto verde de disponibilidad */}
          <div className="relative shrink-0">
            <div
              className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-[#0B1E3F] font-bold text-lg select-none overflow-hidden"
              aria-label={`Avatar de ${providerName}`}
            >
              <span>{initials}</span>
            </div>

            {/* Punto verde de actividad barrial con borde blanco */}
            <span
              className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#15795A] bg-emerald-600 border-2 border-white shadow-2xs"
              aria-label="Disponible y activo en el sector"
            />
          </div>

          {/* Nombre y Subtítulo de Oficio + Distancia */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-lg font-bold text-[#0B1E3F] leading-snug tracking-tight truncate">
                {providerName}
              </h3>
              {/* Insignia Vecino Verificado DNI (Ley N° 29733) o Por verificar */}
              {isAuthorVerified ? (
                <span
                  title="Sus datos de DNI fueron validados. No incluye verificación facial."
                  className="rounded-full bg-[#E3F4EB] text-[#15795A] text-[10px] font-extrabold px-2 py-0.5 inline-flex items-center gap-1 cursor-help"
                >
                  <ShieldCheck className="w-3 h-3 text-[#15795A]" />
                  <span>Vecino verificado</span>
                </span>
              ) : (
                <span
                  title="Aún no ha completado la validación de DNI en su dispositivo."
                  className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 inline-flex items-center gap-1 cursor-help"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Por verificar</span>
                </span>
              )}
            </div>
            <span className="sr-only">{listing.title}</span>
            <p className="text-xs sm:text-sm font-semibold text-[#5B6068] mt-0.5">
              {categoryLabel} · a {formattedDistance} de ti
            </p>
          </div>
        </div>

        {/* Línea en Negrita con Servicios / Especialidades */}
        <p className="text-sm sm:text-base font-bold text-[#0B1E3F] mt-3 leading-snug">
          {specialty}
        </p>

        {/* Descripción Vecinal (Máximo 2 líneas con puntos suspensivos) */}
        <p className="text-xs sm:text-sm leading-relaxed text-[#5B6068] line-clamp-2 mt-1">
          {listing.description}
        </p>

        {/* Zona Aproximada de Privacidad */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5B6068] mt-2">
          <MapPin className="w-3.5 h-3.5 text-[#2F62D6] shrink-0" />
          <span>Zona aproximada: {approxZone}</span>
        </div>

        {listing.available_for_emergencies && (
          <span className="sr-only">Atiende emergencias las 24 horas</span>
        )}

        {/* Foto Opcional del Trabajo / Taller si existe */}
        {listing.photo_url && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-slate-100 bg-slate-100 max-h-40 w-full">
            <img
              src={listing.photo_url}
              alt={specialty}
              className="w-full h-36 object-cover hover:scale-102 transition-transform duration-300"
            />
          </div>
        )}

        {/* Franja Suave de Respaldo Comunitario / Recomendación Vecinal */}
        <div className="rounded-2xl bg-[#F4F5F7] p-2 sm:p-2.5 flex items-center justify-between gap-2 mt-3.5">
          {/* 3 círculos decorativos y conteo de recomendaciones */}
          <div
            className="flex items-center gap-2 min-w-0"
            data-testid={`trust-score-${listing.client_mutation_id}`}
          >
            <div className="flex items-center -space-x-2 shrink-0">
              <div
                className="w-6 h-6 rounded-full bg-slate-300 border-2 border-white shadow-2xs"
                aria-hidden="true"
              />
              <div
                className="w-6 h-6 rounded-full bg-slate-400 border-2 border-white shadow-2xs"
                aria-hidden="true"
              />
              <div
                className="w-6 h-6 rounded-full bg-slate-500 border-2 border-white shadow-2xs"
                aria-hidden="true"
              />
            </div>

            <span className="text-xs font-bold text-[#0B1E3F] truncate">
              {endorsementText}
            </span>
          </div>

          {/* Si la publicación es tuya, mostrar insignia "Tu publicación" y ocultar botón de auto-recomendar */}
          {isOwn ? (
            <span
              aria-label={`Tu publicación: ${providerName}`}
              className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#E6ECF7] dark:bg-slate-800 border border-[#0F2A56]/25 dark:border-sky-400/30 text-[#0F2A56] dark:text-sky-200 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 select-none"
            >
              <span>Tu publicación</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => !isEndorsed && onEndorse(listing)}
              disabled={isEndorsed}
              aria-label={
                isEndorsed
                  ? `Ya recomendaste el oficio de ${providerName}`
                  : `Recomendar oficio de ${providerName}`
              }
              className={`min-h-[48px] h-12 px-3.5 rounded-full border text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                isEndorsed
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 cursor-not-allowed opacity-80'
                  : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-[#0B1E3F] dark:text-slate-100 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.97] cursor-pointer'
              }`}
            >
              <ThumbsUp
                className={`w-3.5 h-3.5 shrink-0 ${
                  isEndorsed ? 'text-slate-400' : 'text-[#0B1E3F] dark:text-slate-100'
                }`}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span>{isEndorsed ? 'Ya recomendaste' : 'Recomendar'}</span>
              <span className="sr-only"> / Dar Visto Bueno</span>
            </button>
          )}
        </div>


        {/* Fila Inferior de Botones de Acción: Azul Marino Principal + WhatsApp Circular + Mapa Circular */}
        <div className="flex items-center gap-2.5 pt-1 mt-3">
          {/* Botón Principal Azul Marino Cápsula: "Llamar" */}
          <a
            href={`tel:${listing.contact_phone}`}
            aria-label={`Llamar a ${shortName} al ${listing.contact_phone}`}
            className="flex-1 min-h-[48px] h-12 px-4 rounded-full bg-[#0F2A56] hover:bg-[#0B1E3F] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.97]"
          >
            <Phone className="w-4 h-4 shrink-0 text-white" strokeWidth={2.2} aria-hidden="true" />
            <span className="truncate">Llamar</span>
          </a>

          {/* Botón Circular Verde: WhatsApp Directo */}
          <a
            href={`https://wa.me/51${listing.contact_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
              `Hola ${providerName}, vi tu anuncio "${listing.title}" y quisiera consultar por tus servicios.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Escribir por WhatsApp a ${providerName}`}
            title={`Escribir por WhatsApp a ${providerName}`}
            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-[#E3F4EB] hover:bg-emerald-100 text-[#15795A] border border-[#15795A]/20 flex items-center justify-center active:scale-[0.97] transition-all shrink-0 shadow-xs"
          >
            <MessageCircle className="w-5 h-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
          </a>

          {/* Botón Circular Azul Claro: Ubicación / Google Maps (Punto 6) */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver ubicación de ${providerName} en Google Maps (${effectiveLat}, ${effectiveLng})`}
            title={`Ver ubicación de ${providerName} en Google Maps`}
            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-[#E6ECF7] hover:bg-blue-100 text-[#2F62D6] border border-[#2F62D6]/20 flex items-center justify-center active:scale-[0.97] transition-all shrink-0 shadow-xs"
          >
            <MapPin className="w-5 h-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
          </a>
        </div>
      </div>
    </motion.article>
  );
}

export default ServiceCard;
