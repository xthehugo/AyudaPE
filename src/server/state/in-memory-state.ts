/**
 * @file src/server/state/in-memory-state.ts
 * @description Estado en memoria compartido para el protocolo de confirmación P2P
 * y verificación de dispositivos / DNI.
 */

import type { CommitmentVerificationStatus } from '@shared/types';

export interface P2PCommitmentRecord {
  id: string;
  post_id?: number;
  post_client_mutation_id: string;
  resource_item_id?: number;
  committed_quantity: number;
  commitment_note: string;
  status: string;
  verification_status: CommitmentVerificationStatus;
  shared_secret: string;
  requester_device_id: string;
  helper_device_id: string;
  delivered_by_device_id?: string;
  received_by_device_id?: string;
  confirmed_at?: string;
  created_at: string;
  failed_attempts: number;
  locked_until_ms?: number;
}

export interface AnonymousDeviceRecord {
  device_id: string;
  public_key: string;
  created_at: string;
  dni_verified?: boolean;
  dni_hash?: string;
  dni_masked?: string;
  verified_name?: string;
  rol?: 'VECINO' | 'BRIGADISTA_CERTIFICADO' | 'LIDER_VECINAL' | 'OPERADOR_MUNICIPAL';
  celular?: string;
  celular_verificado?: boolean;
}

export interface BrigadistaOtpChallenge {
  device_id: string;
  celular: string;
  otp_code: string;
  expires_at_ms: number;
  attempts: number;
}

const inMemoryCommitments = new Map<string, P2PCommitmentRecord>();
const inMemoryDevices = new Map<string, AnonymousDeviceRecord>();
const inMemoryOtpChallenges = new Map<string, BrigadistaOtpChallenge>();

export { inMemoryCommitments, inMemoryDevices, inMemoryOtpChallenges };
