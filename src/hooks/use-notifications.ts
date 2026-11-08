'use client';

import { useEffect, useState } from 'react';
import {
  clearAllNotifications,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  type INotificationItem,
} from '@/lib/notifications/notifications-manager';

export function useNotifications() {
  const [notifications, setNotifications] = useState<INotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const refresh = () => {
      setNotifications(getNotifications());
      setUnreadCount(getUnreadCount());
      setIsLoaded(true);
    };

    refresh();

    if (typeof window !== 'undefined') {
      window.addEventListener('redvecina_notifications_updated', refresh);
      window.addEventListener('storage', refresh);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('redvecina_notifications_updated', refresh);
        window.removeEventListener('storage', refresh);
      }
    };
  }, []);

  return {
    notifications,
    unreadCount,
    isLoaded,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  };
}
