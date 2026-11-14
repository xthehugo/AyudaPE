/**
 * @file src/hooks/use-network-sync.ts
 * @description Capa 2 (MOD-05) — Hook Reactivo de Conectividad y Sincronización Bidireccional.
 * Sincroniza automáticamente al recuperar red y emite toast de éxito/error.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  syncManager,
  type SyncManager,
  type SyncManagerState,
} from '@/lib/offline/sync-manager';

export interface UseNetworkSyncReturn extends SyncManagerState {
  triggerSync: () => Promise<{ syncedIds: string[]; failedIds: string[] }>;
  triggerHydration: (sectorId: number) => Promise<void>;
}

export function useNetworkSync(
  defaultSectorId: number = 1,
  manager: SyncManager = syncManager
): UseNetworkSyncReturn {
  const [state, setState] = useState<SyncManagerState>(() => manager.getState());

  const triggerSync = useCallback(async () => {
    return manager.processOutbox();
  }, [manager]);

  const triggerHydration = useCallback(
    async (sectorId: number = defaultSectorId) => {
      await manager.hydrateDownlink(sectorId);
    },
    [defaultSectorId, manager]
  );

  useEffect(() => {
    void manager.refreshPendingCount();

    const unsubscribe = manager.subscribe('state_changed', (nextState) => {
      setState(nextState);
    });

    const handleOnline = () => {
      manager.setOnlineStatus(true);
      // Sincronización automática al recuperar red
      void (async () => {
        try {
          const pending = manager.getState().pendingCount;
          const result = await manager.processOutbox();
          await manager.hydrateDownlink(defaultSectorId);
          // Mostrar toast solo si había pendientes que sincronizar
          if (pending > 0 || result.syncedIds.length > 0) {
            if (result.failedIds.length > 0) {
              toast.warning('Sincronización parcial', {
                description: `${result.syncedIds.length} subido(s), ${result.failedIds.length} con error.`,
                duration: 5000,
              });
            } else {
              toast.success('Sincronización barrial completada', {
                description: `${result.syncedIds.length > 0 ? result.syncedIds.length + ' publicación(es) enviada(s) a la red.' : 'Datos locales actualizados.'}`,
                duration: 4000,
              });
            }
          }
        } catch {
          toast.error('Error de sincronización', {
            description: 'No se pudo conectar con el servidor. Se reintentará automáticamente.',
            duration: 4000,
          });
        }
      })();
    };

    const handleOffline = () => {
      manager.setOnlineStatus(false);
    };

    const handleNetworkSyncEvent = () => {
      setState(manager.getState());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('ayudape_network_changed', handleNetworkSyncEvent);
      window.addEventListener('storage', handleNetworkSyncEvent);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('ayudape_network_changed', handleNetworkSyncEvent);
        window.removeEventListener('storage', handleNetworkSyncEvent);
      }
    };
  }, [defaultSectorId, manager]);

  return {
    ...state,
    triggerSync,
    triggerHydration,
  };
}
