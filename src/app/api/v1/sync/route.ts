import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { inMemoryCommitments } from '@/server/state/in-memory-state';

export interface SignedEventBatchItem {
  event_id: string;
  device_id: string;
  signature: string;
  event_type: 'COMMITMENT_CREATED' | 'DELIVERY_DECLARED' | 'RECEIPT_CONFIRMED';
  payload: Record<string, unknown>;
  timestamp: string;
}

const processedEventIds = new Set<string>();

/**
 * POST /api/v1/sync
 * Recibe lotes de eventos firmados desde la cola offline de los dispositivos.
 * Idempotente: deduplica por event_id y resuelve conflictos con marca de tiempo.
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de sincronización excedido.', '/api/v1/sync');
  }

  try {
    const body = (await request.json()) as { events?: SignedEventBatchItem[] };
    const events = body.events ?? [];

    const results: Array<{
      event_id: string;
      status: 'PROCESSED' | 'IGNORED_DUPLICATE' | 'ERROR';
      error?: string;
    }> = [];

    for (const evt of events) {
      if (!evt.event_id) continue;

      // Idempotencia: si ya fue procesado, no repetir
      if (processedEventIds.has(evt.event_id)) {
        results.push({ event_id: evt.event_id, status: 'IGNORED_DUPLICATE' });
        continue;
      }

      try {
        if (evt.event_type === 'DELIVERY_DECLARED') {
          const commitmentId = String(evt.payload.commitment_id);
          const c = inMemoryCommitments.get(commitmentId);
          if (c) {
            c.delivered_by_device_id = evt.device_id;
            if (c.received_by_device_id && c.received_by_device_id !== evt.device_id) {
              c.verification_status = 'confirmado';
              c.confirmed_at = evt.timestamp;
            } else {
              c.verification_status = 'entregado_declarado';
            }
          }
        } else if (evt.event_type === 'RECEIPT_CONFIRMED') {
          const commitmentId = String(evt.payload.commitment_id);
          const c = inMemoryCommitments.get(commitmentId);
          if (c) {
            c.received_by_device_id = evt.device_id;
            if (c.delivered_by_device_id && c.delivered_by_device_id !== evt.device_id) {
              c.verification_status = 'confirmado';
              c.confirmed_at = evt.timestamp;
            } else {
              c.verification_status = 'entregado_declarado';
            }
          }
        }

        processedEventIds.add(evt.event_id);
        results.push({ event_id: evt.event_id, status: 'PROCESSED' });
      } catch (err: any) {
        results.push({
          event_id: evt.event_id,
          status: 'ERROR',
          error: err?.message || 'Error procesando evento',
        });
      }
    }

    return jsonOk({
      total: events.length,
      processed: results.filter((r) => r.status === 'PROCESSED').length,
      ignored_duplicates: results.filter((r) => r.status === 'IGNORED_DUPLICATE').length,
      results,
    });
  } catch (error) {
    return handleRouteException(error, '/api/v1/sync');
  }
}
