'use client';

import React, { useRef } from 'react';
import './MapFilters.css';

export type MapFiltersRadius = 200 | 500 | 1000 | 0;
export type MapFiltersCategory = 'todos' | 'oficio' | 'favor' | 'sos';

export interface MapFiltersProps {
  radius?: MapFiltersRadius;
  onRadiusChange?: (value: MapFiltersRadius) => void;
  category?: MapFiltersCategory;
  onCategoryChange?: (value: MapFiltersCategory) => void;
}

const RADIUS_STOPS: Array<{ value: MapFiltersRadius; label: string; summary: string }> = [
  { value: 200, label: '200 m', summary: 'Hasta 200 m' },
  { value: 500, label: '500 m', summary: 'Hasta 500 m' },
  { value: 1000, label: '1 km', summary: 'Hasta 1 km' },
  { value: 0, label: 'Todo', summary: 'Toda la zona' },
];

export function MapFilters({
  radius = 500,
  onRadiusChange,
  category = 'todos',
  onCategoryChange,
}: MapFiltersProps): React.ReactElement {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = RADIUS_STOPS.findIndex((s) => s.value === radius);
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 1; // 500m por defecto
  const currentSummary = RADIUS_STOPS[safeIndex]?.summary ?? 'Hasta 500 m';

  // Ancho de línea rellena: 200m -> 0%, 500m -> 25%, 1km -> 50%, Todo -> 75%
  const filledWidthPercent = safeIndex * 25;

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = Math.min(RADIUS_STOPS.length - 1, index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = Math.max(0, index - 1);
    }

    if (nextIndex !== index) {
      const nextStop = RADIUS_STOPS[nextIndex];
      if (nextStop) {
        onRadiusChange?.(nextStop.value);
        buttonRefs.current[nextIndex]?.focus();
      }
    }
  };

  return (
    <section aria-label="Filtros del mapa" className="map-filters-card">
      {/* Grupo Distancia */}
      <div className="map-filters-group">
        <div className="map-filters-header">
          <span className="map-filters-label">Distancia</span>
          <span className="map-filters-summary">{currentSummary}</span>
        </div>

        <div role="radiogroup" aria-label="Distancia" className="map-filters-stops-container">
          {/* Línea base */}
          <span className="map-filters-base-line" aria-hidden="true" />
          {/* Línea rellena */}
          <span
            className="map-filters-filled-line"
            style={{ width: `${filledWidthPercent}%` }}
            aria-hidden="true"
          />

          {RADIUS_STOPS.map((stop, idx) => {
            const isSelected = idx === safeIndex;
            const isPast = idx < safeIndex;

            return (
              <button
                key={stop.value}
                ref={(el) => {
                  buttonRefs.current[idx] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onRadiusChange?.(stop.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className="map-filters-stop-btn min-h-[56px]"
              >
                <div className="map-filters-point-wrapper">
                  {isSelected ? (
                    <span className="map-filters-dot-active" />
                  ) : isPast ? (
                    <span className="map-filters-dot-past" />
                  ) : (
                    <span className="map-filters-dot-future" />
                  )}
                </div>
                <span
                  className={`map-filters-stop-text ${
                    isSelected ? 'map-filters-stop-text-active' : 'map-filters-stop-text-inactive'
                  }`}
                >
                  {stop.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grupo Mostrar */}
      <div className="map-filters-group">
        <span className="map-filters-label">Mostrar</span>

        <div
          role="group"
          aria-label="Capas del mapa barrial"
          data-testid="map-layers-group"
          className="map-filters-chips-row"
        >
          {/* Chip Todos */}
          <button
            type="button"
            aria-pressed={category === 'todos'}
            onClick={() => onCategoryChange?.('todos')}
            className={`map-filters-chip min-h-[48px] ${
              category === 'todos' ? 'map-filters-chip-active-todos' : ''
            }`}
          >
            <span>Todos</span>
          </button>

          {/* Chip Oficios */}
          <button
            type="button"
            aria-pressed={category === 'oficio'}
            onClick={() => onCategoryChange?.('oficio')}
            className={`map-filters-chip min-h-[48px] ${
              category === 'oficio' ? 'map-filters-chip-active-oficios' : ''
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ color: category === 'oficio' ? '#ffffff' : '#0B6CB8' }}
            >
              <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.2-.5-.5-2.2z" />
            </svg>
            <span>Oficios y Productos</span>
          </button>

          {/* Chip Favores */}
          <button
            type="button"
            aria-pressed={category === 'favor'}
            onClick={() => onCategoryChange?.('favor')}
            className={`map-filters-chip min-h-[48px] ${
              category === 'favor' ? 'map-filters-chip-active-favores' : ''
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ color: category === 'favor' ? '#ffffff' : '#0F7A55' }}
            >
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
            <span>Favores</span>
          </button>

          {/* Chip SOS */}
          <button
            type="button"
            aria-pressed={category === 'sos'}
            onClick={() => onCategoryChange?.('sos')}
            className={`map-filters-chip min-h-[48px] ${
              category === 'sos' ? 'map-filters-chip-active-sos' : ''
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ color: category === 'sos' ? '#ffffff' : '#B91C1C' }}
            >
              <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />
            </svg>
            <span>SOS</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default MapFilters;
