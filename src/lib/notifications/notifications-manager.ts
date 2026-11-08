/**
 * @file src/lib/notifications/notifications-manager.ts
 * @description Gestor central y reactivo de Notificaciones Vecinales en RedVecina.
 *
 * Registra y distribuye notificaciones en tiempo real para:
 * 1. 🤝 Compromiso Solidario (un vecino se compromete con tu pedido)
 * 2. 📦 Entrega Solidaria (marcado como entregado, pendiente tu confirmación)
 * 3. ✅ Confirmación Recibida (quien pidió confirmó que recibió la ayuda que diste)
 * 4. ⭐ Recomendación de Oficio/Producto (un vecino dio visto bueno a tu publicación)
 * 5. 📢 Junta Vecinal Convocada (aviso zonal de brigadista)
 * 6. 🚨 Alerta SOS Vecinal (emergencia en tu localidad)
 *
 * Incluye:
 * - Persistencia local en localStorage con fallback seguro SSR.
 * - Soporte para respuesta háptica (vibración en móviles compatibles).
 * - Sincronización reactiva mediante el evento 'redvecina_notifications_updated'.
 */

export type NotificationType =
  | 'SOLIDARITY_COMMIT'
  | 'SOLIDARITY_DELIVERED'
  | 'SOLIDARITY_CONFIRMED'
  | 'LISTING_ENDORSED'
  | 'MEETING_CONVOKED'
  | 'SOS_ALERT';

export type NotificationPriority = 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface INotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string; // ISO
  isRead: boolean;
  priority: NotificationPriority;
  metadata?: {
    client_mutation_id?: string;
    tab?: 'MAPA' | 'DIRECTORIO' | 'MURO' | 'COPILOTO';
    lat?: number;
    lng?: number;
    authorName?: string;
    helperName?: string;
    meetingPlace?: string;
    scheduledTime?: string;
    endorsementCount?: number;
    actionLabel?: string;
  };
}

const STORAGE_KEY = 'redvecina_notifications_v1';
const MAX_NOTIFICATIONS = 50;

// Almacén en memoria como respaldo para SSR y suites de prueba en Node.js
let memoryStore: INotificationItem[] = [];

/**
 * Emite una vibración háptica suave en dispositivos móviles compatibles.
 */
export function triggerHapticFeedback(priority: NotificationPriority = 'NORMAL'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') return;

  try {
    if (priority === 'CRITICAL') {
      navigator.vibrate([120, 60, 120, 60, 200]);
    } else if (priority === 'HIGH') {
      navigator.vibrate([100, 50, 100]);
    } else {
      navigator.vibrate([70]);
    }
  } catch {
    // Algunos navegadores bloquean la vibración sin interacción previa
  }
}

/**
 * Lee las notificaciones guardadas en localStorage o memoria.
 */
export function getNotifications(): INotificationItem[] {
  if (typeof window === 'undefined') return [...memoryStore];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...memoryStore];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryStore = parsed;
      return parsed;
    }
    return [...memoryStore];
  } catch {
    return [...memoryStore];
  }
}

/**
 * Obtiene el conteo de notificaciones no leídas.
 */
export function getUnreadCount(): number {
  const list = getNotifications();
  return list.filter((n) => !n.isRead).length;
}

/**
 * Guarda la lista en localStorage y memoria, y despacha el evento reactivo.
 */
function saveAndDispatch(items: INotificationItem[]): void {
  const trimmed = items.slice(0, MAX_NOTIFICATIONS);
  memoryStore = trimmed;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignorar si hay problemas de cuota
    }

    const unreadCount = trimmed.filter((n) => !n.isRead).length;
    window.dispatchEvent(
      new CustomEvent('redvecina_notifications_updated', {
        detail: { notifications: trimmed, unreadCount },
      })
    );
  }
}

/**
 * Agrega una nueva notificación al historial y notifica a los oyentes.
 */
export function addNotification(
  params: Omit<INotificationItem, 'id' | 'timestamp' | 'isRead'> & {
    id?: string;
    timestamp?: string;
    isRead?: boolean;
    preventVibrate?: boolean;
  }
): INotificationItem {
  const current = getNotifications();

  // Deduplicación para evitar registrar múltiples veces el mismo evento idéntico
  const dedupKey = params.id ?? `${params.type}:${params.metadata?.client_mutation_id ?? ''}:${params.title}`;
  const existingIdx = current.findIndex((n) => n.id === dedupKey);

  const newItem: INotificationItem = {
    id: dedupKey,
    type: params.type,
    title: params.title,
    description: params.description,
    timestamp: params.timestamp || new Date().toISOString(),
    isRead: params.isRead ?? false,
    priority: params.priority || 'NORMAL',
    metadata: params.metadata,
  };

  let nextList: INotificationItem[];
  if (existingIdx >= 0) {
    // Actualizar si ya existía para reflejar cambios más recientes
    nextList = [...current];
    nextList[existingIdx] = newItem;
  } else {
    // Insertar al inicio de la lista
    nextList = [newItem, ...current];
  }

  saveAndDispatch(nextList);

  if (!params.preventVibrate) {
    triggerHapticFeedback(newItem.priority);
  }

  return newItem;
}

/**
 * Marca una notificación individual como leída.
 */
export function markAsRead(id: string): void {
  const current = getNotifications();
  let modified = false;
  const nextList = current.map((item) => {
    if (item.id === id && !item.isRead) {
      modified = true;
      return { ...item, isRead: true };
    }
    return item;
  });

  if (modified) {
    saveAndDispatch(nextList);
  }
}

/**
 * Marca todas las notificaciones como leídas.
 */
export function markAllAsRead(): void {
  const current = getNotifications();
  const nextList = current.map((item) => ({ ...item, isRead: true }));
  saveAndDispatch(nextList);
}

/**
 * Elimina una notificación específica.
 */
export function deleteNotification(id: string): void {
  const current = getNotifications();
  const nextList = current.filter((item) => item.id !== id);
  saveAndDispatch(nextList);
}

/**
 * Vacía completamente el historial de notificaciones.
 */
export function clearAllNotifications(): void {
  saveAndDispatch([]);
}
