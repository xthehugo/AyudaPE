import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_SECTORS,
  DEFAULT_SECTOR,
  type ILocationContextState,
  LocationProvider,
  useLocation,
} from '../location-context';

describe('LocationContext: Contexto Territorial Hiperlocal, Sectores y Radio', () => {
  it('1. Configura Huancayo · El Tambo como sector por defecto y ofrece los 6 sectores requeridos', () => {
    expect(DEFAULT_SECTOR.id).toBe('huancayo-el-tambo');
    expect(DEFAULT_SECTOR.name).toBe('Huancayo · El Tambo');
    expect(DEFAULT_SECTOR.department).toBe('Junín');
    expect(DEFAULT_SECTOR.centerLat).toBe(-12.0528);
    expect(DEFAULT_SECTOR.centerLng).toBe(-75.2155);

    expect(AVAILABLE_SECTORS).toHaveLength(6);
    const sectorIds = AVAILABLE_SECTORS.map((s) => s.id);
    expect(sectorIds).toContain('huancayo-el-tambo');
    expect(sectorIds).toContain('huancayo-san-carlos');
    expect(sectorIds).toContain('huancayo-centro');
    expect(sectorIds).toContain('zona-critica-huaytapallana');
    expect(sectorIds).toContain('zona-critica-mantaro');
    expect(sectorIds).toContain('lima-jesus-maria-4');

    const catastropheSectors = AVAILABLE_SECTORS.filter((s) => s.isCatastropheZone);
    expect(catastropheSectors).toHaveLength(2);
  });

  it('2. Provee valores seguros y no lanza excepciones al invocar useLocation() fuera de LocationProvider', () => {
    let capturedState: ILocationContextState | null = null;

    function TestConsumer() {
      capturedState = useLocation();
      return React.createElement('div', null, capturedState.currentSector.name);
    }

    const html = renderToStaticMarkup(React.createElement(TestConsumer));
    expect(html).toContain('Huancayo · El Tambo');
    expect(capturedState).not.toBeNull();
    const state = capturedState as unknown as ILocationContextState;
    expect(state.currentSector.id).toBe('huancayo-el-tambo');
    expect(state.availableSectors).toHaveLength(6);
    expect(state.activeRadius).toBeNull();
  });

  it('3. Inicializa correctamente con sector y radio personalizados mediante LocationProvider', () => {
    let capturedState: ILocationContextState | null = null;

    function CustomConsumer() {
      capturedState = useLocation();
      return React.createElement(
        'div',
        null,
        `${capturedState.currentSector.id}-${capturedState.activeRadius}`
      );
    }

    const html = renderToStaticMarkup(
      React.createElement(
        LocationProvider,
        {
          initialSectorId: 'huancayo-san-carlos',
          initialRadius: 500,
        },
        React.createElement(CustomConsumer)
      )
    );

    expect(html).toContain('huancayo-san-carlos-500');
    expect(capturedState).not.toBeNull();
    const state = capturedState as unknown as ILocationContextState;
    expect(state.currentSector.id).toBe('huancayo-san-carlos');
    expect(state.currentSector.centerLat).toBe(-12.0625);
    expect(state.currentSector.centerLng).toBe(-75.2005);
    expect(state.activeRadius).toBe(500);
  });
});
