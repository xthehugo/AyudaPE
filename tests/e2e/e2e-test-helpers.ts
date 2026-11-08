/**
 * @file tests/e2e/e2e-test-helpers.ts
 * @description Utilidades, tipos y funciones auxiliares compartidas para las suites E2E (Tiers 1-4).
 */

import type { HyperlocalRadiusMeters } from '@/context/location-context';
import { calculateDistanceMeters } from '@/lib/geo-utils';
import type { IListingLocal, IPostLocal, SystemRole } from '@/shared/types';

/**
 * Contrato del registro de auditoría local PII (PROJECT.md § Interface Contracts 3).
 */
export interface ILocalPiiAuditRecord {
  id: string;
  timestamp: string;
  post_id: number;
  requester_role: string;
  requester_name: string;
  access_reason: string;
  compliance_legal: 'LEY_29733_ART_17';
}

/**
 * Contrato de selección de marcador en mapa (PROJECT.md § Interface Contracts 4).
 */
export interface IMapSelectionTarget {
  type: 'LISTING' | 'POST';
  id: number;
  title: string;
  category: string;
  badgeType: 'SOLIDARIO' | 'COMERCIAL' | 'EMERGENCIA';
  latitude: number;
  longitude: number;
  distanceMeters: number;
  contactPhone?: string;
  availableForEmergencies?: boolean;
  trustScore?: number;
  urgencyLevel?: string;
  privacyRadiusMeters?: number;
  isPiiProtected?: boolean;
}

/**
 * Deriva un IMapSelectionTarget a partir de un listing o post.
 */
export function deriveMapSelectionTarget(
  item: IListingLocal | IPostLocal,
  userLat: number,
  userLng: number
): IMapSelectionTarget {
  if ('listing_type' in item) {
    const distance = calculateDistanceMeters(userLat, userLng, item.latitude, item.longitude);
    return {
      type: 'LISTING',
      id: item.id ?? 1,
      title: item.title,
      category: item.listing_type,
      badgeType: item.available_for_emergencies ? 'EMERGENCIA' : 'COMERCIAL',
      latitude: item.latitude,
      longitude: item.longitude,
      distanceMeters: distance,
      contactPhone: item.contact_phone,
      availableForEmergencies: item.available_for_emergencies,
      trustScore: item.weighted_trust_score,
      isPiiProtected: false,
    };
  } else {
    const distance = calculateDistanceMeters(userLat, userLng, item.public_lat, item.public_lng);
    const isSos = item.post_type === 'SOS_VULNERABLE';
    return {
      type: 'POST',
      id: item.id ?? 1,
      title: item.title,
      category: item.post_type,
      badgeType: isSos ? 'EMERGENCIA' : 'SOLIDARIO',
      latitude: item.public_lat,
      longitude: item.public_lng,
      distanceMeters: distance,
      urgencyLevel: item.urgency_level,
      privacyRadiusMeters: item.privacy_radius_meters,
      isPiiProtected: isSos,
    };
  }
}

/**
 * Función canónica pura de filtrado hiperlocal Haversine (PROJECT.md F9 / F10).
 */
export function filterItemsByHyperlocalRadius<
  T extends { latitude?: number; public_lat?: number; longitude?: number; public_lng?: number }
>(
  items: T[],
  userLat: number,
  userLng: number,
  radiusMeters: HyperlocalRadiusMeters
): T[] {
  if (radiusMeters === null) {
    return items;
  }

  return items.filter((item) => {
    const lat = item.latitude ?? item.public_lat;
    const lng = item.longitude ?? item.public_lng;
    if (lat === undefined || lng === undefined) return false;

    const distance = calculateDistanceMeters(userLat, userLng, lat, lng);
    return distance <= radiusMeters;
  });
}

/**
 * Estado y formateo del cronómetro regresivo de 180s (Pitch Jurado).
 */
export interface IPitchTimerState {
  remainingSeconds: number;
  isRunning: boolean;
  statusColor: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export function formatTimerMmSs(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function deriveTimerStatusColor(seconds: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  if (seconds > 60) return 'NORMAL';
  if (seconds >= 30) return 'WARNING';
  return 'CRITICAL';
}

export class PitchTimerController {
  private seconds = 180;
  private running = false;

  public getState(): IPitchTimerState {
    return {
      remainingSeconds: this.seconds,
      isRunning: this.running,
      statusColor: deriveTimerStatusColor(this.seconds),
    };
  }

  public start(): void {
    this.running = true;
  }

  public pause(): void {
    this.running = false;
  }

  public reset(): void {
    this.seconds = 180;
    this.running = false;
  }

  public tick(secondsToDecrement: number = 1): void {
    if (!this.running) return;
    this.seconds = Math.max(0, this.seconds - secondsToDecrement);
    if (this.seconds === 0) {
      this.running = false;
    }
  }
}

/**
 * Oráculo de desbloqueo de Bóveda PII según Ley N° 29733.
 */
export function executePiiVaultUnlock(params: {
  postId: number;
  userRole: SystemRole;
  userName: string;
  accessReason: string;
  protectedAddress: string;
  protectedPhone: string;
}): {
  success: boolean;
  data?: { exact_address: string; contact_phone: string; audit_id: string };
  auditRecord?: ILocalPiiAuditRecord;
  error?: string;
} {
  const isAuthorized =
    params.userRole === 'BRIGADISTA_CERTIFICADO' ||
    params.userRole === 'OPERADOR_MUNICIPAL';

  if (!isAuthorized) {
    return {
      success: false,
      error: 'ACCESO_DENEGADO: Solo un Brigadista Certificado u Operador Municipal puede desbloquear la bóveda PII.',
    };
  }

  const trimmedReason = params.accessReason.trim();
  if (trimmedReason.length < 10) {
    return {
      success: false,
      error: 'JUSTIFICACION_INSUFICIENTE: Por mandato de la Ley N° 29733 Art. 17, se requiere una justificación de al menos 10 caracteres.',
    };
  }

  const auditId = `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const auditRecord: ILocalPiiAuditRecord = {
    id: auditId,
    timestamp: new Date().toISOString(),
    post_id: params.postId,
    requester_role: params.userRole,
    requester_name: params.userName,
    access_reason: trimmedReason,
    compliance_legal: 'LEY_29733_ART_17',
  };

  return {
    success: true,
    data: {
      exact_address: params.protectedAddress,
      contact_phone: params.protectedPhone,
      audit_id: auditId,
    },
    auditRecord,
  };
}
