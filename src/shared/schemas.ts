/**
 * @file src/shared/schemas.ts
 * @description Capa 0 (@shared) — Esquemas de Validación Zero-Trust con Zod e Invariantes de Dominio.
 * Incluye blindaje de la Regla RN-01 ("Cero Dinero" con jerga peruana) y protección de PII (Ley N° 29733).
 */

import { z } from 'zod';

/**
 * Expresión regular robusta para el invariante "Cero Dinero" (RN-01) con corpus léxico peruano completo.
 * Detecta símbolos monetarios (S/, soles, USD), jerga local (lucas, mangos, ferros, morlacos, chanchita),
 * billeteras y bancos locales (Yape, Plin, Tunki, BCP, Interbank, BBVA, Scotiabank) e intenciones de cobro.
 */
export const MONEY_REGEX =
  /(?:s\/\.?\s*\d+|\b\d+(?:[\.,]\d{1,2})?\s*(?:sol(?:es)?|so\b|lucas?|mangos?|ferros?|morlacos?|maracas?|d[oó]lares?|usd)\b|\b(?:s\/?\.?\s*\d+|soles?|d[oó]lares?|usd)\b|(?<!\bsin\s+)\b(?:precio|cobro|cobrar|tarifa|costo|honorarios?|remuneraci[oó]n|propina|estipendio|alquilo|alquiler|vendo|venta)\b|\b(?:efectivo|cash|plata|guita|morlacos?|ferros?|lucas?|mangos?)\b|\b(?:chanchita|colaboraci[oó]n\s+(?:econ[oó]mica|monetaria)|aporte\s+(?:econ[oó]mico|voluntario\s+obligatorio))\b|\by[\.\s_-]*a[\.\s_-]*p[\.\s_-]*[e3]\b|\bp[\.\s_-]*l[\.\s_-]*[i1][\.\s_-]*n\b|\b(?:tunki|bcp|interbank|bbva|scotiabank)\b|\btransferencia\s+(?:bancaria|por\s+banco)?\b|\bcu[aá]nto\s+(?:cuesta|cobras?|es|sale)\b)/i;

/**
 * Validación de teléfono de contacto en Perú (formato E.164 +519XXXXXXXX o 9 dígitos locales).
 */
export const PERU_PHONE_REGEX = /^(?:\+?51\s*)?9\d{2}[-\s]?\d{3}[-\s]?\d{3}$/;

/**
 * Enumeraciones base en Zod alineadas con `src/shared/types.ts`.
 */
export const OperationalModeSchema = z.enum(['HABITUAL', 'EMERGENCIA'], {
  errorMap: () => ({ message: 'El modo operativo debe ser HABITUAL o EMERGENCIA.' }),
});

export const ListingTypeSchema = z.enum(
  ['SERVICIO_OFICIO', 'PRODUCTO_LOCAL', 'SOPORTE_EMERGENCIA'],
  {
    errorMap: () => ({
      message:
        'El tipo de catálogo debe ser SERVICIO_OFICIO, PRODUCTO_LOCAL o SOPORTE_EMERGENCIA.',
    }),
  }
);

export const PostTypeSchema = z.enum(
  ['OFERTA_FAVOR', 'SOLICITUD_FAVOR', 'SOS_VULNERABLE', 'RECURSO_SOLIDARIO'],
  {
    errorMap: () => ({
      message:
        'El tipo de publicación debe ser OFERTA_FAVOR, SOLICITUD_FAVOR, SOS_VULNERABLE o RECURSO_SOLIDARIO.',
    }),
  }
);

export const IntentPostTypeSchema = z.enum([
  'SERVICIO_OFICIO',
  'PRODUCTO_LOCAL',
  'OFERTA_FAVOR',
  'SOLICITUD_FAVOR',
  'SOS_VULNERABLE',
  'RECURSO_CRITICO',
  'RECURSO_SOLIDARIO',
]);

export const UrgencyLevelSchema = z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'], {
  errorMap: () => ({
    message: 'El nivel de urgencia debe ser BAJA, MEDIA, ALTA o CRITICA.',
  }),
});

export const SystemRoleSchema = z.enum([
  'VECINO',
  'BRIGADISTA_CERTIFICADO',
  'LIDER_VECINAL',
  'OPERADOR_MUNICIPAL',
]);

export const SupportGroupTypeSchema = z.enum([
  'BRIGADA_DEFENSA_CIVIL',
  'JUNTA_VECINAL_SEGURIDAD',
  'COMEDOR_OLLA_COMUN',
  'VOLUNTARIADO_SALUD',
  'PUNTO_ACOPIO_BARRIAL',
]);

/**
 * Esquema para datos personales sensibles extraídos y puestos en cuarentena (Ley N° 29733 - RN-04 / RN-05).
 */
export const ExtractedPiiSchema = z.object({
  exact_address_reference: z
    .string({
      required_error: 'La referencia de dirección exacta es obligatoria en la bóveda PII.',
    })
    .min(5, 'La referencia de dirección exacta debe tener al menos 5 caracteres.')
    .max(300, 'La referencia de dirección exacta no puede exceder 300 caracteres.'),
  vulnerable_person_name: z
    .string()
    .max(120, 'El nombre de la persona vulnerable no puede exceder 120 caracteres.')
    .optional(),
  medical_or_mobility_notes: z
    .string()
    .max(500, 'Las notas médicas o de movilidad no pueden exceder 500 caracteres.')
    .optional(),
  emergency_contact_phone: z
    .string()
    .regex(
      PERU_PHONE_REGEX,
      'El teléfono de emergencia debe ser un celular peruano válido (9 dígitos o +51).'
    )
    .optional(),
});

/**
 * Esquema para ítems cuantificables de recursos requeridos u ofrecidos (1FN - RN-08).
 */
export const ResourceItemInputSchema = z.object({
  client_mutation_id: z.string().uuid('El client_mutation_id del recurso debe ser un UUID válido.').optional(),
  item_name: z
    .string({ required_error: 'El nombre del recurso es obligatorio.' })
    .min(2, 'El nombre del recurso debe tener al menos 2 caracteres.')
    .max(80, 'El nombre del recurso no puede exceder 80 caracteres.'),
  quantity_needed: z
    .number({ required_error: 'La cantidad requerida es obligatoria.' })
    .positive('La cantidad requerida debe ser mayor a 0.'),
  unit: z
    .string()
    .min(1, 'La unidad de medida es obligatoria.')
    .max(20, 'La unidad de medida no puede exceder 20 caracteres.')
    .default('UNIDAD'),
});

/**
 * Esquema de salida estructurada del Orquestador de IA Híbrida (3 Clics - RN-06 / RN-10).
 */
export const NeighborIntentSchema = z.object({
  module: z.enum(['OFICIOS_PRODUCTOS', 'CADENA_FAVORES', 'EMERGENCIA_SOS'], {
    errorMap: () => ({
      message: 'El módulo objetivo debe ser OFICIOS_PRODUCTOS, CADENA_FAVORES o EMERGENCIA_SOS.',
    }),
  }),
  post_type: IntentPostTypeSchema,
  category: z
    .string({ required_error: 'La categoría inferida es obligatoria.' })
    .min(2, 'La categoría debe tener al menos 2 caracteres.'),
  title: z
    .string({ required_error: 'El título es obligatorio.' })
    .min(3, 'El título debe tener al menos 3 caracteres.')
    .max(80, 'El título no debe superar los 80 caracteres.'),
  description: z
    .string({ required_error: 'La descripción pública es obligatoria.' })
    .min(5, 'La descripción debe tener al menos 5 caracteres.')
    .max(500, 'La descripción pública no debe superar los 500 caracteres.'),
  urgency: UrgencyLevelSchema,
  zero_money_compliant: z.boolean(),
  has_monetary_intent: z.boolean(),
  is_pii_redacted: z.boolean().default(false),
  extracted_pii: ExtractedPiiSchema.optional(),
  resources: z
    .array(
      z.object({
        item_name: z.string().min(2, 'El nombre del recurso debe tener al menos 2 caracteres.'),
        quantity_needed: z.number().positive('La cantidad debe ser mayor a 0.'),
        unit: z.string().min(1, 'La unidad es obligatoria.'),
      })
    )
    .optional(),
});

/**
 * Esquema para creación de Oficio, Producto Local o Soporte de Emergencia (Módulo 1).
 */
export const CreateListingSchema = z.object({
  client_mutation_id: z
    .string({ required_error: 'El identificador de mutación (client_mutation_id) es obligatorio.' })
    .uuid('El client_mutation_id debe tener formato UUID válido.'),
  listing_type: ListingTypeSchema,
  category_id: z
    .number({ required_error: 'El identificador de categoría es obligatorio.' })
    .int('El category_id debe ser un número entero.')
    .positive('El category_id debe ser un entero positivo.'),
  support_group_id: z.number().int().positive().optional(),
  title: z
    .string({ required_error: 'El título del servicio o producto es obligatorio.' })
    .min(5, 'El título debe tener entre 5 y 100 caracteres.')
    .max(100, 'El título no puede superar los 100 caracteres.'),
  description: z
    .string({ required_error: 'La descripción es obligatoria.' })
    .min(10, 'La descripción debe tener al menos 10 caracteres.')
    .max(1000, 'La descripción no puede superar los 1000 caracteres.'),
  contact_phone: z
    .string({ required_error: 'El teléfono de contacto es obligatorio.' })
    .regex(
      PERU_PHONE_REGEX,
      'El teléfono de contacto debe tener formato móvil peruano válido (9 dígitos o +51 9XXXXXXXX).'
    ),
  latitude: z
    .number({ required_error: 'La latitud es obligatoria.' })
    .min(-90, 'La latitud mínima es -90 grados.')
    .max(90, 'La latitud máxima es 90 grados.'),
  longitude: z
    .number({ required_error: 'La longitud es obligatoria.' })
    .min(-180, 'La longitud mínima es -180 grados.')
    .max(180, 'La longitud máxima es 180 grados.'),
  available_for_emergencies: z.boolean().default(false),
  emergency_response_note: z
    .string()
    .max(250, 'La nota de disponibilidad en emergencia no puede exceder 250 caracteres.')
    .optional(),
});

/**
 * Esquema para emitir un "Visto Bueno Vecinal" (Módulo 1 - RN-02 / RN-03).
 */
export const CreateEndorsementSchema = z.object({
  client_mutation_id: z
    .string({ required_error: 'El client_mutation_id es obligatorio.' })
    .uuid('El client_mutation_id debe ser un UUID válido.'),
  listing_id: z
    .number({ required_error: 'El listing_id es obligatorio.' })
    .int('El listing_id debe ser un número entero.')
    .positive('El listing_id debe ser mayor a 0.'),
  comment: z
    .string({ required_error: 'El comentario de recomendación vecinal es obligatorio.' })
    .min(10, 'El comentario del Visto Bueno debe tener al menos 10 caracteres.')
    .max(300, 'El comentario del Visto Bueno no puede superar los 300 caracteres.'),
});

/**
 * Esquema para crear una publicación en la Cadena de Favores o Tablero SOS (Módulo 2).
 * Incluye validación estricta `.refine()` de la Regla RN-01 ("Cero Dinero").
 */
export const CreateCommunityPostSchema = z
  .object({
    client_mutation_id: z
      .string({ required_error: 'El client_mutation_id es obligatorio.' })
      .uuid('El client_mutation_id debe ser un UUID válido.'),
    sector_id: z.number().int().positive().optional(),
    operational_mode: OperationalModeSchema,
    post_type: PostTypeSchema,
    category_id: z
      .number({ required_error: 'El category_id es obligatorio.' })
      .int('El category_id debe ser un número entero.')
      .positive('El category_id debe ser mayor a 0.'),
    title: z
      .string({ required_error: 'El título de la publicación es obligatorio.' })
      .min(5, 'El título debe tener al menos 5 caracteres.')
      .max(100, 'El título no puede superar los 100 caracteres.'),
    description: z
      .string({ required_error: 'La descripción de la publicación es obligatoria.' })
      .min(10, 'La descripción debe tener al menos 10 caracteres.')
      .max(500, 'La descripción pública no puede superar los 500 caracteres.'),
    urgency_level: UrgencyLevelSchema.default('MEDIA'),
    public_lat: z
      .number({ required_error: 'La latitud pública es obligatoria.' })
      .min(-90, 'La latitud debe estar entre -90 y 90.')
      .max(90, 'La latitud debe estar entre -90 y 90.'),
    public_lng: z
      .number({ required_error: 'La longitud pública es obligatoria.' })
      .min(-180, 'La longitud debe estar entre -180 y 180.')
      .max(180, 'La longitud debe estar entre -180 y 180.'),
    exact_lat: z.number().min(-90).max(90).optional(),
    exact_lng: z.number().min(-180).max(180).optional(),
    extracted_pii: ExtractedPiiSchema.optional(),
    resources: z.array(ResourceItemInputSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.post_type === 'OFERTA_FAVOR' || data.post_type === 'SOLICITUD_FAVOR') {
        const resourcesText = (data.resources ?? []).map((r) => `${r.item_name} ${r.unit}`).join(' ');
        const combinedText = `${data.title} ${data.description} ${resourcesText}`;
        return !MONEY_REGEX.test(combinedText);
      }
      return true;
    },
    {
      message:
        'VIOLACION_RN01_CERO_DINERO: La Cadena de Favores es estrictamente solidaria y sin dinero. Si deseas ofrecer un servicio o producto con tarifa, publícalo en el Directorio de Oficios y Productos Locales.',
      path: ['description'],
    }
  );

/**
 * Esquema para comprometer ayuda o recursos críticos a una publicación (Módulo 2 - RN-08).
 * Exige proveer `post_id` (numérico en servidor) o `post_client_mutation_id` (UUID cuando fue creado offline).
 */
export const CommitResourceSchema = z
  .object({
    client_mutation_id: z
      .string({ required_error: 'El client_mutation_id es obligatorio.' })
      .uuid('El client_mutation_id debe ser un UUID válido.'),
    post_id: z.number().int().positive().optional(),
    post_client_mutation_id: z
      .string()
      .uuid('El post_client_mutation_id debe ser un UUID válido.')
      .optional(),
    resource_item_id: z.number().int().positive().optional(),
    resource_item_client_mutation_id: z
      .string()
      .uuid('El resource_item_client_mutation_id debe ser un UUID válido.')
      .optional(),
    support_group_id: z.number().int().positive().optional(),
    committed_quantity: z
      .number({ required_error: 'La cantidad comprometida es obligatoria.' })
      .positive('La cantidad comprometida debe ser mayor a 0.'),
    commitment_note: z
      .string({ required_error: 'La nota de coordinación es obligatoria.' })
      .min(3, 'La nota de coordinación debe tener al menos 3 caracteres.')
      .max(250, 'La nota de coordinación no puede exceder los 250 caracteres.'),
  })
  .refine(
    (data) => data.post_id !== undefined || data.post_client_mutation_id !== undefined,
    {
      message:
        'Debe proporcionar post_id (ID numérico) o post_client_mutation_id (UUID offline) para vincular el compromiso de ayuda.',
      path: ['post_id'],
    }
  );

/**
 * Esquema para solicitud auditada de desbloqueo de bóveda PII (Ley N° 29733 - RN-05).
 */
export const UnlockSensitivePiiSchema = z.object({
  access_reason: z
    .string({ required_error: 'El motivo de acceso es obligatorio para la auditoría legal.' })
    .min(
      10,
      'El motivo de acceso debe detallar la justificación operativa en al menos 10 caracteres.'
    )
    .max(300, 'El motivo de acceso no puede superar los 300 caracteres.'),
});

/**
 * Esquema de una mutación individual en la cola Outbox para sincronización Offline-First (RN-07).
 */
export const OutboxMutationSchema = z.object({
  client_mutation_id: z
    .string({ required_error: 'El client_mutation_id es obligatorio.' })
    .uuid('El client_mutation_id debe ser un UUID válido.'),
  endpoint: z
    .string({ required_error: 'El endpoint de destino es obligatorio.' })
    .min(1, 'El endpoint no puede estar vacío.')
    .startsWith('/api/', 'El endpoint debe ser una ruta interna válida que inicie con /api/.'),
  http_method: z.enum(['POST', 'PUT', 'PATCH', 'DELETE']),
  payload: z.record(z.string(), z.unknown()),
  created_at: z
    .string({ required_error: 'La marca de tiempo created_at es obligatoria.' })
    .datetime({ message: 'El campo created_at debe tener formato ISO-8601 datetime válido.' }),
});

/**
 * Esquema para el lote de sincronización transaccional (POST /api/v1/sync/batch).
 */
export const BatchSyncSchema = z.object({
  mutations: z
    .array(OutboxMutationSchema)
    .min(1, 'El lote de sincronización debe contener al menos 1 mutación.')
    .max(50, 'El lote de sincronización admite un máximo de 50 mutaciones por transacción.'),
});

/**
 * Tipos inferidos automáticamente desde los esquemas Zod (`z.infer`).
 */
export type ExtractedPii = z.infer<typeof ExtractedPiiSchema>;
export type ResourceItemInput = z.infer<typeof ResourceItemInputSchema>;
export type NeighborIntent = z.infer<typeof NeighborIntentSchema>;
export type CreateListingDto = z.infer<typeof CreateListingSchema>;
export type CreateEndorsementDto = z.infer<typeof CreateEndorsementSchema>;
export type CreateCommunityPostDto = z.infer<typeof CreateCommunityPostSchema>;
export type CommitResourceDto = z.infer<typeof CommitResourceSchema>;
export type UnlockSensitivePiiDto = z.infer<typeof UnlockSensitivePiiSchema>;
export type OutboxMutationDto = z.infer<typeof OutboxMutationSchema>;
export type BatchSyncDto = z.infer<typeof BatchSyncSchema>;
