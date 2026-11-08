import { jsonError, jsonOk } from '@/server/http/api-handler';
import type { NeighborhoodMeeting } from '@/server/meetings/types';

const globalMeetingsStore = globalThis as unknown as {
  __neighborhoodMeetings?: Map<string, NeighborhoodMeeting>;
};

/**
 * DELETE /api/v1/meetings/[id]
 * Cancela una junta convocada. Solo el brigadista autor que la convocó puede cancelarla.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const meetingId = params.id;
  const deviceId = request.headers.get('x-device-id') || '';

  if (!globalMeetingsStore.__neighborhoodMeetings) {
    return jsonError(404, 'MEETING_NOT_FOUND', 'Junta no encontrada.');
  }

  const meeting = globalMeetingsStore.__neighborhoodMeetings.get(meetingId);
  if (!meeting) {
    return jsonError(404, 'MEETING_NOT_FOUND', 'La junta solicitada no existe o ya expiró.');
  }

  // Verificar que el solicitante sea el autor brigadista
  if (meeting.brigadista_device_id && meeting.brigadista_device_id !== deviceId) {
    return jsonError(
      403,
      'FORBIDDEN_AUTHOR_ONLY',
      'Solo el brigadista que convocó esta junta puede cancelarla.'
    );
  }

  meeting.status = 'CANCELADA';
  globalMeetingsStore.__neighborhoodMeetings.set(meetingId, meeting);

  return jsonOk({ cancelled: true, meeting_id: meetingId, message: 'Junta cancelada exitosamente.' });
}

/**
 * POST /api/v1/meetings/[id]
 * Reportar una junta. Con 3 reportes de usuarios distintos, la junta se oculta de inmediato.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const meetingId = params.id;
  const body = (await request.json().catch(() => ({}))) as {
    action?: 'REPORT';
    device_id?: string;
    reason?: string;
  };

  const action = body.action || 'REPORT';
  const reporterDeviceId = (body.device_id || request.headers.get('x-device-id') || '').trim();

  if (action !== 'REPORT') {
    return jsonError(400, 'INVALID_ACTION', 'Acción no reconocida.');
  }

  if (!globalMeetingsStore.__neighborhoodMeetings) {
    return jsonError(404, 'MEETING_NOT_FOUND', 'Junta no encontrada.');
  }

  const meeting = globalMeetingsStore.__neighborhoodMeetings.get(meetingId);
  if (!meeting) {
    return jsonError(404, 'MEETING_NOT_FOUND', 'La junta no existe.');
  }

  if (!reporterDeviceId) {
    return jsonError(400, 'MISSING_DEVICE_ID', 'Se requiere identificación de dispositivo para reportar.');
  }

  if (!meeting.reporting_devices) {
    meeting.reporting_devices = [];
  }

  if (meeting.reporting_devices.includes(reporterDeviceId)) {
    return jsonOk({
      reported: true,
      already_reported: true,
      report_count: meeting.report_count,
      message: 'Ya habías enviado un reporte para esta junta.',
    });
  }

  meeting.reporting_devices.push(reporterDeviceId);
  meeting.report_count = meeting.reporting_devices.length;

  // Si alcanza 3 reportes de usuarios distintos, se oculta automáticamente
  if (meeting.report_count >= 3) {
    meeting.status = 'OCULTA_POR_REPORTES';
  }

  globalMeetingsStore.__neighborhoodMeetings.set(meetingId, meeting);

  return jsonOk({
    reported: true,
    report_count: meeting.report_count,
    is_hidden: meeting.status === 'OCULTA_POR_REPORTES',
    message:
      meeting.status === 'OCULTA_POR_REPORTES'
        ? 'La junta ha sido ocultada tras recibir 3 reportes vecinales y pasó a revisión.'
        : 'Reporte registrado. Gracias por ayudar a mantener la comunidad segura.',
  });
}
