import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { getDniProvider } from '@/server/dni/dni-provider.interface';
import { inMemoryDevices } from '@/server/state/in-memory-state';

/**
 * POST /api/v1/identity/verify-dni
 * Verificación voluntaria de DNI (Ley N° 29733 de Protección de Datos Personales).
 * Compara nombre ingresado contra padrón oficial, genera hash con sal y NUNCA guarda el DNI completo.
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de solicitudes de verificación excedido.', '/api/v1/identity/verify-dni');
  }

  try {
    const body = (await request.json()) as {
      dni?: string;
      dni_number?: string;
      fullName?: string;
      consent?: boolean;
      consent_granted?: boolean;
      device_id?: string;
    };

    const dni = body.dni ?? body.dni_number;
    const fullName = body.fullName;
    const consent = body.consent ?? body.consent_granted;
    const { device_id } = body;

    // Consentimiento expreso de datos personales obligatorio según Ley N° 29733
    if (!consent) {
      return jsonError(
        400,
        'CONSENT_REQUIRED',
        'Se requiere consentimiento explícito para verificar identidad según Ley N° 29733.',
        '/api/v1/identity/verify-dni'
      );
    }

    if (!dni || !/^\d{8}$/.test(dni.trim())) {
      return jsonError(
        400,
        'INVALID_DNI',
        'El DNI debe contener exactamente 8 dígitos.',
        '/api/v1/identity/verify-dni'
      );
    }

    const provider = getDniProvider();
    const result = await provider.validateDni(dni, fullName);

    if (!result.success || !result.verified) {
      return jsonError(
        422,
        'DNI_VERIFICATION_FAILED',
        result.errorMessage || 'No se pudo verificar el DNI en RENIEC. Intenta nuevamente.',
        '/api/v1/identity/verify-dni',
        { dni_hash: result.dniHash, verified: false }
      );
    }

    // Actualizar o crear registro del dispositivo con los datos verificados (enmascarando el DNI)
    if (device_id) {
      const existingDev = inMemoryDevices.get(device_id) ?? {
        device_id,
        public_key: `pub-${device_id.slice(0, 8)}`,
        created_at: new Date().toISOString(),
      };
      existingDev.dni_verified = true;
      existingDev.dni_hash = result.dniHash;
      existingDev.dni_masked = result.dniMasked;
      existingDev.verified_name = result.fullNameFromProvider;
      inMemoryDevices.set(device_id, existingDev);
    }

    return jsonOk({
      verified: true,
      dni_verificado: true,
      full_name: result.fullNameFromProvider,
      dni_masked: result.dniMasked,
      dni_hash: result.dniHash,
      badge: 'Vecino verificado',
      badge_explanation: 'Sus datos de DNI fueron validados en RENIEC.',
    });
  } catch (error) {
    return handleRouteException(error, '/api/v1/identity/verify-dni');
  }
}
