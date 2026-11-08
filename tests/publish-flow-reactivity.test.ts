import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { executeQuickPublishPersist } from '@/components/publish/quick-publish-modal';
import { QuickPublishSheet } from '@/components/publish/quick-publish-sheet';
import { ModeProvider } from '@/context/mode-context';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import type { NeighborIntent } from '@shared/schemas';

describe('Nuevo Flujo de Publicar (Punto 4) y Flujo SOS (Punto 5)', () => {
  it('1. Renderiza QuickPublishSheet en "¿Qué deseas compartir hoy?" sin asuntos frecuentes ni nivel de prioridad y con botón único "Publicar"', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(QuickPublishSheet, {
          isOpen: true,
          onClose: () => {},
        }),
      })
    );

    // Encabezado y selector de categorías
    expect(html).toContain('¿Qué deseas compartir hoy?');
    expect(html).toContain('Oficio');
    expect(html).toContain('Producto');
    expect(html).toContain('Favor solidario');
    expect(html).toContain('SOS');

    // Eliminados: Asuntos más frecuentes y Nivel de prioridad asignado
    expect(html).not.toContain('Asuntos más frecuentes');
    expect(html).not.toContain('Nivel de prioridad asignado');

    // Campos de Oficio (por defecto): Nombre, Título, Descripción, Ubicación, Foto (opcional)
    expect(html).toContain('Nombre');
    expect(html).toContain('Título');
    expect(html).toContain('Descripción');
    expect(html).toContain('Ubicación');
    expect(html).toContain('Foto (opcional)');
    expect(html).not.toContain('Número de contacto');

    // Botón principal único: "Publicar"
    expect(html).toContain('>Publicar<');
  });

  it('2. Renderiza QuickPublishSheet en modo SOS con un solo campo "¿Qué sucedió?" y sin campo de ubicación en el formulario', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(QuickPublishSheet, {
          isOpen: true,
          initialSos: true,
          onClose: () => {},
        }),
      })
    );

    expect(html).toContain('¿Qué sucedió?');
    expect(html).not.toContain('Toca el mapa para ajustar la ubicación');
    expect(html).not.toContain('Foto (opcional)');
    expect(html).not.toContain('Asuntos más frecuentes');
    expect(html).not.toContain('Nivel de prioridad asignado');
    expect(html).toContain('>Publicar<');
  });

  it('3. Persiste una publicación con coordenadas GPS exactas y foto en Dexie y Outbox', async () => {
    const testDb = new RedVecinaLocalDB(`TestPublishDb_${Date.now()}`);

    const testIntent: NeighborIntent = {
      module: 'OFICIOS_PRODUCTOS',
      post_type: 'SERVICIO_OFICIO',
      category: 'Gasfitería',
      urgency: 'ALTA',
      has_monetary_intent: true,
      zero_money_compliant: false,
      title: 'Gasfitería Maestro Teodoro · Reparación de Fugas',
      description: 'Atención inmediata de rotura de tubería de agua potable en Jr. Sucre.',
    };

    const mockPhotoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const result = await executeQuickPublishPersist({
      intent: testIntent,
      latitude: -12.0768,
      longitude: -75.2174,
      contactPhone: '964-555-888',
      operationalMode: 'HABITUAL',
      photoUrl: mockPhotoBase64,
      db: testDb,
    });

    expect(result.targetCollection).toBe('listings');
    expect(result.client_mutation_id).toBeDefined();

    const storedListings = await testDb.listings.toArray();
    expect(storedListings.length).toBe(1);
    expect(storedListings[0].title).toBe('Gasfitería Maestro Teodoro · Reparación de Fugas');
    expect(storedListings[0].latitude).toBe(-12.0768);
    expect(storedListings[0].longitude).toBe(-75.2174);
    expect(storedListings[0].photo_url).toBe(mockPhotoBase64);

    const outboxMutations = await testDb.outbox.toArray();
    expect(outboxMutations.length).toBe(1);
    expect(outboxMutations[0].endpoint).toBe('/api/v1/listings');

    await testDb.delete();
  });

  it('4. Persiste una alerta SOS con difuminado espacial de 50m en Dexie', async () => {
    const testDb = new RedVecinaLocalDB(`TestSosPublishDb_${Date.now()}`);

    const sosIntent: NeighborIntent = {
      module: 'CADENA_FAVORES',
      post_type: 'SOS_VULNERABLE',
      category: 'Emergencia Médica',
      urgency: 'CRITICA',
      has_monetary_intent: false,
      zero_money_compliant: true,
      is_pii_redacted: true,
      title: 'Auxilio por corte de oxígeno medicinal',
      description: 'Adulto mayor necesita recarga urgente de balón en Jr. Sucre.',
    };

    const result = await executeQuickPublishPersist({
      intent: sosIntent,
      latitude: -12.0768,
      longitude: -75.2174,
      operationalMode: 'EMERGENCIA',
      db: testDb,
    });

    expect(result.targetCollection).toBe('posts');

    const storedPosts = await testDb.posts.toArray();
    expect(storedPosts.length).toBe(1);
    expect(storedPosts[0].urgency_level).toBe('CRITICA');
    expect(storedPosts[0].privacy_radius_meters).toBe(50);
    expect(storedPosts[0].public_lat).not.toBe(-12.0768);

    await testDb.delete();
  });

  it('5. Persiste un compromiso solidario de recurso en Dexie incrementando de 3 a 4 (delta 1)', async () => {
    const testDb = new RedVecinaLocalDB(`TestCommitDb_${Date.now()}`);
    const { submitOptimisticResourceCommitment } = await import('@/components/views/solidarity-wall-view');

    const samplePost = {
      id: 1,
      client_mutation_id: '44444444-4444-4444-8444-444444444401',
      sector_id: 1,
      category_id: 6,
      operational_mode: 'HABITUAL' as const,
      post_type: 'SOLICITUD_FAVOR' as const,
      title: 'Acopio solidario de agua potable para adultos mayores del bloque C',
      description: 'Vecinos estamos reuniendo bidones de agua.',
      urgency_level: 'ALTA' as const,
      public_lat: -12.0753,
      public_lng: -77.0484,
      privacy_radius_meters: 0,
      status: 'EN_COORDINACION' as const,
      client_created_at: new Date().toISOString(),
      is_pending_sync: false,
    };

    const sampleResource = {
      id: 1,
      client_mutation_id: '55555555-5555-4555-8555-555555555501',
      post_client_mutation_id: samplePost.client_mutation_id,
      item_name: 'Bidones de agua potable',
      unit: 'bidones',
      quantity_needed: 5,
      quantity_committed: 3,
    };

    const outcome = await submitOptimisticResourceCommitment({
      post: samplePost,
      resource: sampleResource,
      committedQuantity: 1,
      commitmentNote: 'Llevo 1 bidón en 20 minutos',
      db: testDb,
    });

    expect(outcome.updatedResource.quantity_committed).toBe(4);
    expect(outcome.updatedPost.status).toBe('EN_COORDINACION');

    const storedCommitments = await testDb.commitments.toArray();
    expect(storedCommitments.length).toBe(1);
    expect(storedCommitments[0].committed_quantity).toBe(1);

    const outbox = await testDb.outbox.toArray();
    expect(outbox.length).toBe(1);
    expect(outbox[0].endpoint).toBe('/api/v1/posts/1/commitments');

    await testDb.delete();
  });
});
