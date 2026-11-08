import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { inMemoryCommitments, type P2PCommitmentRecord } from '@/server/state/in-memory-state';
import { generateSharedSecret } from '@/lib/crypto/confirmation-protocol';

/**
 * POST /api/v1/commitments
 * Crea un compromiso de recurso/ayuda generando el secreto compartido P2P.
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de solicitudes excedido.', '/api/v1/commitments');
  }

  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const commitmentId = String(rawBody.client_mutation_id || crypto.randomUUID());
    const requesterDeviceId = String(rawBody.requester_device_id || 'requester-device-seed');
    const helperDeviceId = String(rawBody.helper_device_id || 'helper-device-seed');

    // Regla anti-abuso: Dispositivo no puede comprometerse consigo mismo si se proveen ambos
    if (requesterDeviceId && helperDeviceId && requesterDeviceId === helperDeviceId) {
      return jsonError(
        400,
        'SELF_COMMITMENT_NOT_ALLOWED',
        'Un dispositivo no puede comprometerse a sí mismo.',
        '/api/v1/commitments'
      );
    }

    const sharedSecret = generateSharedSecret();

    const record: P2PCommitmentRecord = {
      id: commitmentId,
      post_id: rawBody.post_id ? Number(rawBody.post_id) : undefined,
      post_client_mutation_id: String(rawBody.post_client_mutation_id || ''),
      resource_item_id: rawBody.resource_item_id ? Number(rawBody.resource_item_id) : undefined,
      committed_quantity: Number(rawBody.committed_quantity || 1),
      commitment_note: String(rawBody.commitment_note || 'Compromiso voluntario vecinal'),
      status: 'EN_CAMINO',
      verification_status: 'comprometido',
      shared_secret: sharedSecret,
      requester_device_id: requesterDeviceId,
      helper_device_id: helperDeviceId,
      created_at: new Date().toISOString(),
      failed_attempts: 0,
    };

    inMemoryCommitments.set(commitmentId, record);

    return jsonOk({ commitment: record }, undefined, 201);
  } catch (error) {
    return handleRouteException(error, '/api/v1/commitments');
  }
}
