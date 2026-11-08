/**
 * @file src/shared/types.ts
 * @description Capa 0 (@shared) — Tipos de Dominio, Enumeraciones y Contratos Estándar para RedVecina.
 * Cumple con compilación TypeScript estricta (noImplicitAny, strictNullChecks).
 */

/**
 * Modo operativo dual de la plataforma (RN-15 y Estado Dual).
 */
export type OperationalMode = 'HABITUAL' | 'EMERGENCIA';

/**
 * Clasificación de módulos funcionales principales de RedVecina.
 */
export type TargetModuleScope = 'OFICIOS_PRODUCTOS' | 'CADENA_FAVORES' | 'EMERGENCIA_SOS';

/**
 * Ámbito de categoría en el catálogo maestro (2FN/3FN).
 */
export type CategoryModuleScope = 'ECONOMIA_LOCAL' | 'ECONOMIA_SOLIDARIA' | 'AMBOS';

/**
 * Tipos de publicación en el Módulo 1: Productos, Servicios y Soporte de Proximidad (Brecha B-01 / B-02).
 */
export type ListingType = 'SERVICIO_OFICIO' | 'PRODUCTO_LOCAL' | 'SOPORTE_EMERGENCIA';

/**
 * Tipos de publicación en el Módulo 2: Cadena de Favores y Tablero Humanitario SOS.
 */
export type PostType =
  | 'OFERTA_FAVOR'
  | 'SOLICITUD_FAVOR'
  | 'SOS_VULNERABLE'
  | 'RECURSO_SOLIDARIO';

/**
 * Tipos de intención unificados que puede clasificar el Orquestador de IA Híbrida.
 */
export type IntentPostType =
  | 'SERVICIO_OFICIO'
  | 'PRODUCTO_LOCAL'
  | 'OFERTA_FAVOR'
  | 'SOLICITUD_FAVOR'
  | 'SOS_VULNERABLE'
  | 'RECURSO_CRITICO'
  | 'RECURSO_SOLIDARIO';

/**
 * Niveles de urgencia para triaje comunitario y respuesta humanitaria.
 */
export type UrgencyLevel = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

/**
 * Roles del sistema para control de acceso basado en roles (RBAC) y desbloqueo auditado de PII (RN-05).
 */
export type SystemRole =
  | 'VECINO'
  | 'BRIGADISTA_CERTIFICADO'
  | 'LIDER_VECINAL'
  | 'OPERADOR_MUNICIPAL';

/**
 * Métodos de verificación de residencia barrial (RN-02).
 */
export type VerificationMethod = 'SMS_GEO' | 'PADRON_JUNTA' | 'MUNICIPAL' | 'PENDIENTE';

/**
 * Tipos de Grupos de Apoyo Comunitario y Brigadas Barriales (Brecha B-02 / RN-13).
 */
export type SupportGroupType =
  | 'BRIGADA_DEFENSA_CIVIL'
  | 'JUNTA_VECINAL_SEGURIDAD'
  | 'COMEDOR_OLLA_COMUN'
  | 'VOLUNTARIADO_SALUD'
  | 'PUNTO_ACOPIO_BARRIAL';

/**
 * Estado operativo de una brigada o grupo de apoyo barrial.
 */
export type SupportGroupOperationalStatus = 'ACTIVO' | 'DESPLEGADO_EMERGENCIA' | 'INACTIVO';

/**
 * Rol de un vecino integrante dentro de un grupo de apoyo comunitario.
 */
export type SupportGroupMemberRole =
  | 'COORDINADOR'
  | 'PRIMEROS_AUXILIOS'
  | 'RESCATE_TECNICO'
  | 'LOGISTICA'
  | 'VOLUNTARIO';

/**
 * Estados del ciclo de vida de una publicación en el Muro Solidario / Tablero SOS (RN-09).
 */
export type CommunityPostStatus = 'ACTIVO' | 'EN_COORDINACION' | 'ATENDIDO' | 'CERRADO';

/**
 * Estados de un compromiso de recurso o asistencia vecinal (Brecha B-03 / RN-08).
 */
export type ResourceCommitmentStatus =
  | 'COMPROMETIDO'
  | 'EN_CAMINO'
  | 'ENTREGADO_VERIFICADO'
  | 'CANCELADO';

/**
 * Estado de sincronización de mutaciones en la cola local (Transactional Outbox Pattern - RN-07).
 */
export type OutboxSyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

/**
 * Métodos HTTP soportados por la cola de sincronización offline.
 */
export type OutboxHttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Pesos geodésicos permitidos para el Visto Bueno Vecinal según distancia Haversine (RN-02).
 */
export type ProximityWeight = 1.5 | 1.0 | 0.3;

/**
 * Estructura de error estandarizada compatible con RFC 7807 (Problem Details for HTTP APIs).
 */
export interface ApiErrorDetail {
  code: string;
  message: string;
  type?: string;
  status?: number;
  instance?: string;
  details?: Record<string, unknown>;
}

/**
 * Contrato estándar envolvente para todas las respuestas de la API RESTful de RedVecina.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
  meta?: Record<string, unknown>;
}

/**
 * Entidades para persistencia local Offline-First en IndexedDB (Dexie.js - Capa 2 / MOD-04).
 */
export interface IListingLocal {
  id?: number;
  client_mutation_id: string;
  category_id: number;
  listing_type: ListingType;
  title: string;
  description: string;
  contact_phone: string;
  latitude: number;
  longitude: number;
  available_for_emergencies: boolean;
  emergency_response_note?: string;
  photo_url?: string;
  endorsement_count: number;
  weighted_trust_score: number;
  is_pending_sync: boolean;
  updated_at?: string;
}

export interface IPostLocal {
  id?: number;
  client_mutation_id: string;
  sector_id: number;
  category_id: number;
  operational_mode: OperationalMode;
  post_type: PostType;
  title: string;
  description: string;
  urgency_level: UrgencyLevel;
  public_lat: number;
  public_lng: number;
  privacy_radius_meters: number;
  photo_url?: string;
  status: CommunityPostStatus;
  client_created_at: string;
  is_pending_sync: boolean;
  updated_at?: string;
}

export type CommitmentVerificationStatus =
  | 'comprometido'
  | 'entregado_declarado'
  | 'confirmado'
  | 'vencido';

export interface ICommitmentLocal {
  id?: number;
  client_mutation_id: string;
  post_id?: number;
  post_client_mutation_id: string;
  resource_item_id?: number;
  resource_item_client_mutation_id?: string;
  helper_user_id?: number;
  committed_quantity: number;
  commitment_note: string;
  status: ResourceCommitmentStatus;
  created_at: string;
  is_pending_sync: boolean;
  updated_at?: string;
  // Campos del Protocolo de Confirmación P2P
  verification_status?: CommitmentVerificationStatus;
  shared_secret?: string;
  requester_device_id?: string;
  helper_device_id?: string;
  delivered_by_device_id?: string;
  received_by_device_id?: string;
  confirmed_at?: string;
}

export interface IOutboxMutation {
  local_id?: number;
  client_mutation_id: string;
  endpoint: string;
  http_method: OutboxHttpMethod;
  payload: Record<string, unknown>;
  created_at: string;
  retry_count: number;
  status: OutboxSyncStatus;
  error_message?: string;
}

/**
 * DTO de respuesta para sincronización incremental Downlink (GET /api/v1/sync/delta).
 */
export interface DeltaSyncResponseDto {
  server_timestamp: string;
  sector_id: number;
  listings: IListingLocal[];
  posts: IPostLocal[];
  commitments: ICommitmentLocal[];
  categories: Array<{
    id: number;
    code: string;
    name: string;
    module_scope: CategoryModuleScope;
    is_emergency_critical: boolean;
    priority_weight: number;
    icon_name: string;
  }>;
  has_more: boolean;
}
