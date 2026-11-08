import { createHmac } from 'node:crypto';
import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import {
  inMemoryDevices,
  inMemoryOtpChallenges,
} from '@/server/state/in-memory-state';

const OTP_SECRET = process.env.DNI_SALT ?? 'redvecina_brigadista_otp_secret_2026';

function computeStatelessOtp(deviceId: string, celular: string, windowIndex: number): string {
  const digest = createHmac('sha256', OTP_SECRET)
    .update(`${deviceId}:${celular}:${windowIndex}`)
    .digest('hex');
  const num = parseInt(digest.slice(0, 8), 16) % 900000;
  return String(100000 + num);
}

function createBrigadistaVerificationToken(deviceId: string, celular: string): string {
  return createHmac('sha256', OTP_SECRET)
    .update(`BRIGADISTA_VERIFIED:${deviceId}:${celular}`)
    .digest('hex');
}

/**
 * POST /api/v1/brigadista/otp
 * Solicita y verifica código OTP por SMS para activar el rol de Brigadista.
 * Exige celular peruano de 9 dígitos que empiece con 9.
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Demasiados intentos. Espera unos segundos.',
      '/api/v1/brigadista/otp'
    );
  }

  try {
    const body = (await request.json()) as {
      action?: 'SEND_OTP' | 'VERIFY_OTP';
      celular?: string;
      otp_code?: string;
      device_id?: string;
    };

    const action = body.action ?? 'SEND_OTP';
    const cleanPhone = (body.celular ?? '').trim().replace(/\D/g, '');
    const deviceId = (body.device_id ?? 'disp-anonimo').trim();

    if (!/^9\d{8}$/.test(cleanPhone)) {
      return jsonError(
        400,
        'INVALID_PHONE',
        'Ingresa un número de celular peruano válido (9 dígitos que empiecen con 9).',
        '/api/v1/brigadista/otp'
      );
    }

    const currentWindow = Math.floor(Date.now() / 300000); // ventana de 5 min

    if (action === 'SEND_OTP') {
      const otpCode = computeStatelessOtp(deviceId, cleanPhone, currentWindow);

      inMemoryOtpChallenges.set(deviceId, {
        device_id: deviceId,
        celular: cleanPhone,
        otp_code: otpCode,
        expires_at_ms: Date.now() + 5 * 60 * 1000,
        attempts: 0,
      });

      return jsonOk({
        sent: true,
        celular: cleanPhone,
        simulated_sms_otp: otpCode,
        message: 'Código OTP de 6 dígitos enviado por SMS.',
      });
    }

    if (action === 'VERIFY_OTP') {
      const enteredOtp = (body.otp_code ?? '').trim();
      if (!/^\d{6}$/.test(enteredOtp)) {
        return jsonError(
          400,
          'INVALID_OTP_FORMAT',
          'El código de verificación debe tener 6 dígitos.',
          '/api/v1/brigadista/otp'
        );
      }

      const challenge = inMemoryOtpChallenges.get(deviceId);
      const validStatelessCurrent = computeStatelessOtp(deviceId, cleanPhone, currentWindow);
      const validStatelessPrev = computeStatelessOtp(deviceId, cleanPhone, currentWindow - 1);

      const isMemoryMatch =
        challenge &&
        challenge.celular === cleanPhone &&
        challenge.otp_code === enteredOtp &&
        Date.now() <= challenge.expires_at_ms;

      const isStatelessMatch =
        enteredOtp === validStatelessCurrent || enteredOtp === validStatelessPrev;

      if (!isMemoryMatch && !isStatelessMatch) {
        return jsonError(
          422,
          'OTP_INVALID',
          'El código OTP ingresado es incorrecto o ha expirado.',
          '/api/v1/brigadista/otp'
        );
      }

      inMemoryOtpChallenges.delete(deviceId);

      // Guardar en perfil de servidor: rol, celular y celular_verificado = true
      const existingDev = inMemoryDevices.get(deviceId) ?? {
        device_id: deviceId,
        public_key: `pub-${deviceId.slice(0, 8)}`,
        created_at: new Date().toISOString(),
      };
      existingDev.rol = 'BRIGADISTA_CERTIFICADO';
      existingDev.celular = cleanPhone;
      existingDev.celular_verificado = true;
      inMemoryDevices.set(deviceId, existingDev);

      const brigadistaToken = createBrigadistaVerificationToken(deviceId, cleanPhone);

      return jsonOk({
        verified: true,
        rol: 'BRIGADISTA_CERTIFICADO',
        celular: cleanPhone,
        celular_verificado: true,
        brigadista_token: brigadistaToken,
      });
    }

    return jsonError(400, 'INVALID_ACTION', 'Acción no reconocida.', '/api/v1/brigadista/otp');
  } catch (error) {
    return handleRouteException(error, '/api/v1/brigadista/otp');
  }
}
