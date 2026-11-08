import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { inMemoryCommitments } from '@/server/state/in-memory-state';

export interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * POST /api/v1/commitments/:id/receive
 * El solicitante toca "Ya recibí".
 * Si el voluntario ya entregó con código válido desde un dispositivo diferente, pasa a "confirmado".
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de solicitudes excedido.', '/api/v1/commitments/:id/receive');
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const commitmentId = resolvedParams.id;
    const body = (await request.json()) as {
      device_id?: string;
      signature?: string;
    };

    const commitment = inMemoryCommitments.get(commitmentId);
    if (!commitment) {
      return jsonError(404, 'NOT_FOUND', 'Compromiso no encontrado.', `/api/v1/commitments/${commitmentId}/receive`);
    }

    const { device_id } = body;
    if (!device_id) {
      return jsonError(400, 'INVALID_PAYLOAD', 'device_id requerido.', `/api/v1/commitments/${commitmentId}/receive`);
    }

    // Regla anti-abuso: Un dispositivo no puede confirmarse a sí mismo
    if (commitment.delivered_by_device_id && commitment.delivered_by_device_id === device_id) {
      return jsonError(
        403,
        'SELF_CONFIRMATION_FORBIDDEN',
        'Un dispositivo no puede confirmar su propio compromiso.',
        `/api/v1/commitments/${commitmentId}/receive`
      );
    }

    commitment.received_by_device_id = device_id;

    // Si ya fue entregado por el voluntario desde otro dispositivo
    if (
      commitment.delivered_by_device_id &&
      commitment.delivered_by_device_id !== device_id
    ) {
      commitment.verification_status = 'confirmado';
      commitment.confirmed_at = new Date().toISOString();
    } else {
      commitment.verification_status = 'entregado_declarado';
    }

    return jsonOk({
      commitment,
      is_confirmed: commitment.verification_status === 'confirmado',
    });
  } catch (error) {
    return handleRouteException(error, '/api/v1/commitments/:id/receive');
  }
}
