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
        bgIcon: 'bg-red-500/20 text-red-500 border-red-500/40',
        badgeColor: 'bg-red-600 text-white',
        badgeText: 'Emergencia SOS',
        borderUnread: 'border-red-500/80 bg-red-950/20',
      };
    case 'MEETING_CONVOKED':
      return {
        icon: Megaphone,
        bgIcon: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
        badgeColor: 'bg-[#0F2A56] text-indigo-200 border border-indigo-400/50',
        badgeText: 'Junta Vecinal',
        borderUnread: 'border-indigo-500/80 bg-indigo-950/20',
      };
    case 'SOLIDARITY_DELIVERED':
      return {
        icon: PackageCheck,
        bgIcon: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        badgeColor: 'bg-amber-500 text-slate-950 font-black',
        badgeText: 'Entrega pendiente',
        borderUnread: 'border-amber-500/80 bg-amber-950/20',
      };
    case 'SOLIDARITY_COMMIT':
      return {
        icon: HandHeart,
        bgIcon: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
        badgeColor: 'bg-sky-700 text-white',
        badgeText: 'Compromiso',
        borderUnread: 'border-sky-500/80 bg-sky-950/20',
      };
    case 'SOLIDARITY_CONFIRMED':
      return {
        icon: CheckCircle2,
        bgIcon: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        badgeColor: 'bg-emerald-700 text-white',
        badgeText: 'Confirmado',
        borderUnread: 'border-emerald-500/80 bg-emerald-950/20',
      };
    case 'LISTING_ENDORSED':
      return {
        icon: Star,
        bgIcon: 'bg-amber-400/20 text-amber-400 border-amber-400/40',
        badgeColor: 'bg-amber-600 text-white',
        badgeText: 'Recomendación',
        borderUnread: 'border-amber-400/80 bg-amber-950/20',
      };
    default:
      return {
        icon: Bell,
        bgIcon: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
        badgeColor: 'bg-slate-700 text-white',
        badgeText: 'Aviso',
        borderUnread: 'border-slate-500/80 bg-slate-900/30',
      };
  }
}

export function NotificationsDrawer({
  isOpen,
  onClose,
}: NotificationsDrawerProps): React.ReactElement | null {
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
        className="w-full max-w-md h-full bg-[#0F172A] text-slate-100 flex flex-col shadow-2xl border-l border-slate-700/80 transform transition-transform animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA */}
        <header className="p-4 border-b border-slate-800 bg-[#141E33] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-900/60 border border-indigo-500/50 flex items-center justify-center text-indigo-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white">Notificaciones</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-red-600 text-white animate-pulse">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">Avisos y estados de tu comunidad</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                title="Marcar todas como leídas"
                aria-label="Marcar todas como leídas"
                className="min-h-[48px] min-w-[44px] h-10 px-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition-all"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Leídas</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAllNotifications}
                title="Vaciar bandeja de notificaciones"
                aria-label="Vaciar bandeja de notificaciones"
                className="min-h-[48px] min-w-[44px] h-10 px-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-950/30 text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar bandeja de notificaciones"
              className="min-h-[48px] min-w-[44px] w-10 h-10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* FILTROS RÁPIDOS */}
        <div className="px-4 py-2.5 border-b border-slate-800/80 bg-[#0F172A] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Todas ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('FAVORES')}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === 'FAVORES'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Favores y Oficios
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('SEGURIDAD')}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === 'SEGURIDAD'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            SOS
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('JUNTAS')}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === 'JUNTAS'
                ? 'bg-[#0F2A56] text-white border border-indigo-400 shadow-xs'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Juntas
          </button>
        </div>

        {/* LISTADO DE NOTIFICACIONES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500">
                <Bell className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-200">Bandeja al día</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
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
                <div
                  key={item.id}
                  className={`relative rounded-2xl border p-3.5 transition-all ${
                    item.isRead
                      ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                      : `bg-[#141C2E] border-2 shadow-md ${visuals.borderUnread}`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${visuals.bgIcon}`}
                    >
                      <VisualIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${visuals.badgeColor}`}
                        >
                          {visuals.badgeText}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <h3
                        className={`text-sm font-black leading-snug tracking-tight ${
                          item.isRead ? 'text-slate-200' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </h3>

                      <p className="text-xs text-slate-300 leading-relaxed break-words">
                        {item.description}
                      </p>

                      {/* Metadatos adicionales de ubicación o detalles */}
                      {item.metadata?.meetingPlace && (
                        <p className="text-[11px] text-indigo-300 font-bold flex items-center gap-1 pt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>Lugar: {item.metadata.meetingPlace}</span>
                          {item.metadata.scheduledTime && (
                            <span className="text-slate-400">· {item.metadata.scheduledTime}</span>
                          )}
                        </p>
                      )}

                      {/* Botón de acción contextual */}
                      <div className="pt-2 flex items-center justify-between gap-2">
                        {item.metadata?.tab && (
                          <button
                            type="button"
                            onClick={() => handleActionClick(item)}
                            className={`min-h-[48px] px-3.5 py-1.5 rounded-xl font-black text-xs inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
                              item.type === 'SOLIDARITY_DELIVERED'
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                                : item.type === 'SOS_ALERT'
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : item.type === 'MEETING_CONVOKED'
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
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
                              className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-xl text-slate-400 hover:text-emerald-400 text-xs font-bold inline-flex items-center justify-center transition-colors"
                            >
                              <CheckCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteNotification(item.id)}
                            aria-label="Eliminar notificación"
                            title="Eliminar notificación"
                            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-xl text-slate-500 hover:text-red-400 text-xs font-bold inline-flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsDrawer;
