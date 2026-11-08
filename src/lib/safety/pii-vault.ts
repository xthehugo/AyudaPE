/**
 * @file src/lib/safety/pii-vault.ts
 * @description Lógica de auditoría y desbloqueo seguro de Bóveda PII según Ley N° 29733 (Art. 17).
 */

import type { SystemRole } from '@/shared/types';

export interface ILocalPiiAuditRecord {
  id: string;
  timestamp: string;
  post_id: number;
  requester_role: string;
  requester_name: string;
  access_reason: string;
  compliance_legal: 'LEY_29733_ART_17';
}

export interface PiiVaultUnlockParams {
  postId: number;
  userRole: SystemRole;
  userName: string;
  accessReason: string;
  protectedAddress: string;
  protectedPhone: string;
}

export interface PiiVaultUnlockResult {
  success: boolean;
  data?: {
    exact_address: string;
    contact_phone: string;
    audit_id: string;
  };
  auditRecord?: ILocalPiiAuditRecord;
  error?: string;
}

/**
 * Desbloqueo auditado de Bóveda PII para Brigadistas Acreditados u Operadores Municipales.
 * Cumple estrictamente con la Ley N° 29733 Art. 17:
 * - Rechaza acceso a vecinos ordinarios sin credencial.
 * - Exige justificación operativa de rescate de al menos 10 caracteres.
 * - Genera un registro inmutable de auditoría local.
 */
export function executePiiVaultUnlock(params: PiiVaultUnlockParams): PiiVaultUnlockResult {
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
