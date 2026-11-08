import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import HomePage from '@/app/page';
import {
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
} from '@/lib/initial-data';
import { ModeProvider } from '@/context/mode-context';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import {
  ProximityCatalogView,
  submitOptimisticEndorsement,
} from '../proximity-catalog-view';
import {
  SolidarityWallView,
  submitOptimisticResourceCommitment,
} from '../solidarity-wall-view';

describe('MOD-12: Vistas de Catálogo de Proximidad, Muro Solidario, Coordinación de Recursos y HomePage', () => {
  let testDb: RedVecinaLocalDB;

  beforeEach(async () => {
    testDb = new RedVecinaLocalDB(`Mod12ViewsDB_${Date.now()}_${Math.random()}`);
    await testDb.bulkCacheListings(INITIAL_SECTOR_LISTINGS);
    await testDb.bulkCachePosts(INITIAL_SECTOR_POSTS);
  });

  it('1. Actualiza de forma optimista (<16ms) el puntaje de Visto Bueno Vecinal (Haversine <= 200m = +1.5) y encola en Outbox', async () => {
    const targetListing = INITIAL_SECTOR_LISTINGS[0]!;

    const start = performance.now();
    const { updatedListing } = await submitOptimisticEndorsement({
      listing: targetListing,
      skillTag: 'Excelente gasfitero de la cuadra',
      comment: 'Reparó la fuga de nuestra cisterna en 20 minutos.',
      endorserLat: -12.0752,
      endorserLng: -77.0484,
      db: testDb,
    });
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(50);
    expect(updatedListing.endorsement_count).toBe(targetListing.endorsement_count + 1);
    expect(updatedListing.weighted_trust_score).toBe(
      Number((targetListing.weighted_trust_score + 1.5).toFixed(2))
    );

    const outbox = await testDb.getPendingMutations();
    expect(outbox.length).toBe(1);
    expect(outbox[0]?.endpoint).toContain('/endorse');
  });

  it('2. Actualiza de forma optimista (<16ms) la barra de progreso de recursos (3 de 5 -> 5 de 5 bidones cubiertos) y marca ATENDIDO', async () => {
    const targetPost = INITIAL_SECTOR_POSTS[0]!;
    const initialResource = {
      id: 1,
      client_mutation_id: '55555555-5555-4555-8555-555555555501',
      post_client_mutation_id: targetPost.client_mutation_id,
      item_name: 'Bidones de agua potable',
      unit: 'bidones',
      quantity_needed: 5,
      quantity_committed: 3,
    };

    const { updatedResource, updatedPost } = await submitOptimisticResourceCommitment({
      post: targetPost,
      resource: initialResource,
      committedQuantity: 2,
      commitmentNote: 'Llevo 2 bidones sellados al bloque C',
      db: testDb,
    });

    expect(updatedResource.quantity_committed).toBe(5);
    expect(updatedPost.status).toBe('ATENDIDO');

    const storedCommitments = await testDb.commitments.toArray();
    expect(storedCommitments.length).toBe(1);
    expect(storedCommitments[0]?.committed_quantity).toBe(2);

    const outbox = await testDb.getPendingMutations();
    expect(outbox.length).toBe(1);
    expect(outbox[0]?.endpoint).toContain('/commitments');
  });

  it('3. Renderiza ProximityCatalogView, SolidarityWallView (con barra "3 de 5 bidones cubiertos") y HomePage integrada', () => {
    const catalogHtml = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(ProximityCatalogView, {
          customDb: testDb,
          initialListings: INITIAL_SECTOR_LISTINGS,
        }),
      })
    );

    expect(catalogHtml).toContain('Gasfitería Maestro Jorge');
    expect(catalogHtml).toContain('Dar Visto Bueno');

    const wallHtml = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(SolidarityWallView, {
          customDb: testDb,
          initialPosts: INITIAL_SECTOR_POSTS,
        }),
      })
    );

    expect(wallHtml).toContain('3 de 5 bidones cubiertos');
    expect(wallHtml).toContain('Comprometer Recurso / Ayuda');
    expect(wallHtml).toContain('role="progressbar"');

    const homeHtml = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(HomePage),
      })
    );

    expect(homeHtml).toContain('RedVecina');
    expect(homeHtml).toContain('Economía Barrial y Soporte de Proximidad');
  });
});
