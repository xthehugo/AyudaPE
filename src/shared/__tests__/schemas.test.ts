import { describe, expect, it } from 'vitest';
import {
  BatchSyncSchema,
  CommitResourceSchema,
  CreateCommunityPostSchema,
  CreateEndorsementSchema,
  CreateListingSchema,
  ExtractedPiiSchema,
  MONEY_REGEX,
  NeighborIntentSchema,
  UnlockSensitivePiiSchema,
} from '../schemas';

describe('[MOD-01] Capa 0 (@shared) — Contratos y Esquemas de Validación Zod', () => {
  const sampleUuid = '550e8400-e29b-41d4-a716-446655440000';
  const secondaryUuid = '660e8400-e29b-41d4-a716-446655440001';

  describe('1. Invariante Cero Dinero (RN-01) y Corpus Peruano (MONEY_REGEX)', () => {
    it.each([
      'Te presto mi escalera por S/ 20',
      'Cobro 15 soles por ayudar a mover los muebles',
      'Dame 10 lucas para la gaseosa',
      'Son 50 mangos o 20 ferros',
      'Me pasas por Yape o Plin al finalizar',
      'Hacemos una chanchita o colaboración económica',
      'Transferencia por BCP o Interbank',
      '¿Cuánto cobras por revisar el caño?',
    ])('debe detectar intención monetaria en la frase: "%s"', (phrase) => {
      expect(MONEY_REGEX.test(phrase)).toBe(true);
    });

    it.each([
      'Presto taladro percutor a vecino del Sector 4 de Jesús María sin costo',
      'Necesito apoyo temporal para bajar una silla de ruedas del piso 3',
      'Dono 3 bidones de agua potable cerrados para adultos mayores',
      'Comparto movilidad solidaria hacia el hospital Rebagliati mañana a las 7am',
    ])('NO debe producir falsos positivos en frases solidarias legítimas: "%s"', (phrase) => {
      expect(MONEY_REGEX.test(phrase)).toBe(false);
    });
  });

  describe('2. CreateCommunityPostSchema (Muro Solidario & Tablero SOS)', () => {
    it('debe aceptar una publicación legítima en Cadena de Favores sin dinero', () => {
      const result = CreateCommunityPostSchema.safeParse({
        client_mutation_id: sampleUuid,
        operational_mode: 'HABITUAL',
        post_type: 'OFERTA_FAVOR',
        category_id: 4,
        title: 'Presto escalera tijera de aluminio',
        description: 'Vecinos de la cuadra 14 de Huiracocha, presto mi escalera por la tarde.',
        urgency_level: 'BAJA',
        public_lat: -12.0785,
        public_lng: -77.0492,
      });

      expect(result.success).toBe(true);
    });

    it('debe rechazar con error contextual RN-01 si un favor menciona dinero o billeteras digitales', () => {
      const result = CreateCommunityPostSchema.safeParse({
        client_mutation_id: sampleUuid,
        operational_mode: 'HABITUAL',
        post_type: 'OFERTA_FAVOR',
        category_id: 4,
        title: 'Presto escalera tijera',
        description: 'La presto por toda la tarde, solo me dejan 15 lucas por yape.',
        urgency_level: 'BAJA',
        public_lat: -12.0785,
        public_lng: -77.0492,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('VIOLACION_RN01_CERO_DINERO');
      }
    });

    it('debe aceptar un reporte SOS_VULNERABLE con PII en cuarentena y recursos atómicos (1FN)', () => {
      const result = CreateCommunityPostSchema.safeParse({
        client_mutation_id: sampleUuid,
        operational_mode: 'EMERGENCIA',
        post_type: 'SOS_VULNERABLE',
        category_id: 8,
        title: 'Adulto mayor requiere insulina y agua',
        description: 'Vecino vulnerable en [DIRECCIÓN PROTEGIDA] necesita insulina urgente.',
        urgency_level: 'CRITICA',
        public_lat: -12.0781,
        public_lng: -77.0488,
        exact_lat: -12.07845,
        exact_lng: -77.04912,
        extracted_pii: {
          exact_address_reference: 'Jr. Huiracocha 1420, Dpto 402',
          vulnerable_person_name: 'Don José (82 años)',
          medical_or_mobility_notes: 'Paciente diabético e hipertenso en silla de ruedas',
          emergency_contact_phone: '+51 987 654 321',
        },
        resources: [
          {
            client_mutation_id: secondaryUuid,
            item_name: 'Agua potable',
            quantity_needed: 10,
            unit: 'LITROS',
          },
        ],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('3. CreateListingSchema & CreateEndorsementSchema (Módulo 1)', () => {
    it('debe validar correctamente un oficio o producto local con teléfono peruano', () => {
      const listing = CreateListingSchema.safeParse({
        client_mutation_id: sampleUuid,
        listing_type: 'SERVICIO_OFICIO',
        category_id: 1,
        title: 'Maestro Gasfitero y Detección de Fugas',
        description: 'Atención inmediata en Jesús María, cambio de llaves maestras y tuberías.',
        contact_phone: '998877665',
        latitude: -12.076,
        longitude: -77.045,
        available_for_emergencies: true,
        emergency_response_note: 'Cuento con herramientas de corte de gas y agua 24/7',
      });

      expect(listing.success).toBe(true);
    });

    it('debe validar correctamente un Visto Bueno Vecinal', () => {
      const endorsement = CreateEndorsementSchema.safeParse({
        client_mutation_id: sampleUuid,
        listing_id: 12,
        comment: 'Excelente vecino, reparó una fuga en mi edificio en menos de 20 minutos.',
      });

      expect(endorsement.success).toBe(true);
    });
  });

  describe('4. CommitResourceSchema, NeighborIntentSchema y BatchSyncSchema', () => {
    it('debe exigir post_id o post_client_mutation_id en CommitResourceSchema', () => {
      const invalidCommit = CommitResourceSchema.safeParse({
        client_mutation_id: sampleUuid,
        committed_quantity: 2,
        commitment_note: 'Llevo 2 bidones de agua en 10 minutos',
      });
      expect(invalidCommit.success).toBe(false);

      const validOfflineCommit = CommitResourceSchema.safeParse({
        client_mutation_id: sampleUuid,
        post_client_mutation_id: secondaryUuid,
        committed_quantity: 2,
        commitment_note: 'Llevo 2 bidones de agua en 10 minutos',
      });
      expect(validOfflineCommit.success).toBe(true);
    });

    it('debe validar NeighborIntentSchema y UnlockSensitivePiiSchema', () => {
      const intent = NeighborIntentSchema.safeParse({
        module: 'EMERGENCIA_SOS',
        post_type: 'SOS_VULNERABLE',
        category: 'Salud y Primeros Auxilios',
        title: 'Auxilio para adulto mayor electrodependiente',
        description: 'Se requiere generador de respaldo en [DIRECCIÓN PROTEGIDA].',
        urgency: 'CRITICA',
        zero_money_compliant: true,
        has_monetary_intent: false,
        is_pii_redacted: true,
        extracted_pii: {
          exact_address_reference: 'Av. Gregorio Escobedo 780, Torre B Dpto 301',
        },
      });
      expect(intent.success).toBe(true);

      const piiAccess = UnlockSensitivePiiSchema.safeParse({
        access_reason: 'Despacho de brigada de rescate San Felipe hacia el domicilio.',
      });
      expect(piiAccess.success).toBe(true);
      expect(ExtractedPiiSchema.safeParse({ exact_address_reference: '123' }).success).toBe(false);
    });

    it('debe validar un lote de sincronización offline en BatchSyncSchema', () => {
      const batch = BatchSyncSchema.safeParse({
        mutations: [
          {
            client_mutation_id: sampleUuid,
            endpoint: '/api/v1/posts',
            http_method: 'POST',
            payload: { title: 'Prueba offline' },
            created_at: '2026-11-07T03:00:00.000Z',
          },
        ],
      });
      expect(batch.success).toBe(true);
    });
  });
});
