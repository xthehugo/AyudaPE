'use client';

import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationsDrawer } from './notifications-drawer';

export function FloatingNotificationBell(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, notifications } = useNotifications();

  const hasUnread = unreadCount > 0;
  const hasCritical = notifications.some((n) => !n.isRead && (n.type === 'SOS_ALERT' || n.priority === 'CRITICAL'));

  return (
    <>
      {/* Botón flotante en la misma posición donde estaba Pitch Jurado */}
      <div className="fixed bottom-20 right-3 z-40 sm:bottom-6 sm:right-6 pointer-events-auto flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={
            hasUnread
              ? `Abrir bandeja de notificaciones, ${unreadCount} no leídas`
              : 'Abrir bandeja de notificaciones'
          }
          title={
            hasUnread
              ? `Notificaciones: ${unreadCount} pendientes`
              : 'Bandeja de Notificaciones Vecinales'
          }
          className={`min-h-[48px] min-w-[48px] h-12 px-3 rounded-full flex items-center gap-2 shadow-2xl border-2 transition-all active:scale-95 cursor-pointer ${
            hasCritical
              ? 'bg-red-700 hover:bg-red-600 text-white border-yellow-300 ring-4 ring-red-500/30 animate-bounce'
              : hasUnread
              ? 'bg-[#0F2A56] hover:bg-[#153a77] text-white border-amber-400 ring-2 ring-amber-400/20 shadow-amber-500/10'
              : 'bg-[#1E293B] hover:bg-[#334155] text-slate-200 border-slate-600 hover:border-slate-400'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Bell
              className={`w-5 h-5 shrink-0 ${
                hasCritical
                  ? 'text-yellow-300 animate-pulse'
                  : hasUnread
                  ? 'text-amber-300'
                  : 'text-slate-300'
              }`}
            />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white animate-ping" />
            )}
          </div>

          <span className="font-extrabold text-xs tracking-tight select-none">
            Avisos
          </span>

          {hasUnread ? (
            <span
              className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-black flex items-center justify-center font-mono ${
                hasCritical
                  ? 'bg-yellow-400 text-slate-950 font-black'
                  : 'bg-red-600 text-white'
              }`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Al día" />
          )}
        </button>
      </div>

      {/* Cajón modal / Drawer lateral de Notificaciones */}
      <NotificationsDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default FloatingNotificationBell;
