import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FavorCard } from '@/components/solidarity/favor-card';
import { ModeProvider } from '@/context/mode-context';
import type { IPostLocal } from '@shared/types';
import type { ResourceProgressItem } from '@/components/views/solidarity-wall-view';

describe('Módulo Solidario: Ocultar "En coordinación" y Circunferencia de Progreso', () => {
  const samplePost: IPostLocal = {
    id: 1,
    client_mutation_id: '44444444-4444-4444-8444-444444444401',
    sector_id: 1,
    category_id: 6,
    operational_mode: 'HABITUAL',
    post_type: 'SOLICITUD_FAVOR',
    title: 'Acopio solidario de agua potable para adultos mayores del bloque C',
    description:
      'Vecinos, por corte programado de SEDAPAL estamos reuniendo bidones de agua potable sin costo para los pisos altos.',
    urgency_level: 'ALTA',
    public_lat: -12.0753,
    public_lng: -77.0484,
    privacy_radius_meters: 0,
    status: 'EN_COORDINACION',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  };

  const sampleResources: ResourceProgressItem[] = [
    {
      id: 1,
      client_mutation_id: 'res-01',
      post_client_mutation_id: '44444444-4444-4444-8444-444444444401',
      item_name: 'Bidones de agua potable',
      unit: 'bidones',
      quantity_needed: 5,
      quantity_committed: 3,
    },
  ];

  it('1. NO muestra el estado "En coordinación" en las tarjetas del módulo solidario', () => {
    const html = renderToStaticMarkup(
      <ModeProvider>
        <FavorCard
          post={samplePost}
          resources={sampleResources}
          onCommitResource={() => {}}
        />
      </ModeProvider>
    );

    // Debe omitir "En coordinación"
    expect(html).not.toContain('En coordinación');
    expect(html).not.toContain('En coordinacion');
  });

  it('2. Renderiza una circunferencia SVG con la fracción (3/5) y porcentaje (60%) en su interior', () => {
    const html = renderToStaticMarkup(
      <ModeProvider>
        <FavorCard
          post={samplePost}
          resources={sampleResources}
          onCommitResource={() => {}}
        />
      </ModeProvider>
    );

    // Verifica que existe la circunferencia SVG con stroke
    expect(html).toContain('<svg');
    expect(html).toContain('circle');
    expect(html).toContain('stroke-dasharray');
    expect(html).toContain('stroke-dashoffset');
    expect(html).toContain('role="progressbar"');

    // Verifica la fracción y el porcentaje dentro de la circunferencia
    expect(html).toContain('3/5');
    expect(html).toContain('60%');
    expect(html).toContain('Bidones de agua potable');
    expect(html).toContain('Meta: 5 bidones');
  });

  it('3. Calcula adecuadamente el 100% y 0% en la circunferencia', () => {
    const completedResources: ResourceProgressItem[] = [
      {
        id: 2,
        client_mutation_id: 'res-completed',
        post_client_mutation_id: '44444444-4444-4444-8444-444444444401',
        item_name: 'Frazadas de lana',
        unit: 'frazadas',
        quantity_needed: 10,
        quantity_committed: 10,
      },
    ];

    const htmlCompleted = renderToStaticMarkup(
      <ModeProvider>
        <FavorCard
          post={samplePost}
          resources={completedResources}
          onCommitResource={() => {}}
        />
      </ModeProvider>
    );

    expect(htmlCompleted).toContain('10/10');
    expect(htmlCompleted).toContain('100%');

    // Caso de post sin recursos explícitos (0/1 y 0%)
    const htmlEmpty = renderToStaticMarkup(
      <ModeProvider>
        <FavorCard
          post={samplePost}
          resources={[]}
          onCommitResource={() => {}}
        />
      </ModeProvider>
    );

    expect(htmlEmpty).toContain('0/1');
    expect(htmlEmpty).toContain('0%');
  });

  it('4. Garantiza áreas táctiles ergonómicas (>= 48px) en las acciones de ayuda y llamada', () => {
    const onCommit = vi.fn();
    const html = renderToStaticMarkup(
      <ModeProvider>
        <FavorCard
          post={samplePost}
          resources={sampleResources}
          onCommitResource={onCommit}
        />
      </ModeProvider>
    );

    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('min-w-[48px]');
    expect(html).toContain('Quiero ayudar');
  });
});
