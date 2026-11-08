import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MapFilters } from '@/components/map/MapFilters';

describe('MapFilters · Componente Nuevo de Filtros de la Pantalla Mapa', () => {
  it('1. Renderiza la sección con aria-label="Filtros del mapa" y el grupo Distancia con paradas', () => {
    const html = renderToStaticMarkup(
      <MapFilters
        radius={500}
        onRadiusChange={vi.fn()}
        category="todos"
        onCategoryChange={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="Filtros del mapa"');
    expect(html).toContain('Distancia');
    expect(html).toContain('Hasta 500 m');
    expect(html).toContain('200 m');
    expect(html).toContain('500 m');
    expect(html).toContain('1 km');
    expect(html).toContain('Todo');
    expect(html).toContain('role="radiogroup"');
  });

  it('2. Renderiza el grupo Mostrar con los 4 chips en una fila y sus íconos SVG', () => {
    const html = renderToStaticMarkup(
      <MapFilters
        radius={200}
        onRadiusChange={vi.fn()}
        category="oficio"
        onCategoryChange={vi.fn()}
      />
    );

    expect(html).toContain('Mostrar');
    expect(html).toContain('Todos');
    expect(html).toContain('Oficios');
    expect(html).toContain('Favores');
    expect(html).toContain('SOS');
    // SVG path de llave de oficios
    expect(html).toContain('M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.2-.5-.5-2.2z');
    // SVG path de corazón de favores
    expect(html).toContain('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z');
    // SVG path de alerta SOS
    expect(html).toContain('M12 3 2 20h20zM12 10v4M12 17h.01');
  });
});
