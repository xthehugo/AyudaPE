import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addNotification,
  clearAllNotifications,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '../src/lib/notifications/notifications-manager';

describe('Sistema de Notificaciones Vecinales (NotificationsManager)', () => {
  beforeEach(() => {
    clearAllNotifications();
  });

  it('inicia con una bandeja vacía y conteo 0', () => {
    expect(getNotifications()).toEqual([]);
    expect(getUnreadCount()).toBe(0);
  });

  it('agrega una notificación de compromiso solidario y cuenta como no leída', () => {
    const item = addNotification({
      type: 'SOLIDARITY_COMMIT',
      title: '🤝 ¡Un vecino se comprometió con tu pedido!',
      description: 'Alguien va en camino para apoyar en tu solicitud de víveres.',
      priority: 'NORMAL',
      metadata: {
        client_mutation_id: 'post-123',
        tab: 'MURO',
        actionLabel: 'Ver mi solicitud',
      },
    });

    expect(item.id).toBeDefined();
    expect(item.isRead).toBe(false);
    expect(getUnreadCount()).toBe(1);

    const list = getNotifications();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('🤝 ¡Un vecino se comprometió con tu pedido!');
  });

  it('marca una notificación como leída correctamente', () => {
    addNotification({
      id: 'notif-1',
      type: 'SOLIDARITY_DELIVERED',
      title: '📦 ¡Ayuda marcada como ENTREGADA!',
      description: 'Por favor confirma la entrega recibida.',
      priority: 'HIGH',
    });

    addNotification({
      id: 'notif-2',
      type: 'LISTING_ENDORSED',
      title: '⭐ ¡Recomendación recibida!',
      description: 'Un vecino recomendó tu oficio.',
      priority: 'NORMAL',
    });

    expect(getUnreadCount()).toBe(2);

    markAsRead('notif-1');
    expect(getUnreadCount()).toBe(1);

    const list = getNotifications();
    const found1 = list.find((n) => n.id === 'notif-1');
    const found2 = list.find((n) => n.id === 'notif-2');
    expect(found1?.isRead).toBe(true);
    expect(found2?.isRead).toBe(false);
  });

  it('marca todas las notificaciones como leídas', () => {
    addNotification({
      id: 'notif-a',
      type: 'MEETING_CONVOKED',
      title: '📢 Junta Vecinal en el Parque',
      description: 'Reunión de seguridad hoy a las 6pm',
      priority: 'HIGH',
    });
    addNotification({
      id: 'notif-b',
      type: 'SOS_ALERT',
      title: '🚨 Emergencia SOS Vecinal',
      description: 'Caída de bicicleta en Jr. Sucre',
      priority: 'CRITICAL',
    });

    expect(getUnreadCount()).toBe(2);

    markAllAsRead();
    expect(getUnreadCount()).toBe(0);

    const list = getNotifications();
    expect(list.every((n) => n.isRead)).toBe(true);
  });

  it('elimina una notificación individual por ID', () => {
    addNotification({
      id: 'del-target',
      type: 'SOLIDARITY_CONFIRMED',
      title: '✅ Entrega completada',
      description: 'Gracias por apoyar',
      priority: 'NORMAL',
    });

    expect(getNotifications()).toHaveLength(1);

    deleteNotification('del-target');
    expect(getNotifications()).toHaveLength(0);
    expect(getUnreadCount()).toBe(0);
  });

  it('deduplica notificaciones con el mismo id actualizando los datos', () => {
    addNotification({
      id: 'dedup-test',
      type: 'SOLIDARITY_COMMIT',
      title: 'Primer título',
      description: 'Primera descripción',
      priority: 'NORMAL',
    });

    addNotification({
      id: 'dedup-test',
      type: 'SOLIDARITY_COMMIT',
      title: 'Título actualizado',
      description: 'Descripción actualizada',
      priority: 'NORMAL',
    });

    const list = getNotifications();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Título actualizado');
  });

  it('despacha el evento personalizado redvecina_notifications_updated si window está presente', () => {
    const mockDispatch = vi.fn();
    (globalThis as any).window = {
      dispatchEvent: mockDispatch,
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
    };
    (globalThis as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params: any) {
        this.type = type;
        this.detail = params?.detail;
      }
    };

    addNotification({
      id: 'event-test',
      type: 'SOS_ALERT',
      title: 'Alerta de prueba',
      description: 'Test event',
      priority: 'CRITICAL',
    });

    expect(mockDispatch).toHaveBeenCalled();

    delete (globalThis as any).window;
    delete (globalThis as any).CustomEvent;
  });
});
