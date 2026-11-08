import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { inMemoryDevices } from '@/server/state/in-memory-state';

/**
 * POST /api/v1/devices
 * Registra la clave pública y el device_id generado por WebCrypto en el dispositivo anónimo.
 * Cero datos personales requeridos (cumplimiento Ley N° 29733).
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de registro excedido.', '/api/v1/devices');
  }

  try {
    const body = (await request.json()) as { device_id?: string; public_key?: string };
    const { device_id, public_key } = body;

    if (!device_id || typeof device_id !== 'string') {
      return jsonError(400, 'INVALID_DEVICE_ID', 'device_id requerido y debe ser string.', '/api/v1/devices');
    }

    if (!public_key || typeof public_key !== 'string') {
      return jsonError(400, 'INVALID_PUBLIC_KEY', 'public_key requerida (Base64).', '/api/v1/devices');
    }

    const existing = inMemoryDevices.get(device_id);
    if (existing) {
      existing.public_key = public_key;
      return jsonOk({ device: existing, status: 'UPDATED' });
    }

    const record = {
      device_id,
      public_key,
      created_at: new Date().toISOString(),
      dni_verified: false,
    };
    inMemoryDevices.set(device_id, record);

    return jsonOk({ device: record, status: 'REGISTERED' }, undefined, 201);
  } catch (error) {
    return handleRouteException(error, '/api/v1/devices');
  }
}
