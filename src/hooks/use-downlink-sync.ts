/**
 * @file src/hooks/use-downlink-sync.ts
 * @description Capa 2 (MOD-05) — Hook Reactivo para Carga Inicial desde Dexie.js e Hidratación de Deltas.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  localDb,
  type ICommitmentLocal,
  type IListingLocal,
  type IPostLocal,
  type RedVecinaLocalDB,
} from '@/lib/offline/db';
import { syncManager, type SyncManager } from '@/lib/offline/sync-manager';
import { syncOwnMutationsFromDexie } from '@/lib/ownership';

export interface UseDownlinkSyncReturn {
  listings: IListingLocal[];
  posts: IPostLocal[];
  commitments: ICommitmentLocal[];
  isLoadingLocal: boolean;
  isHydratingRemote: boolean;
  refreshFromLocal: () => Promise<void>;
  syncSectorDelta: () => Promise<void>;
}

export function useDownlinkSync(
  sectorId: number = 1,
  db: RedVecinaLocalDB = localDb,
  manager: SyncManager = syncManager
): UseDownlinkSyncReturn {
  const [listings, setListings] = useState<IListingLocal[]>([]);
  const [posts, setPosts] = useState<IPostLocal[]>([]);
  const [commitments, setCommitments] = useState<ICommitmentLocal[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState<boolean>(true);
  const [isHydratingRemote, setIsHydratingRemote] = useState<boolean>(false);

  const refreshFromLocal = useCallback(async () => {
    setIsLoadingLocal(true);
    try {
      await syncOwnMutationsFromDexie(db);
      const [cachedListings, cachedPosts, cachedCommitments] = await Promise.all([
        db.listings.toArray(),
        db.posts.toArray(),
        db.commitments.toArray(),
      ]);
      setListings(cachedListings);
      setPosts(cachedPosts);
      setCommitments(cachedCommitments);
    } finally {
      setIsLoadingLocal(false);
    }
  }, [db]);

  const syncSectorDelta = useCallback(async () => {
    setIsHydratingRemote(true);
    try {
      const delta = await manager.hydrateDownlink(sectorId);
      if (delta) {
        await refreshFromLocal();
      }
    } finally {
      setIsHydratingRemote(false);
    }
  }, [manager, refreshFromLocal, sectorId]);

  useEffect(() => {
    // Siempre hidratar desde el servidor además de mostrar caché local inmediato,
    // para que las publicaciones guardadas en Supabase (ej. oficio de Lina) siempre aparezcan.
    void refreshFromLocal().then(async () => {
      await syncSectorDelta();
    });

    const unsubDownlink = manager.subscribe('downlink_hydrated', () => {
      void refreshFromLocal();
    });

    const unsubOutbox = manager.subscribe('outbox_synced', () => {
      void refreshFromLocal();
      void syncSectorDelta();
    });

    return () => {
      unsubDownlink();
      unsubOutbox();
    };
  }, [db, manager, refreshFromLocal, syncSectorDelta]);

  return {
    listings,
    posts,
    commitments,
    isLoadingLocal,
    isHydratingRemote,
    refreshFromLocal,
    syncSectorDelta,
  };
}
