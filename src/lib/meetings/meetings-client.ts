/**
 * @file src/lib/meetings/meetings-client.ts
 * @description Gestión en el cliente de Juntas Vecinales de Brigadistas:
 * - Lugares típicos de reunión precargados offline para Huancayo y sectores.
 * - Sincronización y persistencia local de juntas.
 * - Deshacer convocatoria durante 5 segundos.
 * - Envío y recepción de eventos en tiempo real.
 */

import type { NeighborhoodMeeting } from '@/server/meetings/types';
import { getOrCreateDeviceId } from '@/lib/ownership';

export interface PreloadedMeetingPlace {
  id: string;
  name: string;
  category: 'PARQUE' | 'PLAZA' | 'LOCAL_COMUNAL' | 'COLEGIO' | 'COLISEO';
  lat: number;
  lng: number;
  sector_id: string;
  reference: string;
}

export const PRELOADED_MEETING_PLACES: PreloadedMeetingPlace[] = [
  {
    id: 'place-bolognesi',
    name: 'Parque Bolognesi · El Tambo',
    category: 'PARQUE',
    lat: -12.0528,
    lng: -75.2155,
    sector_id: 'huancayo-el-tambo',
    reference: 'Frente a la Parroquia San Juan Bautista',
  },
  {
    id: 'place-local-comunal-tambo',
    name: 'Local Comunal de El Tambo · Jr. Parra del Riego',
    category: 'LOCAL_COMUNAL',
    lat: -12.056,
    lng: -75.217,
    sector_id: 'huancayo-el-tambo',
    reference: 'Cruce con Jr. Sucre',
  },
  {
    id: 'place-castilla',
    name: 'I.E. Mariscal Castilla · Puerta Principal',
    category: 'COLEGIO',
    lat: -12.0505,
    lng: -75.214,
    sector_id: 'huancayo-el-tambo',
    reference: 'Av. Mariscal Castilla 800',
  },
  {
    id: 'place-constitucion',
    name: 'Plaza Constitución · Huancayo Centro',
    category: 'PLAZA',
    lat: -12.0678,
    lng: -75.2085,
    sector_id: 'huancayo-centro',
    reference: 'Junto a la Catedral de Huancayo',
  },
  {
    id: 'place-huamanmarca',
    name: 'Parque Huamanmarca · Municipalidad Provincial',
    category: 'PARQUE',
    lat: -12.0683,
    lng: -75.2105,
    sector_id: 'huancayo-centro',
    reference: 'Explanada del Centro Cívico',
  },
  {
    id: 'place-coliseo-wanka',
    name: 'Coliseo Wanka · Av. Huancavelica',
    category: 'COLISEO',
    lat: -12.0722,
    lng: -75.2078,
    sector_id: 'huancayo-centro',
    reference: 'Puerta 1 de ingreso peatonal',
  },
  {
    id: 'place-tupac-amaru',
    name: 'Parque Túpac Amaru · San Carlos',
    category: 'PARQUE',
    lat: -12.061,
    lng: -75.203,
    sector_id: 'huancayo-san-carlos',
    reference: 'Frente al polideportivo San Carlos',
  },
  {
    id: 'place-lima-sector-4',
    name: 'Parque Huiracocha · Sector 4 (Jesús María)',
    category: 'PARQUE',
    lat: -12.0752,
    lng: -77.0485,
    sector_id: 'lima-jesus-maria-4',
    reference: 'Cuadra 14 de Jr. Huiracocha',
  },
];

const LOCAL_STORAGE_MEETINGS_KEY = 'redvecina_active_meetings_v1';

export function readStoredMeetings(): NeighborhoodMeeting[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MEETINGS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as NeighborhoodMeeting[];
    const now = Date.now();
    return list.filter(
      (m) =>
        m.status === 'ACTIVA' &&
        m.report_count < 3 &&
        new Date(m.expires_at).getTime() > now
    );
  } catch {
    return [];
  }
}

export function writeStoredMeetings(meetings: NeighborhoodMeeting[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_MEETINGS_KEY, JSON.stringify(meetings));
    window.dispatchEvent(new CustomEvent('redvecina_meetings_updated'));
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('redvecina_meetings_channel');
      channel.postMessage({ type: 'MEETINGS_SYNC', count: meetings.length });
      channel.close();
    }
  } catch {
    // Ignorar errores de cuota
  }
}

export async function fetchZoneMeetings(sectorId?: string): Promise<NeighborhoodMeeting[]> {
  try {
    const query = sectorId ? `?sector_id=${encodeURIComponent(sectorId)}` : '';
    const res = await fetch(`/api/v1/meetings${query}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = (await res.json()) as { data?: { meetings: NeighborhoodMeeting[] } };
    const remote = json.data?.meetings || [];

    // Combinar con las locales
    const local = readStoredMeetings();
    const map = new Map<string, NeighborhoodMeeting>();
    for (const m of remote) map.set(m.id, m);
    for (const m of local) {
      if (!map.has(m.id) && m.status === 'ACTIVA') {
        map.set(m.id, m);
      }
    }

    const merged = Array.from(map.values());
    writeStoredMeetings(merged);
    return merged;
  } catch {
    return readStoredMeetings();
  }
}

export async function cancelMeeting(meetingId: string): Promise<boolean> {
  const deviceId = getOrCreateDeviceId();
  try {
    await fetch(`/api/v1/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { 'x-device-id': deviceId },
    });
  } catch {
    // Fallback offline
  }

  const current = readStoredMeetings();
  const next = current.map((m) =>
    m.id === meetingId ? { ...m, status: 'CANCELADA' as const } : m
  );
  writeStoredMeetings(next.filter((m) => m.status === 'ACTIVA'));
  return true;
}

export async function reportMeeting(meetingId: string): Promise<{ hidden: boolean; reportCount: number }> {
  const deviceId = getOrCreateDeviceId();
  let hidden = false;
  let reportCount = 1;

  try {
    const res = await fetch(`/api/v1/meetings/${meetingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
      body: JSON.stringify({ action: 'REPORT', device_id: deviceId }),
    });
    const json = await res.json();
    hidden = Boolean(json.data?.is_hidden);
    reportCount = json.data?.report_count || 1;
  } catch {
    // Modo offline
  }

  const current = readStoredMeetings();
  const next = current.map((m) => {
    if (m.id === meetingId) {
      const reporting = m.reporting_devices || [];
      if (!reporting.includes(deviceId)) reporting.push(deviceId);
      const nextCount = Math.max(m.report_count + 1, reportCount);
      return {
        ...m,
        report_count: nextCount,
        reporting_devices: reporting,
        status: nextCount >= 3 ? ('OCULTA_POR_REPORTES' as const) : m.status,
      };
    }
    return m;
  });

  writeStoredMeetings(next.filter((m) => m.status === 'ACTIVA' && m.report_count < 3));
  return { hidden: hidden || reportCount >= 3, reportCount };
}
