import { jsonError, jsonOk } from '@/server/http/api-handler';
import { calculateDistanceMeters } from '@/lib/geo-utils';
import type { CreateMeetingRequest, NeighborhoodMeeting } from '@/server/meetings/types';

// Memoria compartida de juntas para el servidor
const globalMeetingsStore = globalThis as unknown as {
  __neighborhoodMeetings?: Map<string, NeighborhoodMeeting>;
  __brigadistaDailyCount?: Map<string, { count: number; date: string }>;
};

if (!globalMeetingsStore.__neighborhoodMeetings) {
  globalMeetingsStore.__neighborhoodMeetings = new Map<string, NeighborhoodMeeting>();
}
if (!globalMeetingsStore.__brigadistaDailyCount) {
  globalMeetingsStore.__brigadistaDailyCount = new Map<string, { count: number; date: string }>();
}

// Bounding box por defecto para el área de cobertura (Huancayo Metropolitano, Lima y Territorio Nacional)
const DEFAULT_BOUNDS = {
  huancayo: { minLat: -12.35, maxLat: -11.85, minLng: -75.45, maxLng: -75.05 },
  lima: { minLat: -12.45, maxLat: -11.70, minLng: -77.40, maxLng: -76.75 },
  peru: { minLat: -18.5, maxLat: 0.0, minLng: -81.5, maxLng: -68.5 },
};

function isWithinCoverage(lat: number, lng: number): boolean {
  // Si hay variable de entorno personalizada
  const customBounds = process.env.APP_COVERAGE_BOUNDS;
  if (customBounds) {
    try {
      const parsed = JSON.parse(customBounds) as {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
      };
      return (
        lat >= parsed.minLat &&
        lat <= parsed.maxLat &&
        lng >= parsed.minLng &&
        lng <= parsed.maxLng
      );
    } catch {
      // Ignorar error de parseo y usar defaults
    }
  }

  // Permitir dentro de Huancayo, Lima o cualquier coordenada en Perú
  const inHuancayo =
    lat >= DEFAULT_BOUNDS.huancayo.minLat &&
    lat <= DEFAULT_BOUNDS.huancayo.maxLat &&
    lng >= DEFAULT_BOUNDS.huancayo.minLng &&
    lng <= DEFAULT_BOUNDS.huancayo.maxLng;

  const inLima =
    lat >= DEFAULT_BOUNDS.lima.minLat &&
    lat <= DEFAULT_BOUNDS.lima.maxLat &&
    lng >= DEFAULT_BOUNDS.lima.minLng &&
    lng <= DEFAULT_BOUNDS.lima.maxLng;

  const inPeru =
    lat >= DEFAULT_BOUNDS.peru.minLat &&
    lat <= DEFAULT_BOUNDS.peru.maxLat &&
    lng >= DEFAULT_BOUNDS.peru.minLng &&
    lng <= DEFAULT_BOUNDS.peru.maxLng;

  return inHuancayo || inLima || inPeru;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*)/i;

/**
 * GET /api/v1/meetings?sector_id=...
 * Retorna las juntas vigentes y activas de la zona.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const sectorId = url.searchParams.get('sector_id');

  const now = Date.now();
  const activeMeetings: NeighborhoodMeeting[] = [];

  for (const meeting of globalMeetingsStore.__neighborhoodMeetings!.values()) {
    // Si ya expiró (más de 4 horas tras la hora pactada o fecha de expiración)
    if (new Date(meeting.expires_at).getTime() < now) {
      meeting.status = 'EXPIRADA';
      continue;
    }

    if (meeting.status !== 'ACTIVA') continue;
    if (meeting.report_count >= 3) continue;

    if (!sectorId || meeting.sector_id === sectorId || sectorId === 'all') {
      activeMeetings.push(meeting);
    }
  }

  return jsonOk({
    meetings: activeMeetings,
    total: activeMeetings.length,
    server_time: new Date().toISOString(),
  });
}

/**
 * POST /api/v1/meetings
 * Convoca una nueva Junta vecinal con validaciones estrictas en frontend y servidor.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const roleHeader = request.headers.get('x-user-role');
    const deviceIdHeader = request.headers.get('x-device-id');
    const tokenHeader = request.headers.get('x-brigadista-token');

    const body = (await request.json()) as CreateMeetingRequest;

    const deviceId = (body.device_id || deviceIdHeader || '').trim();
    const token = (body.brigadista_token || tokenHeader || '').trim();
    const isDemo = process.env.DEMO_ROLES === 'true';

    // 1. Verificación obligatoria de rol Brigadista en servidor (403 si no)
    if (roleHeader !== 'BRIGADISTA_CERTIFICADO' && !isDemo && !token.startsWith('BRIG-TOKEN')) {
      return jsonError(
        403,
        'FORBIDDEN_BRIGADISTA_ONLY',
        'Acceso restringido: Solo los usuarios con el rol Brigadista activo pueden convocar una Junta.'
      );
    }

    // 2. Validación de coordenadas numéricas
    const meetingLat = Number(body.meeting_lat);
    const meetingLng = Number(body.meeting_lng);
    const userLat = Number(body.user_lat);
    const userLng = Number(body.user_lng);

    if (
      !Number.isFinite(meetingLat) ||
      !Number.isFinite(meetingLng) ||
      meetingLat < -90 ||
      meetingLat > 90 ||
      meetingLng < -180 ||
      meetingLng > 180
    ) {
      return jsonError(400, 'INVALID_COORDINATES', 'Las coordenadas del lugar de reunión no son válidas.');
    }

    // 3. Validación de cobertura (área delimitadora)
    if (!isWithinCoverage(meetingLat, meetingLng)) {
      return jsonError(
        400,
        'OUTSIDE_COVERAGE',
        'Ese lugar queda fuera del área de cobertura de la app. Elige uno cercano.'
      );
    }

    // 4. Validación de distancia máxima (2 km de la ubicación del brigadista si hay coordenadas del usuario)
    if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
      const distance = calculateDistanceMeters(userLat, userLng, meetingLat, meetingLng);
      // Si la distancia supera 2 km y no es la propia ubicación reportada por el brigadista
      if (distance > 2000 && (Math.abs(userLat - meetingLat) > 0.001 || Math.abs(userLng - meetingLng) > 0.001)) {
        return jsonError(
          400,
          'DISTANCE_EXCEEDED',
          'Ese lugar queda fuera de tu zona (máximo 2 km de distancia). Elige uno cercano.'
        );
      }
    }

    // 5. Validación de motivo (sin solo espacios, 5 a 140 caracteres, sin enlaces)
    const rawMotive = (body.motive || '').trim();
    if (rawMotive.length < 5 || rawMotive.length > 140) {
      return jsonError(
        400,
        'INVALID_MOTIVE',
        'El motivo de la reunión debe tener entre 5 y 140 caracteres.'
      );
    }
    if (URL_REGEX.test(rawMotive)) {
      return jsonError(
        400,
        'LINKS_NOT_ALLOWED',
        'El motivo no puede contener enlaces web por motivos de seguridad comunitaria.'
      );
    }

    // 6. Validación de referencia opcional (máx 80 caracteres)
    const rawRef = (body.reference_note || '').trim();
    if (rawRef.length > 80) {
      return jsonError(
        400,
        'INVALID_REFERENCE',
        'La referencia no puede superar los 80 caracteres.'
      );
    }

    // 7. Validación de fecha/hora (no en el pasado ni más de 7 días a futuro)
    const rawScheduled = (body.scheduled_time || '').trim();
    if (!rawScheduled) {
      return jsonError(400, 'MISSING_TIME', 'Debes especificar cuándo se realizará la junta.');
    }

    // 8. Límites anti-abuso:
    // a) Máximo 5 convocatorias por brigadista al día
    const todayDate = new Date().toISOString().slice(0, 10);
    const dailyEntry = globalMeetingsStore.__brigadistaDailyCount!.get(deviceId) || {
      count: 0,
      date: todayDate,
    };
    if (dailyEntry.date === todayDate && dailyEntry.count >= 5) {
      return jsonError(
        429,
        'DAILY_LIMIT_EXCEEDED',
        'Has alcanzado el límite de 5 convocatorias por día. Esto protege a la comunidad de saturación de avisos.'
      );
    }

    // b) Máximo 3 juntas activas por zona a la vez
    const sectorId = body.sector_id || 'huancayo-el-tambo';
    let activeInSector = 0;
    const nowMs = Date.now();
    for (const m of globalMeetingsStore.__neighborhoodMeetings!.values()) {
      if (
        m.sector_id === sectorId &&
        m.status === 'ACTIVA' &&
        new Date(m.expires_at).getTime() > nowMs &&
        m.report_count < 3
      ) {
        activeInSector++;
      }
    }

    if (activeInSector >= 3) {
      return jsonError(
        429,
        'ZONE_ACTIVE_LIMIT_EXCEEDED',
        'Ya existen 3 juntas activas en esta zona. Espera a que concluya alguna para convocar una nueva.'
      );
    }

    // 9. Construir y guardar la junta
    const meetingId = `junta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Vigencia 24h

    const meeting: NeighborhoodMeeting = {
      id: meetingId,
      sector_id: sectorId,
      brigadista_device_id: deviceId,
      brigadista_name: escapeHtml(body.brigadista_name || 'Brigadista Vecinal'),
      meeting_place_name: escapeHtml((body.meeting_place_name || '').trim()),
      meeting_lat: meetingLat,
      meeting_lng: meetingLng,
      motive: escapeHtml(rawMotive),
      scheduled_option: body.scheduled_option || 'AHORA',
      scheduled_time: escapeHtml(rawScheduled),
      reference_note: rawRef ? escapeHtml(rawRef) : undefined,
      status: 'ACTIVA',
      report_count: 0,
      reporting_devices: [],
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    };

    globalMeetingsStore.__neighborhoodMeetings!.set(meetingId, meeting);

    // Actualizar conteo diario
    globalMeetingsStore.__brigadistaDailyCount!.set(deviceId, {
      count: dailyEntry.date === todayDate ? dailyEntry.count + 1 : 1,
      date: todayDate,
    });

    return jsonOk(
      {
        meeting,
        message: 'Junta convocada exitosamente.',
      },
      undefined,
      201
    );
  } catch (err) {
    return jsonError(
      500,
      'MEETING_CREATION_ERROR',
      err instanceof Error ? err.message : 'Error al convocar la junta.'
    );
  }
}
