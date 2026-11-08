'use client';

import React, { useMemo, useState } from 'react';
import {
  Clock,
  Flag,
  MapPin,
  Navigation,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { NeighborhoodMeeting } from '@/server/meetings/types';
import { calculateDistanceMeters, formatDistance } from '@/lib/geo-utils';
import { getOrCreateDeviceId } from '@/lib/ownership';
import { cancelMeeting, reportMeeting } from '@/lib/meetings/meetings-client';

export interface MeetingCardModalProps {
  meeting: NeighborhoodMeeting | null;
  isOpen: boolean;
  onClose: () => void;
  userLat?: number;
  userLng?: number;
  onMeetingCancelled?: (meetingId: string) => void;
  onMeetingReported?: (meetingId: string, hidden: boolean) => void;
}

export function MeetingCardModal({
  meeting,
  isOpen,
  onClose,
  userLat = -12.0528,
  userLng = -75.2155,
  onMeetingCancelled,
  onMeetingReported,
}: MeetingCardModalProps): React.ReactElement | null {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  const myDeviceId = getOrCreateDeviceId();
  const isAuthor = Boolean(
    meeting &&
      meeting.brigadista_device_id &&
      meeting.brigadista_device_id === myDeviceId
  );

  const distanceMeters = useMemo(() => {
    if (!meeting) return 0;
    return calculateDistanceMeters(userLat, userLng, meeting.meeting_lat, meeting.meeting_lng);
  }, [meeting, userLat, userLng]);

  if (!isOpen || !meeting) return null;

  const handleCancel = async () => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta junta vecinal?')) return;
    setIsCancelling(true);
    try {
      await cancelMeeting(meeting.id);
      toast.success('Junta vecinal cancelada');
      onMeetingCancelled?.(meeting.id);
      onClose();
    } catch {
      toast.error('No se pudo cancelar la junta');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReport = async () => {
    setIsReporting(true);
    try {
      const res = await reportMeeting(meeting.id);
      if (res.hidden) {
        toast.info('Junta reportada y ocultada', {
          description: 'Recibió 3 reportes vecinales y pasó a revisión del administrador de zona.',
        });
        onMeetingReported?.(meeting.id, true);
        onClose();
      } else {
        toast.success('Reporte enviado a la moderación de zona.');
        onMeetingReported?.(meeting.id, false);
      }
    } catch {
      toast.error('Error al registrar reporte.');
    } finally {
      setIsReporting(false);
    }
  };

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${meeting.meeting_lat},${meeting.meeting_lng}&travelmode=walking`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-card-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#0F172A] text-[#0B1E3F] dark:text-white shadow-2xl border-2 border-[#0F2A56] p-5 space-y-4"
      >
        {/* Encabezado con pin representativo */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#0F2A56] border-2 border-white shadow-md flex items-center justify-center text-amber-300 shrink-0">
              <Users className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="rounded-full bg-[#E6ECF7] text-[#0F2A56] text-[10px] font-black px-2.5 py-0.5 uppercase tracking-wider">
                  Junta Vecinal
                </span>
                {isAuthor && (
                  <span className="rounded-full bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5">
                    Tu convocatoria
                  </span>
                )}
              </div>
              <h3 id="meeting-card-title" className="text-base font-black truncate mt-0.5">
                {meeting.meeting_place_name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tarjeta de junta"
            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Motivo */}
        <div className="p-3 rounded-2xl bg-[#F4F5F7] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#5B6068] dark:text-slate-400">
            Motivo de la convocatoria:
          </span>
          <p className="text-xs sm:text-sm font-bold text-[#0B1E3F] dark:text-slate-100 leading-snug">
            {meeting.motive}
          </p>
        </div>

        {/* Hora y Distancia */}
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2F62D6] shrink-0" />
            <span className="truncate">{meeting.scheduled_time}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#15795A] shrink-0" />
            <span className="truncate">a {formatDistance(distanceMeters)}</span>
          </div>
        </div>

        {/* Referencia opcional */}
        {meeting.reference_note && (
          <p className="text-xs font-semibold text-[#5B6068] dark:text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#2F62D6] shrink-0" />
            <span>Ref: {meeting.reference_note}</span>
          </p>
        )}

        <div className="text-[11px] text-[#5B6068] dark:text-slate-400 font-medium">
          Convocado por: <strong>{meeting.brigadista_name || 'Brigadista Barrial'}</strong>
        </div>

        {/* Botonera de acciones */}
        <div className="flex flex-col gap-2 pt-1">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] h-12 w-full rounded-full bg-[#0F2A56] hover:bg-[#0B1E3F] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-amber-300" />
            <span>Cómo llegar (Google Maps)</span>
          </a>

          <div className="flex items-center gap-2">
            {/* Si es el brigadista autor ve "Cancelar junta" */}
            {isAuthor ? (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex-1 min-h-[48px] h-12 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isCancelling ? 'Cancelando...' : 'Cancelar junta'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReport}
                disabled={isReporting}
                aria-label="Reportar junta"
                className="flex-1 min-h-[48px] h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-[#5B6068] dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs inline-flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Reportar junta</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] h-12 px-4 rounded-full bg-slate-100 dark:bg-slate-800 text-[#0B1E3F] dark:text-slate-300 font-bold text-xs active:scale-95 transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MeetingCardModal;
