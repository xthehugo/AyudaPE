import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { ModeProvider } from '@/context/mode-context';
import { parseNeighborIntent } from '@/lib/ai/ai-orchestrator';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import { NeighborhoodMap } from '@/components/map/neighborhood-map';
import { executeQuickPublishPersist, QuickPublishModal } from '../quick-publish-modal';

describe('MOD-11: Modal de Publicación Asistida en 3 Clics y Mapa Barrial con Privacy Blurring (50m)', () => {
  let testDb: RedVecinaLocalDB;

  beforeEach(() => {
    testDb = new RedVecinaLocalDB(`Mod11PublishMapDB_${Date.now()}_${Math.random()}`);
  });

  it('1. Completa el flujo en 3 pasos guardando alerta SOS_VULNERABLE en localDb con círculo difuminado de 50m y encolando en Outbox', async () => {
    // Clic 1 + Clic 2: El vecino dicta y el orquestador clasifica + sanitiza PII
    const intent = await parseNeighborIntent(
      'Auxilio urgente por sismo, mi abuelita postrada en silla de ruedas necesita oxígeno en Jr. Huiracocha 1420 Dpto 302, llamar al 987-654-321',
      'EMERGENCIA'
    );

    expect(intent.post_type).toBe('SOS_VULNERABLE');
    expect(intent.is_pii_redacted).toBe(true);

    // Clic 3: Confirmar publicación en 1 toque ("Publicar en mi Barrio")
    const exactLat = -12.0752;
    const exactLng = -77.0485;
    const persisted = await executeQuickPublishPersist({
      intent,
      latitude: exactLat,
      longitude: exactLng,
      operationalMode: 'EMERGENCIA',
      db: testDb,
    });

    expect(persisted.targetCollection).toBe('posts');

    const storedPosts = await testDb.posts.toArray();
    expect(storedPosts.length).toBe(1);
    const savedPost = storedPosts[0]!;
    expect(savedPost.privacy_radius_meters).toBe(50);
    // Las coordenadas públicas almacenadas en caché local están desplazadas respecto a la ubicación exacta
    expect(savedPost.public_lat).not.toBe(exactLat);
    expect(savedPost.public_lng).not.toBe(exactLng);
    expect(savedPost.description).not.toContain('Jr. Huiracocha 1420');

    // Verificar que la cola Outbox resguarda el payload completo para el backend
    const outboxItems = await testDb.getPendingMutations();
    expect(outboxItems.length).toBe(1);
    expect(outboxItems[0]?.endpoint).toBe('/api/v1/posts');
    expect(outboxItems[0]?.payload.exact_lat).toBe(exactLat);
  });

  it('2. Guarda un Servicio de Proximidad en localDb.listings y encola en Outbox cuando hay intención monetaria', async () => {
    const intent = await parseNeighborIntent(
      'Soy gasfitero matriculado y reparo fugas de caño y cisternas. Cobro S/ 35 por visita.',
      'HABITUAL'
    );

    expect(intent.module).toBe('OFICIOS_PRODUCTOS');
    expect(intent.has_monetary_intent).toBe(true);

    const persisted = await executeQuickPublishPersist({
      intent,
      latitude: -12.0755,
      longitude: -77.0489,
      contactPhone: '991-222-333',
      operationalMode: 'HABITUAL',
      db: testDb,
    });

    expect(persisted.targetCollection).toBe('listings');
    const listings = await testDb.listings.toArray();
    expect(listings.length).toBe(1);
    expect(listings[0]?.contact_phone).toBe('991-222-333');
  });

  it('3. Renderiza el círculo difuminado de 50 metros en NeighborhoodMap para reportes SOS_VULNERABLE y estructura accesible del modal', () => {
    const mapHtml = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(NeighborhoodMap, {
          customDb: testDb,
          initialListings: [
            {
              id: 1,
              client_mutation_id: '33333333-3333-4333-8333-333333333301',
              category_id: 1,
              listing_type: 'SERVICIO_OFICIO',
              title: 'Gasfitero Maestro Jorge',
              description: 'Atención de fugas de agua',
              contact_phone: '991-234-567',
              latitude: -12.0751,
              longitude: -77.0482,
              available_for_emergencies: true,
              endorsement_count: 10,
              weighted_trust_score: 8.5,
              is_pending_sync: false,
            },
          ],
          initialPosts: [
            {
              id: 2,
              client_mutation_id: '44444444-4444-4444-8444-444444444402',
              sector_id: 1,
              category_id: 4,
              operational_mode: 'EMERGENCIA',
              post_type: 'SOS_VULNERABLE',
              title: 'Adulto mayor requiere oxígeno urgente',
              description: 'Vecinos, se requiere apoyo en [DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]',
              urgency_level: 'CRITICA',
              public_lat: -12.0754,
              public_lng: -77.0487,
              privacy_radius_meters: 50,
              status: 'ACTIVO',
              client_created_at: new Date().toISOString(),
              is_pending_sync: false,
            },
          ],
        }),
      })
    );

    expect(mapHtml).toContain('data-testid="sos-privacy-circle-50m"');
    expect(mapHtml).toContain('data-radius-meters="50"');
    expect(mapHtml).toContain('SOS ~50m');
    expect(mapHtml).toContain('OpenStreetMap');

    const modalHtml = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(QuickPublishModal, {
          isOpen: true,
          onClose: () => {},
          customDb: testDb,
        }),
      })
    );

    expect(modalHtml).toContain('Publicación Asistida en 3 Clics');
    expect(modalHtml).toContain('1. Dictar con Micrófono (es-PE)');
    expect(modalHtml).toContain('2. Clasificar Automáticamente con IA y GPS');
  });
});
