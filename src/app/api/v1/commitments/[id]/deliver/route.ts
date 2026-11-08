import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { inMemoryCommitments } from '@/server/state/in-memory-state';
import { deriveHmac4DigitCode } from '@/lib/crypto/confirmation-protocol';

export interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * POST /api/v1/commitments/:id/deliver
 * El voluntario ingresa el código de 4 dígitos y toca "Ya entregué".
 * Valida el código HMAC y actualiza el estado. Si el solicitante ya tocó "Ya recibí", pasa a "confirmado".
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de solicitudes excedido.', '/api/v1/commitments/:id/deliver');
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const commitmentId = resolvedParams.id;
    const body = (await request.json()) as {
      code?: string;
      device_id?: string;
      signature?: string;
    };

    const commitment = inMemoryCommitments.get(commitmentId);
    if (!commitment) {
      return jsonError(404, 'NOT_FOUND', 'Compromiso no encontrado.', `/api/v1/commitments/${commitmentId}/deliver`);
    }

    const { code, device_id } = body;
    if (!code || !device_id) {
      return jsonError(400, 'INVALID_PAYLOAD', 'Se requieren code y device_id.', `/api/v1/commitments/${commitmentId}/deliver`);
    }

    // Regla anti-abuso 1: Un dispositivo no puede ser solicitante y voluntario al mismo tiempo
    if (device_id === commitment.requester_device_id) {
      return jsonError(
        403,
        'SELF_CONFIRMATION_FORBIDDEN',
        'Un dispositivo no puede confirmar su propio compromiso.',
        `/api/v1/commitments/${commitmentId}/deliver`
      );
    }

    // Regla anti-abuso 2: Bloqueo de 15 minutos tras 5 intentos fallidos
    const now = Date.now();
    if (commitment.locked_until_ms && now < commitment.locked_until_ms) {
      const minutesLeft = Math.ceil((commitment.locked_until_ms - now) / 60000);
      return jsonError(
        429,
        'COMMITMENT_LOCKED',
        `Compromiso bloqueado temporalmente por demasiados intentos. Intenta en ${minutesLeft} min.`,
        `/api/v1/commitments/${commitmentId}/deliver`
      );
    }

    // Validar código HMAC
    const expectedCode = await deriveHmac4DigitCode(commitment.shared_secret, commitment.id, now);
    if (code.trim() !== expectedCode) {
      commitment.failed_attempts = (commitment.failed_attempts || 0) + 1;
      if (commitment.failed_attempts >= 5) {
        commitment.locked_until_ms = now + 15 * 60 * 1000;
        return jsonError(
          429,
          'COMMITMENT_LOCKED',
          'Máximo de 5 intentos superado. Bloqueado por 15 minutos.',
          `/api/v1/commitments/${commitmentId}/deliver`
        );
      }
      return jsonError(
        400,
        'INVALID_CODE',
        `Código incorrecto. Te quedan ${5 - commitment.failed_attempts} intento(s).`,
        `/api/v1/commitments/${commitmentId}/deliver`
      );
    }

    // Código válido
    commitment.failed_attempts = 0;
    commitment.delivered_by_device_id = device_id;

    // Si el solicitante ya tocó "Ya recibí" desde un dispositivo distinto, pasa a confirmado
    if (
      commitment.received_by_device_id &&
      commitment.received_by_device_id !== device_id
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
    return handleRouteException(error, '/api/v1/commitments/:id/deliver');
  }
}
