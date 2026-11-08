/**
 * @file src/lib/offline/db.ts
 * @description Capa 2 (MOD-04) — Almacén Local en IndexedDB con Dexie.js y Cola Outbox Transaccional.
 * Garantiza operación 100% Offline-First sin bloqueo del hilo principal y con Optimistic UI.
 */

import Dexie, { type Table } from 'dexie';
import type {
  ICommitmentLocal,
  IListingLocal,
  IOutboxMutation,
  IPostLocal,
  OutboxHttpMethod,
} from '@shared/types';

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class RedVecinaLocalDB extends Dexie {
  listings!: Table<IListingLocal, number>;
  posts!: Table<IPostLocal, number>;
  commitments!: Table<ICommitmentLocal, number>;
  outbox!: Table<IOutboxMutation, number>;

  constructor(databaseName: string = 'RedVecinaLocalDB') {
    super(databaseName);

    this.version(1).stores({
      listings:
        '++id, &client_mutation_id, category_id, listing_type, available_for_emergencies, weighted_trust_score',
      posts:
        '++id, &client_mutation_id, operational_mode, post_type, urgency_level, status, client_created_at',
      commitments:
        '++id, &client_mutation_id, post_id, post_client_mutation_id, resource_item_id, status',
      outbox: '++local_id, &client_mutation_id, status, created_at',
    });
  }

  /**
   * Encola una mutación en la tabla `outbox` para sincronización diferida (Transactional Outbox Pattern).
   * Si el payload ya incluye un `client_mutation_id` válido, lo preserva para mantener trazabilidad 1:1.
   */
  async enqueueMutation(
    endpoint: string,
    http_method: OutboxHttpMethod,
    payload: Record<string, unknown>
  ): Promise<string> {
    const existingId =
      typeof payload.client_mutation_id === 'string' && payload.client_mutation_id.length > 0
        ? payload.client_mutation_id
        : generateUuidV4();

    const mutationRecord: IOutboxMutation = {
      client_mutation_id: existingId,
      endpoint,
      http_method,
      payload: {
        ...payload,
        client_mutation_id: existingId,
      },
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'PENDING',
    };

    await this.outbox.put(mutationRecord);
    return existingId;
  }

  /**
   * Devuelve todas las mutaciones pendientes (`PENDING` o `FAILED` reintentables) ordenadas FIFO por `created_at ASC`.
   */
  async getPendingMutations(): Promise<IOutboxMutation[]> {
    const pending = await this.outbox
      .where('status')
      .anyOf(['PENDING', 'FAILED'])
      .sortBy('created_at');
    return pending;
  }

  /**
   * Marca una mutación de la cola `outbox` como `SYNCED` y actualiza el flag `is_pending_sync = false`
   * en las colecciones locales correspondientes dentro de una única transacción IndexedDB.
   */
  async markMutationSynced(client_mutation_id: string): Promise<void> {
    await this.transaction(
      'rw',
      [this.outbox, this.listings, this.posts, this.commitments],
      async () => {
        const outboxItem = await this.outbox
          .where('client_mutation_id')
          .equals(client_mutation_id)
          .first();

        if (outboxItem?.local_id !== undefined) {
          await this.outbox.update(outboxItem.local_id, {
            status: 'SYNCED',
            error_message: undefined,
          });
        }

        const listing = await this.listings
          .where('client_mutation_id')
          .equals(client_mutation_id)
          .first();
        if (listing?.id !== undefined) {
          await this.listings.update(listing.id, { is_pending_sync: false });
        }

        const post = await this.posts
          .where('client_mutation_id')
          .equals(client_mutation_id)
          .first();
        if (post?.id !== undefined) {
          await this.posts.update(post.id, { is_pending_sync: false });
        }

        const commitment = await this.commitments
          .where('client_mutation_id')
          .equals(client_mutation_id)
          .first();
        if (commitment?.id !== undefined) {
          await this.commitments.update(commitment.id, { is_pending_sync: false });
        }
      }
    );
  }

  /**
   * Registra un fallo de red o validación sobre una mutación incrementando `retry_count`.
   */
  async markMutationFailed(client_mutation_id: string, errorMessage: string): Promise<void> {
    const outboxItem = await this.outbox
      .where('client_mutation_id')
      .equals(client_mutation_id)
      .first();

    if (outboxItem?.local_id !== undefined) {
      await this.outbox.update(outboxItem.local_id, {
        status: 'FAILED',
        retry_count: outboxItem.retry_count + 1,
        error_message: errorMessage,
      });
    }
  }

  /**
   * Refresca masivamente el caché local de Oficios, Productos y Soporte del sector (Upsert por `client_mutation_id`).
   */
  async bulkCacheListings(items: IListingLocal[]): Promise<void> {
    if (items.length === 0) return;
    await this.transaction('rw', this.listings, async () => {
      for (const item of items) {
        const existing = await this.listings
          .where('client_mutation_id')
          .equals(item.client_mutation_id)
          .first();
        await this.listings.put({
          ...item,
          id: item.id ?? existing?.id,
        });
      }
    });
  }

  /**
   * Refresca masivamente el caché local de Publicaciones del Muro Solidario y Tablero SOS.
   */
  async bulkCachePosts(items: IPostLocal[]): Promise<void> {
    if (items.length === 0) return;
    await this.transaction('rw', this.posts, async () => {
      for (const item of items) {
        const existing = await this.posts
          .where('client_mutation_id')
          .equals(item.client_mutation_id)
          .first();
        await this.posts.put({
          ...item,
          id: item.id ?? existing?.id,
        });
      }
    });
  }

  /**
   * Refresca masivamente el caché local de Compromisos de Recursos y Ayuda Vecinal.
   */
  async bulkCacheCommitments(items: ICommitmentLocal[]): Promise<void> {
    if (items.length === 0) return;
    await this.transaction('rw', this.commitments, async () => {
      for (const item of items) {
        const existing = await this.commitments
          .where('client_mutation_id')
          .equals(item.client_mutation_id)
          .first();
        await this.commitments.put({
          ...item,
          id: item.id ?? existing?.id,
        });
      }
    });
  }
}

export const localDb = new RedVecinaLocalDB();
export type { ICommitmentLocal, IListingLocal, IOutboxMutation, IPostLocal };
