/**
 * @file src/server/meetings/types.ts
 * @description Contratos de datos para el módulo "Reunir / Junta" de Brigadistas.
 */

export interface NeighborhoodMeeting {
  id: string;
  sector_id: string;
  brigadista_device_id: string;
  brigadista_name: string;
  meeting_place_name: string;
  meeting_lat: number;
  meeting_lng: number;
  motive: string;
  scheduled_option: 'AHORA' | 'HOY' | 'MANANA' | 'PROGRAMADO';
  scheduled_time: string; // ISO string o formato legible
  reference_note?: string;
  status: 'ACTIVA' | 'CANCELADA' | 'EXPIRADA' | 'OCULTA_POR_REPORTES';
  report_count: number;
  reporting_devices: string[];
  created_at: string;
  expires_at: string;
}

export interface CreateMeetingRequest {
  device_id: string;
  sector_id: string;
  brigadista_name?: string;
  brigadista_token?: string;
  meeting_place_name: string;
  meeting_lat: number;
  meeting_lng: number;
  user_lat: number;
  user_lng: number;
  motive: string;
  scheduled_option: 'AHORA' | 'HOY' | 'MANANA' | 'PROGRAMADO';
  scheduled_time: string;
  reference_note?: string;
}
