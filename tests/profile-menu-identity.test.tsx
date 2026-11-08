import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RescatistaMenuSheet } from '@/components/layout/rescatista-menu-sheet';
import { ModeContext, type ModeContextValue } from '@/context/mode-context';

vi.mock('@/hooks/use-network-sync', () => ({
  useNetworkSync: () => ({
    isOnline: true,
    triggerSync: vi.fn().mockResolvedValue(true),
  }),
}));

describe('RescatistaMenuSheet · Vecinos del barrio, DNI RENIEC y Brigadista por SMS OTP', () => {
  const defaultContextValue: ModeContextValue = {
    mode: 'HABITUAL',
    setMode: vi.fn(),
    toggleMode: vi.fn(),
    fontScale: 'NORMAL',
    toggleFontScale: vi.fn(),
    activeRole: 'VECINO',
    setActiveRole: vi.fn(),
    isOnboardingOpen: false,
    setIsOnboardingOpen: vi.fn(),
  };

  it('1. Muestra el menú "Vecinos del barrio" con opción de solicitar rol de Brigadista (SMS OTP) y verificar DNI RENIEC', () => {
    const html = renderToStaticMarkup(
      <ModeContext.Provider value={defaultContextValue}>
        <RescatistaMenuSheet isOpen={true} onClose={() => {}} onOpenTutorial={() => {}} />
      </ModeContext.Provider>
    );

    expect(html).not.toContain('Iniciar sesión');
    expect(html).not.toContain('Crear cuenta');

    expect(html).toContain('Vecinos del barrio');
    expect(html).toContain('Sin verificar');
    expect(html).toContain('Solicitar rol de Brigadista (Validar SMS)');
    expect(html).toContain('Verificar mi identidad (DNI)');
    // No muestra "Reunir / Junta" en el menú para usuarios no brigadistas
    expect(html).not.toContain('Reunir / Junta');
  });

  it('2. Muestra estado acreditado de Brigadista con acceso a Bóveda PII Ley N° 29733', () => {
    const brigadistaContext: ModeContextValue = {
      ...defaultContextValue,
      activeRole: 'BRIGADISTA_CERTIFICADO',
    };

    const html = renderToStaticMarkup(
      <ModeContext.Provider value={brigadistaContext}>
        <RescatistaMenuSheet isOpen={true} onClose={() => {}} onOpenTutorial={() => {}} />
      </ModeContext.Provider>
    );

    expect(html).toContain('Brigadista Activo');
    expect(html).toContain('Ley N° 29733');
    expect(html).toContain('Volver a modo Vecino');
  });
});
