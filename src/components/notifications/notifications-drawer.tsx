'use client';

import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  HandHeart,
  MapPin,
  Megaphone,
  PackageCheck,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  useNotifications,
} from '@/hooks/use-notifications';
import type { INotificationItem, NotificationType } from '@/lib/notifications/notifications-manager';
import { useOperationalMode } from '@/context/mode-context';

export interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Hace un instante';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  } catch {
    return 'Reciente';
  }
}

function getNotificationVisuals(type: NotificationType) {
  switch (type) {
    case 'SOS_ALERT':
      return {
        icon: ShieldAlert,
        bgIcon: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800',
        badgeColor: 'bg-red-600 text-white font-black',
        badgeText: 'Emergencia SOS',
        cardBorder: 'border-red-300 dark:border-red-900/60',
      };
    case 'MEETING_CONVOKED':
      return {
        icon: Megaphone,
        bgIcon: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        badgeColor: 'bg-[#0F2A56] text-white font-extrabold',
        badgeText: 'Junta Vecinal',
        cardBorder: 'border-indigo-200 dark:border-indigo-800',
      };
    case 'SOLIDARITY_DELIVERED':
      return {
        icon: PackageCheck,
        bgIcon: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800',
        badgeColor: 'bg-amber-500 text-slate-950 font-black',
        badgeText: 'Entrega pendiente',
        cardBorder: 'border-amber-200 dark:border-amber-800',
      };
    case 'SOLIDARITY_COMMIT':
      return {
        icon: HandHeart,
        bgIcon: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-400 dark:border-sky-800',
        badgeColor: 'bg-sky-700 text-white font-bold',
        badgeText: 'Compromiso',
        cardBorder: 'border-sky-200 dark:border-sky-800',
      };
    case 'SOLIDARITY_CONFIRMED':
      return {
        icon: CheckCircle2,
        bgIcon: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800',
        badgeColor: 'bg-emerald-700 text-white font-bold',
        badgeText: 'Confirmado',
        cardBorder: 'border-emerald-200 dark:border-emerald-800',
      };
    case 'LISTING_ENDORSED':
      return {
        icon: Star,
        bgIcon: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        badgeColor: 'bg-amber-600 text-white font-bold',
        badgeText: 'Recomendación',
        cardBorder: 'border-amber-200 dark:border-amber-800',
      };
    default:
      return {
        icon: Bell,
        bgIcon: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        badgeColor: 'bg-slate-700 text-white font-bold',
        badgeText: 'Aviso',
        cardBorder: 'border-slate-200 dark:border-slate-700',
      };
  }
}

export function NotificationsDrawer({
  isOpen,
  onClose,
}: NotificationsDrawerProps): React.ReactElement | null {
  const { mode } = useOperationalMode();
  const isEmergencyMode = mode === 'EMERGENCIA';

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FAVORES' | 'SEGURIDAD' | 'JUNTAS'>('ALL');

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'FAVORES') {
      return (
        item.type === 'SOLIDARITY_COMMIT' ||
        item.type === 'SOLIDARITY_DELIVERED' ||
        item.type === 'SOLIDARITY_CONFIRMED' ||
        item.type === 'LISTING_ENDORSED'
      );
    }
    if (activeFilter === 'SEGURIDAD') {
      return item.type === 'SOS_ALERT';
    }
    if (activeFilter === 'JUNTAS') {
      return item.type === 'MEETING_CONVOKED';
    }
    return true;
  });

  const handleActionClick = (item: INotificationItem) => {
    markAsRead(item.id);
    onClose();

    const meta = item.metadata;
    if (!meta) return;

    if (meta.tab === 'MAPA' && meta.lat !== undefined && meta.lng !== undefined) {
      window.dispatchEvent(
        new CustomEvent('redvecina_focus_map_coords', {
          detail: { lat: meta.lat, lng: meta.lng, timestamp: Date.now() },
        })
      );
    }

    if (meta.tab) {
      window.dispatchEvent(
        new CustomEvent('redvecina_change_tab', {
          detail: {
            tab: meta.tab,
            focusedCoords:
              meta.lat !== undefined && meta.lng !== undefined
                ? { lat: meta.lat, lng: meta.lng }
                : undefined,
            client_mutation_id: meta.client_mutation_id,
          },
        })
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bandeja de Notificaciones Vecinales"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md h-full flex flex-col shadow-2xl border-l transform transition-transform animate-in slide-in-from-right duration-300 ${
          isEmergencyMode
            ? 'bg-[#0B101B] text-white border-[#FDE047]/70'
            : 'bg-[#F8FAFC] dark:bg-[#0B132B] text-[#0B1E3F] dark:text-slate-100 border-slate-200/80 dark:border-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA (Estilo AyudaPE) */}
        <header
          className={`p-4 border-b flex items-center justify-between shrink-0 shadow-xs ${
            isEmergencyMode
              ? 'bg-[#1E2636] border-[#FDE047]/60 text-white'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-[#0B1E3F] dark:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${
                isEmergencyMode
                  ? 'bg-[#991B1B] text-[#FDE047] border border-[#FDE047]'
                  : 'bg-[#0F2A56] text-white'
              }`}
            >
              {isEmergencyMode ? <ShieldAlert className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">Notificaciones</h2>
                {isEmergencyMode ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#991B1B] text-[#FDE047] border border-[#FDE047] animate-pulse">
                    🚨 MODO SOS
                  </span>
                ) : (
                  unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-red-600 text-white animate-pulse">
                      {unreadCount} nuevas
                    </span>
                  )
                )}
              </div>
              <p
                className={`text-xs font-semibold ${
                  isEmergencyMode ? 'text-[#FDE047]' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isEmergencyMode ? 'Alertas críticas y respuesta vecinal' : 'Avisos y estados de tu comunidad'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                title="Marcar todas como leídas"
                aria-label="Marcar todas como leídas"
                className="min-h-[48px] min-w-[44px] h-10 px-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[#0F2A56] hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Leídas</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAllNotifications}
                title="Vaciar bandeja de notificaciones"
                aria-label="Vaciar bandeja de notificaciones"
                className="min-h-[48px] min-w-[44px] w-10 h-10 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar bandeja de notificaciones"
              className={`min-h-[48px] min-w-[44px] w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
                isEmergencyMode
                  ? 'text-[#FDE047] hover:bg-white/10'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* FILTROS RÁPIDOS EN PÍLDORAS SEGMENTADAS */}
        <div
          className={`px-4 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 ${
            isEmergencyMode
              ? 'bg-[#141A24] border-[#FDE047]/30'
              : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'ALL'
                ? isEmergencyMode
                  ? 'bg-[#FDE047] text-[#450A0A] font-black shadow-xs'
                  : 'bg-[#0F2A56] text-white shadow-xs'
                : isEmergencyMode
                ? 'bg-[#1E2636] text-slate-300 hover:text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Todas ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('FAVORES')}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'FAVORES'
                ? isEmergencyMode
                  ? 'bg-emerald-600 text-white font-black shadow-xs'
                  : 'bg-[#0F2A56] text-white shadow-xs'
                : isEmergencyMode
                ? 'bg-[#1E2636] text-slate-300 hover:text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Favores y Oficios
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('SEGURIDAD')}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'SEGURIDAD'
                ? 'bg-red-600 text-white font-black shadow-xs border border-red-400'
                : isEmergencyMode
                ? 'bg-[#1E2636] text-red-400 hover:text-red-300 border border-red-900/60'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            SOS
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('JUNTAS')}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'JUNTAS'
                ? isEmergencyMode
                  ? 'bg-emerald-700 text-white font-black shadow-xs'
                  : 'bg-[#0F2A56] text-white shadow-xs'
                : isEmergencyMode
                ? 'bg-[#1E2636] text-slate-300 hover:text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Juntas
          </button>
        </div>

        {/* LISTADO DE NOTIFICACIONES (Tarjetas Estilo Página) */}
        <div
          className={`flex-1 overflow-y-auto p-4 space-y-3 ${
            isEmergencyMode ? 'bg-[#0B101B]' : 'bg-slate-50/70 dark:bg-[#0B132B]'
          }`}
        >
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isEmergencyMode
                    ? 'bg-[#1E2636] border-2 border-[#FDE047] text-[#FDE047]'
                    : 'bg-sky-50 dark:bg-slate-800 border border-sky-100 dark:border-slate-700 text-[#0F2A56] dark:text-sky-300'
                }`}
              >
                <Bell className="w-8 h-8 stroke-[1.8]" />
              </div>
              <div className="space-y-1">
                <p
                  className={`text-base font-black ${
                    isEmergencyMode ? 'text-[#FDE047]' : 'text-[#0B1E3F] dark:text-white'
                  }`}
                >
                  Bandeja al día
                </p>
                <p
                  className={`text-xs max-w-xs leading-relaxed font-semibold ${
                    isEmergencyMode ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {activeFilter === 'ALL'
                    ? 'Aquí verás compromisos en tus publicaciones, confirmaciones de entrega, recomendaciones de oficios, juntas vecinales y alertas SOS.'
                    : 'No hay notificaciones en este filtro.'}
                </p>
              </div>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const visuals = getNotificationVisuals(item.type);
              const VisualIcon = visuals.icon;

              return (
                <article
                  key={item.id}
                  className={`relative rounded-[22px] p-4 transition-all shadow-card-diffuse border ${
                    item.isRead
                      ? 'bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      : `bg-white dark:bg-slate-900 border-2 ${visuals.cardBorder} text-[#0B1E3F] dark:text-white`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${visuals.bgIcon}`}
                    >
                      <VisualIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${visuals.badgeColor}`}
                        >
                          {visuals.badgeText}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <h3
                        className={`text-sm font-black leading-snug tracking-tight ${
                          item.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-[#0B1E3F] dark:text-white'
                        }`}
                      >
                        {item.title}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words font-medium">
                        {item.description}
                      </p>

                      {/* Metadatos adicionales de ubicación o detalles */}
                      {item.metadata?.meetingPlace && (
                        <p className="text-[11px] text-[#0F2A56] dark:text-sky-300 font-bold flex items-center gap-1 pt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>Lugar: {item.metadata.meetingPlace}</span>
                          {item.metadata.scheduledTime && (
                            <span className="text-slate-400 font-normal">· {item.metadata.scheduledTime}</span>
                          )}
                        </p>
                      )}

                      {/* Botón de acción contextual */}
                      <div className="pt-2 flex items-center justify-between gap-2">
                        {item.metadata?.tab && (
                          <button
                            type="button"
                            onClick={() => handleActionClick(item)}
                            className={`min-h-[48px] px-4 py-1.5 rounded-full font-black text-xs inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer ${
                              item.type === 'SOLIDARITY_DELIVERED'
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                                : item.type === 'SOS_ALERT'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : item.type === 'MEETING_CONVOKED'
                                ? 'bg-[#0F2A56] hover:bg-[#0B1E3F] text-white'
                                : 'bg-[#0F2A56] hover:bg-[#0B1E3F] text-white'
                            }`}
                          >
                            <span>
                              {item.metadata.actionLabel ||
                                (item.type === 'SOLIDARITY_DELIVERED'
                                  ? 'Confirmar entrega recibida'
                                  : item.type === 'MEETING_CONVOKED'
                                  ? 'Ver junta en mapa'
                                  : item.type === 'SOS_ALERT'
                                  ? 'Ver emergencia en mapa'
                                  : 'Ver publicación')}
                            </span>
                          </button>
                        )}

                        <div className="flex items-center gap-1 ml-auto">
                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={() => markAsRead(item.id)}
                              aria-label="Marcar como leída"
                              title="Marcar como leída"
                              className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full text-slate-400 hover:text-emerald-600 text-xs font-bold inline-flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <CheckCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteNotification(item.id)}
                            aria-label="Eliminar notificación"
                            title="Eliminar notificación"
                            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full text-slate-400 hover:text-red-500 text-xs font-bold inline-flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsDrawer;
