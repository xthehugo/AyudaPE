import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { POST as handleBrigadistaCode } from '@/app/api/v1/brigadista/code/route';
import { POST as handleCreateMeeting, GET as handleGetMeetings } from '@/app/api/v1/meetings/route';
import { DELETE as handleCancelMeeting, POST as handleReportMeeting } from '@/app/api/v1/meetings/[id]/route';

describe('Función "Reunir / Junta" para Brigadistas', () => {
  const brigadistaDeviceId = 'device-brigadista-test-01';
  const neighborDeviceId = 'device-neighbor-test-02';

  beforeEach(() => {
    // Reset o configuración inicial
  });

  describe('1. Códigos de Brigadista y Autorización', () => {
    it('genera un código de un solo uso con hash SHA-256 y expiración en 7 días', async () => {
      const genReq = new Request('http://localhost/api/v1/brigadista/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_CODE',
          sector_id: 'huancayo-el-tambo',
        }),
      });

      const genRes = await handleBrigadistaCode(genReq);
      const genJson = await genRes.json();
      expect(genRes.status).toBe(200);
      expect(genJson.success).toBe(true);
      expect(genJson.data.plain_code).toMatch(/^BRIG-[0-9A-F]{6}$/);

      const plainCode = genJson.data.plain_code;

      // Canje exitoso por primera vez
      const verifyReq = new Request('http://localhost/api/v1/brigadista/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_CODE',
          code: plainCode,
          device_id: brigadistaDeviceId,
        }),
      });

      const verifyRes = await handleBrigadistaCode(verifyReq);
      const verifyJson = await verifyRes.json();
      expect(verifyRes.status).toBe(200);
      expect(verifyJson.data.verified).toBe(true);
      expect(verifyJson.data.brigadista_token).toBeDefined();

      // Segundo intento de canje debe ser rechazado (un solo uso)
      const reuseReq = new Request('http://localhost/api/v1/brigadista/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_CODE',
          code: plainCode,
          device_id: 'another-device',
        }),
      });

      const reuseRes = await handleBrigadistaCode(reuseReq);
      const reuseJson = await reuseRes.json();
      expect(reuseRes.status).toBe(403);
      expect(reuseJson.error.code).toBe('CODE_ALREADY_USED');
    });

    it('rechaza códigos inexistentes o alterados', async () => {
      const badReq = new Request('http://localhost/api/v1/brigadista/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_CODE',
          code: 'CODIGO-FALSO-999',
          device_id: brigadistaDeviceId,
        }),
      });

      const badRes = await handleBrigadistaCode(badReq);
      expect(badRes.status).toBe(403);
    });
  });

  describe('2. Control de Acceso y Creación de Juntas Vecinales', () => {
    it('deniega la convocatoria (403) a usuarios que no tengan el rol BRIGADISTA_CERTIFICADO', async () => {
      const req = new Request('http://localhost/api/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'VECINO',
          'x-device-id': neighborDeviceId,
        },
        body: JSON.stringify({
          device_id: neighborDeviceId,
          sector_id: 'huancayo-el-tambo',
          meeting_place_name: 'Parque Bolognesi · El Tambo',
          meeting_lat: -12.0528,
          meeting_lng: -75.2155,
          user_lat: -12.0528,
          user_lng: -75.2155,
          motive: 'Reunión no autorizada de vecino',
          scheduled_option: 'AHORA',
          scheduled_time: 'Inmediata',
        }),
      });

      const res = await handleCreateMeeting(req);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe('FORBIDDEN_BRIGADISTA_ONLY');
    });

    it('valida motivo de 5 a 140 caracteres y rechaza motivos inválidos o con enlaces', async () => {
      // Menos de 5 caracteres
      const shortReq = new Request('http://localhost/api/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'BRIGADISTA_CERTIFICADO',
          'x-device-id': brigadistaDeviceId,
        },
        body: JSON.stringify({
          device_id: brigadistaDeviceId,
          sector_id: 'huancayo-el-tambo',
          meeting_place_name: 'Parque Bolognesi · El Tambo',
          meeting_lat: -12.0528,
          meeting_lng: -75.2155,
          user_lat: -12.0528,
          user_lng: -75.2155,
          motive: 'Hola',
          scheduled_option: 'AHORA',
          scheduled_time: 'Inmediata',
        }),
      });

      const shortRes = await handleCreateMeeting(shortReq);
      expect(shortRes.status).toBe(400);

      // Con enlace spam
      const linkReq = new Request('http://localhost/api/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'BRIGADISTA_CERTIFICADO',
          'x-device-id': brigadistaDeviceId,
        },
        body: JSON.stringify({
          device_id: brigadistaDeviceId,
          sector_id: 'huancayo-el-tambo',
          meeting_place_name: 'Parque Bolognesi · El Tambo',
          meeting_lat: -12.0528,
          meeting_lng: -75.2155,
          user_lat: -12.0528,
          user_lng: -75.2155,
          motive: 'Únanse a nuestro grupo en https://t.me/reunion',
          scheduled_option: 'AHORA',
          scheduled_time: 'Inmediata',
        }),
      });

      const linkRes = await handleCreateMeeting(linkReq);
      expect(linkRes.status).toBe(400);
    });

    it('permite a un Brigadista convocar una junta vecinal válida dentro del rango hiperlocal de 2 km', async () => {
      const validReq = new Request('http://localhost/api/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'BRIGADISTA_CERTIFICADO',
          'x-device-id': brigadistaDeviceId,
        },
        body: JSON.stringify({
          device_id: brigadistaDeviceId,
          sector_id: 'huancayo-el-tambo',
          brigadista_name: 'Brigadista Pedro Quispe',
          meeting_place_name: 'Parque Bolognesi · El Tambo',
          meeting_lat: -12.0528,
          meeting_lng: -75.2155,
          user_lat: -12.0535,
          user_lng: -75.2150,
          motive: 'Organización de brigadas nocturnas y primeros auxilios',
          scheduled_option: 'HOY',
          scheduled_time: 'Hoy a las 18:00',
          reference_note: 'Frente a la Parroquia San Juan',
        }),
      });

      const res = await handleCreateMeeting(validReq);
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.meeting.id).toBeDefined();
      expect(json.data.meeting.status).toBe('ACTIVA');
      expect(json.data.meeting.motive).toBe('Organización de brigadas nocturnas y primeros auxilios');
    });

    it('rechaza lugares que excedan la distancia máxima permitida de 2 km', async () => {
      const farReq = new Request('http://localhost/api/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'BRIGADISTA_CERTIFICADO',
          'x-device-id': brigadistaDeviceId,
        },
        body: JSON.stringify({
          device_id: brigadistaDeviceId,
          sector_id: 'huancayo-el-tambo',
          meeting_place_name: 'Lugar lejano a más de 2km',
          meeting_lat: -12.0100, // ~4.7km al norte
          meeting_lng: -75.2155,
          user_lat: -12.0528,
          user_lng: -75.2155,
          motive: 'Reunión en punto fuera del rango',
          scheduled_option: 'AHORA',
          scheduled_time: 'Inmediata',
        }),
      });

      const farRes = await handleCreateMeeting(farReq);
      expect(farRes.status).toBe(400);
      const farJson = await farRes.json();
      expect(farJson.error.code).toBe('DISTANCE_EXCEEDED');
    });
  });

  describe('3. Moderación Comunitaria (Reportes) y Cancelación', () => {
    it('oculta la junta automáticamente cuando acumula 3 reportes vecinales distintos', async () => {
      // 1. Crear junta
      const createReq = new Request('http://localhost/api/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'BRIGADISTA_CERTIFICADO',
          'x-device-id': brigadistaDeviceId,
        },
        body: JSON.stringify({
          device_id: brigadistaDeviceId,
          sector_id: 'huancayo-el-tambo',
          meeting_place_name: 'Parque Bolognesi',
          meeting_lat: -12.0528,
          meeting_lng: -75.2155,
          user_lat: -12.0528,
          user_lng: -75.2155,
          motive: 'Junta para probar moderación y reportes',
          scheduled_option: 'AHORA',
          scheduled_time: 'Inmediata',
        }),
      });

      const createRes = await handleCreateMeeting(createReq);
      const createJson = await createRes.json();
      const meetingId = createJson.data.meeting.id;

      // Reporte 1 (vecino 1)
      const rep1 = await handleReportMeeting(
        new Request(`http://localhost/api/v1/meetings/${meetingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-device-id': 'vecino-rep-1' },
          body: JSON.stringify({ action: 'REPORT', device_id: 'vecino-rep-1' }),
        }),
        { params: { id: meetingId } }
      );
      const json1 = await rep1.json();
      expect(json1.data.report_count).toBe(1);
      expect(json1.data.is_hidden).toBe(false);

      // Reporte 2 (vecino 2)
      const rep2 = await handleReportMeeting(
        new Request(`http://localhost/api/v1/meetings/${meetingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-device-id': 'vecino-rep-2' },
          body: JSON.stringify({ action: 'REPORT', device_id: 'vecino-rep-2' }),
        }),
        { params: { id: meetingId } }
      );
      const json2 = await rep2.json();
      expect(json2.data.report_count).toBe(2);
      expect(json2.data.is_hidden).toBe(false);

      // Reporte 3 (vecino 3) -> debe ocultarse
      const rep3 = await handleReportMeeting(
        new Request(`http://localhost/api/v1/meetings/${meetingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-device-id': 'vecino-rep-3' },
          body: JSON.stringify({ action: 'REPORT', device_id: 'vecino-rep-3' }),
        }),
        { params: { id: meetingId } }
      );
      const json3 = await rep3.json();
      expect(json3.data.report_count).toBe(3);
      expect(json3.data.is_hidden).toBe(true);

      // Consultar la lista pública de la zona: la junta oculta ya no debe figurar
      const listReq = new Request('http://localhost/api/v1/meetings?sector_id=huancayo-el-tambo');
      const listRes = await handleGetMeetings(listReq);
      const listJson = await listRes.json();
      const ids = listJson.data.meetings.map((m: any) => m.id);
      expect(ids).not.toContain(meetingId);
    });

    it('permite al autor brigadista cancelar su propia junta vecinal', async () => {
      // 1. Crear junta
      const createReq = new Request('http://localhost/api/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'BRIGADISTA_CERTIFICADO',
          'x-device-id': brigadistaDeviceId,
        },
        body: JSON.stringify({
          device_id: brigadistaDeviceId,
          sector_id: 'huancayo-el-tambo',
          meeting_place_name: 'Coliseo Wanka',
          meeting_lat: -12.0722,
          meeting_lng: -75.2078,
          user_lat: -12.0722,
          user_lng: -75.2078,
          motive: 'Reunión vecinal que se cancelará',
          scheduled_option: 'MANANA',
          scheduled_time: 'Mañana a las 10:00',
        }),
      });

      const createRes = await handleCreateMeeting(createReq);
      const createJson = await createRes.json();
      const meetingId = createJson.data.meeting.id;

      // Intento de cancelación por otro vecino no-autor -> debe ser rechazado
      const badCancelReq = new Request(`http://localhost/api/v1/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { 'x-device-id': neighborDeviceId },
      });
      const badCancelRes = await handleCancelMeeting(badCancelReq, { params: { id: meetingId } });
      expect(badCancelRes.status).toBe(403);

      // Cancelación por el propio brigadista autor
      const cancelReq = new Request(`http://localhost/api/v1/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { 'x-device-id': brigadistaDeviceId },
      });
      const cancelRes = await handleCancelMeeting(cancelReq, { params: { id: meetingId } });
      expect(cancelRes.status).toBe(200);
      const cancelJson = await cancelRes.json();
      expect(cancelJson.success).toBe(true);
      expect(cancelJson.data.cancelled).toBe(true);
      expect(cancelJson.data.meeting_id).toBe(meetingId);
    });
  });
});
