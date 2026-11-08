import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ServiceCard, parseListingCardData } from '@/components/directory/service-card';
import type { IListingLocal } from '@shared/types';

describe('ServiceCard: Diseño Visual Fiel al Prototipo de Referencia', () => {
  const teodoroListing: IListingLocal = {
    id: 13,
    client_mutation_id: '33333333-3333-4333-8333-333333333313',
    category_id: 1,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Gasfitería Maestro Teodoro · Termas Solares, Tuberías y Fugas',
    description:
      'Maestro gasfitero vecino de El Tambo. Mantenimiento e instalación de termas solares, desatoro de redes y reparación de fugas críticas de agua potable.',
    contact_phone: '964-555-888',
    latitude: -12.0531,
    longitude: -75.216,
    available_for_emergencies: true,
    emergency_response_note:
      'Herramientas de fontanería especializada y motobomba para achique de anegamientos e inundaciones.',
    endorsement_count: 22,
    weighted_trust_score: 28.5,
    is_pending_sync: false,
  };

  it('1. parseListingCardData extrae correctamente nombre, especialidad, iniciales y nombre corto', () => {
    const data = parseListingCardData(
      teodoroListing.title,
      teodoroListing.category_id,
      teodoroListing.listing_type
    );

    expect(data.providerName).toBe('Maestro Teodoro');
    expect(data.categoryLabel).toBe('Gasfitería');
    expect(data.specialty).toBe('Termas Solares, Tuberías y Fugas');
    expect(data.initials).toBe('MT');
    expect(data.shortName).toBe('Teodoro');
  });

  it('2. Renderiza la tarjeta de Maestro Teodoro con todos los elementos de la imagen de referencia', () => {
    const onEndorse = vi.fn();
    const html = renderToStaticMarkup(
      <ServiceCard
        listing={teodoroListing}
        distanceMeters={64}
        onEndorse={onEndorse}
      />
    );

    // Avatar y punto verde de disponibilidad activa
    expect(html).toContain('MT');
    expect(html).toContain('bg-emerald-600 border-2 border-white');

    // Nombre y categoría con distancia
    expect(html).toContain('Maestro Teodoro');
    expect(html).toContain('Gasfitería · a 64 m de ti');

    // Especialidades en negrita y descripción
    expect(html).toContain('Termas Solares, Tuberías y Fugas');
    expect(html).toContain(
      'Maestro gasfitero vecino de El Tambo. Mantenimiento e instalación de termas solares'
    );

    // Bloque de recomendación comunitaria con avatares solapados
    expect(html).toContain('22 vecinos lo recomiendan');
    expect(html).toContain('Recomendar');

    // Aviso de emergencias 24/7
    expect(html).toContain('Atiende emergencias las 24 horas');

    // Botones de acción inferiores
    expect(html).toContain('Llamar');
    expect(html).toContain('tel:964-555-888');
    expect(html).toContain('https://wa.me/51964555888');
    expect(html).toContain('https://www.google.com/maps/search/?api=1&amp;query=-12.0531,-75.216');
  });

  it('3. Cumple las directrices ergonómicas de touch target (>= 48px) en todos los controles', () => {
    const html = renderToStaticMarkup(
      <ServiceCard
        listing={teodoroListing}
        distanceMeters={64}
        onEndorse={() => {}}
      />
    );

    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('min-w-[48px]');
  });

  it('4. Parsea correctamente diferentes títulos de oficios y servicios comunitarios', () => {
    const alberto = parseListingCardData(
      'Electricista Matriculado Don Alberto · Tableros y Cortocircuitos',
      2,
      'SERVICIO_OFICIO'
    );
    expect(alberto.providerName).toBe('Don Alberto');
    expect(alberto.categoryLabel).toBe('Electricidad');
    expect(alberto.initials).toBe('DA');
    expect(alberto.shortName).toBe('Alberto');

    const rosa = parseListingCardData(
      'Lic. Rosa · Enfermería y Oxígeno Medicinal 24/7',
      4,
      'SOPORTE_EMERGENCIA'
    );
    expect(rosa.providerName).toBe('Lic. Rosa');
    expect(rosa.categoryLabel).toBe('Salud');
    expect(rosa.initials).toBe('LR');
    expect(rosa.shortName).toBe('Rosa');

    const pancho = parseListingCardData(
      'Cerrajería Don Pancho · Apertura y Candados de Emergencia · Jr. Sucre',
      3,
      'SERVICIO_OFICIO'
    );
    expect(pancho.providerName).toBe('Don Pancho');
    expect(pancho.categoryLabel).toBe('Cerrajería');
    expect(pancho.initials).toBe('DP');
    expect(pancho.shortName).toBe('Pancho');
  });
});
