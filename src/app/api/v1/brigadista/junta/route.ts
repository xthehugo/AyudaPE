import { createHmac } from 'node:crypto';
import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { inMemoryDevices } from '@/server/state/in-memory-state';

const OTP_SECRET = process.env.DNI_SALT ?? 'redvecina_brigadista_otp_secret_2026';

function verifyBrigadistaVerificationToken(
  deviceId: string,
  celular: string,
  token: string
): boolean {
  if (!deviceId || !celular || !token || !/^9\d{8}$/.test(celular)) return false;
  const expected = createHmac('sha256', OTP_SECRET)
    .update(`BRIGADISTA_VERIFIED:${deviceId}:${celular}`)
    .digest('hex');
  return expected === token;
}

/**
 * POST /api/v1/brigadista/junta
 * Acción protegida de Brigadista: "Reunir / Junta".
 * Valida en el backend que el usuario tenga el rol BRIGADISTA_CERTIFICADO activo y celular_verificado = true.
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/brigadista/junta'
    );
  }

  try {
    const body = (await request.json()) as {
      device_id?: string;
      rol?: string;
      celular?: string;
      celular_verificado?: boolean;
      brigadista_token?: string;
      meeting_point?: string;
      motivo?: string;
      latitude?: number;
      longitude?: number;
    };

    const deviceId = (body.device_id ?? request.headers.get('x-device-id') ?? '').trim();
    const roleHeader = request.headers.get('x-user-role') ?? body.rol;
    const celular = (body.celular ?? '').trim().replace(/\D/g, '');
    const token =
      (body.brigadista_token ?? request.headers.get('x-brigadista-token') ?? '').trim();

    const memoryDevice = deviceId ? inMemoryDevices.get(deviceId) : undefined;
    const isMemoryAuthorized =
      memoryDevice?.rol === 'BRIGADISTA_CERTIFICADO' &&
      memoryDevice?.celular_verificado === true &&
      /^9\d{8}$/.test(memoryDevice.celular ?? '');

    const isTokenAuthorized =
      roleHeader === 'BRIGADISTA_CERTIFICADO' &&
      body.celular_verificado === true &&
      /^9\d{8}$/.test(celular) &&
      verifyBrigadistaVerificationToken(deviceId, celular, token);

    if (!isMemoryAuthorized && !isTokenAuthorized) {
      return jsonError(
        403,
        'FORBIDDEN_BRIGADISTA_REQUIRED',
        'Acceso denegado: Solo usuarios con el rol de Brigadista activo y celular verificado por SMS pueden ejecutar "Reunir / Junta".',
        '/api/v1/brigadista/junta'
      );
    }

    const meetingPoint = (body.meeting_point ?? '').trim() || 'Parque Principal del Sector';
    const motivo = (body.motivo ?? '').trim() || 'Coordinación vecinal y punto de reunión';

    return jsonOk(
      {
        junta_id: `JUNTA-${Date.now()}`,
        status: 'CONVOCADA',
        meeting_point: meetingPoint,
        motivo,
        brigadista_celular: memoryDevice?.celular ?? celular,
        created_at: new Date().toISOString(),
      },
      undefined,
      201
    );
  } catch (error) {
    return handleRouteException(error, '/api/v1/brigadista/junta');
  }
}
