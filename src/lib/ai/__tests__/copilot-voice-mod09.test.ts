import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  mapSpeechErrorToFriendlyMessage,
  resolveSpeechRecognitionConstructor,
  type SpeechRecognitionInstance,
} from '@/hooks/use-voice-recognition';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import { NeighborhoodCopilotService } from '../copilot-service';

describe('MOD-09: Adaptador de Voz Web Speech API (es-PE) y Copiloto Barrial RAG', () => {
  let testDb: RedVecinaLocalDB;

  beforeEach(async () => {
    testDb = new RedVecinaLocalDB(`Mod09CopilotDB_${Date.now()}_${Math.random()}`);
    await testDb.bulkCacheListings([
      {
        id: 1,
        client_mutation_id: '11111111-1111-4111-8111-111111111101',
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Gasfitería Maestro Jorge - Fugas y Tuberías',
        description: 'Reparación rápida de caños rotos, fugas de agua, tanques y cisternas en Jesús María.',
        contact_phone: '991-234-567',
        available_for_emergencies: true,
        endorsement_count: 14,
        weighted_trust_score: 9.8,
        latitude: -12.0751,
        longitude: -77.0482,
        is_pending_sync: false,
      },
      {
        id: 2,
        client_mutation_id: '11111111-1111-4111-8111-111111111102',
        category_id: 1,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Plomería y Desatoros Don Lucho',
        description: 'Atención de desagües y fugas de caño a domicilio.',
        contact_phone: '992-345-678',
        available_for_emergencies: false,
        endorsement_count: 5,
        weighted_trust_score: 4.5,
        latitude: -12.0762,
        longitude: -77.0491,
        is_pending_sync: false,
      },
      {
        id: 3,
        client_mutation_id: '11111111-1111-4111-8111-111111111103',
        category_id: 4,
        listing_type: 'SOPORTE_EMERGENCIA',
        title: 'Lic. Rosa - Enfermera y Oxígeno Medicinal 24h',
        description: 'Inyecciones, control de presión, nebulizaciones y recarga de balón de oxígeno.',
        contact_phone: '998-765-432',
        available_for_emergencies: true,
        endorsement_count: 19,
        weighted_trust_score: 12.4,
        latitude: -12.0745,
        longitude: -77.0479,
        is_pending_sync: false,
      },
    ]);

    await testDb.bulkCachePosts([
      {
        id: 10,
        client_mutation_id: '22222222-2222-4222-8222-222222222210',
        sector_id: 1,
        category_id: 4,
        operational_mode: 'EMERGENCIA',
        post_type: 'RECURSO_SOLIDARIO',
        title: 'Préstamo solidario de manómetro para balón de oxígeno',
        description: 'Vecinos, tengo un manómetro regulador de oxígeno disponible en cuadra 14.',
        urgency_level: 'ALTA',
        public_lat: -12.075,
        public_lng: -77.048,
        privacy_radius_meters: 0,
        status: 'ACTIVO',
        is_pending_sync: false,
        client_created_at: new Date().toISOString(),
      },
    ]);
  });

  it('1. Construye contexto RAG desde localDb (Dexie.js) y prioriza por weighted_trust_score con teléfonos directos en modo offline', async () => {
    const copilot = new NeighborhoodCopilotService({ db: testDb });

    const response = await copilot.ask(
      '¿Quién me puede ayudar con una fuga de agua en el caño?',
      'HABITUAL'
    );

    expect(response.used_cloud_llm).toBe(false);
    expect(response.recommended_specialists.length).toBeGreaterThanOrEqual(2);
    // El Maestro Jorge (score 9.8) debe aparecer antes que Don Lucho (score 4.5)
    expect(response.recommended_specialists[0]?.title).toContain('Maestro Jorge');
    expect(response.recommended_specialists[0]?.contact_phone).toBe('991-234-567');
    expect(response.answer).toContain('991-234-567');
    expect(response.answer).toContain('Maestro Jorge');
  });

  it('2. Recupera especialistas de salud y alertas activas relacionadas al consultar por balón de oxígeno en modo EMERGENCIA', async () => {
    const copilot = new NeighborhoodCopilotService({ db: testDb });

    const response = await copilot.ask(
      'Necesito urgente una enfermera o apoyo con balón de oxígeno',
      'EMERGENCIA'
    );

    expect(response.recommended_specialists[0]?.title).toContain('Lic. Rosa');
    expect(response.recommended_specialists[0]?.contact_phone).toBe('998-765-432');
    expect(response.related_alerts.length).toBe(1);
    expect(response.related_alerts[0]?.title).toContain('balón de oxígeno');
    expect(response.answer).toContain('998-765-432');
  });

  it('3. Valida el adaptador Web Speech API (es-PE) y mensajes empáticos ante permisos denegados o falta de soporte', () => {
    const unsupportedCtor = resolveSpeechRecognitionConstructor({});
    expect(unsupportedCtor).toBeNull();

    class MockWebkitSpeechRecognition implements SpeechRecognitionInstance {
      lang = 'en-US';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart = null;
      onresult = null;
      onerror = null;
      onend = null;
      start(): void {}
      stop(): void {}
    }

    const detectedCtor = resolveSpeechRecognitionConstructor({
      webkitSpeechRecognition: MockWebkitSpeechRecognition,
    });
    expect(detectedCtor).toBe(MockWebkitSpeechRecognition);

    const deniedMsg = mapSpeechErrorToFriendlyMessage('not-allowed');
    expect(deniedMsg).toContain('Permiso de micrófono denegado');

    const noSpeechMsg = mapSpeechErrorToFriendlyMessage('no-speech');
    expect(noSpeechMsg).toContain('No se escuchó ninguna voz');
  });
});
