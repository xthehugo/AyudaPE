import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyRootThemeClasses, ModeProvider } from '@/context/mode-context';
import { AppShell } from '../app-shell';
import { BottomNavigation } from '../bottom-nav';
import { OfflineBanner } from '../offline-banner';

describe('MOD-10: App Shell Mobile-First, Conmutador Dual y Accesibilidad WCAG AAA', () => {
  it('1. Conmuta instantáneamente (<5ms) las clases emergency-mode y font-scale-large en el nodo raíz HTML', () => {
    const classSet = new Set<string>();
    const attrs = new Map<string, string>();

    const mockRootElement = {
      classList: {
        add: (cls: string) => classSet.add(cls),
        remove: (cls: string) => classSet.delete(cls),
      },
      setAttribute: (k: string, v: string) => attrs.set(k, v),
    } as unknown as HTMLElement;

    const start = performance.now();
    applyRootThemeClasses(mockRootElement, 'EMERGENCIA', 'LARGE');
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(5);
    expect(classSet.has('emergency-mode')).toBe(true);
    expect(classSet.has('font-scale-large')).toBe(true);
    expect(attrs.get('data-operational-mode')).toBe('EMERGENCIA');

    applyRootThemeClasses(mockRootElement, 'HABITUAL', 'NORMAL');
    expect(classSet.has('emergency-mode')).toBe(false);
    expect(classSet.has('font-scale-large')).toBe(false);
    expect(attrs.get('data-operational-mode')).toBe('HABITUAL');
  });

  it('2. Renderiza OfflineBanner con alerta "Modo Sin Red / Guardado Local Seguro" y contador de Outbox', () => {
    const html = renderToStaticMarkup(
      React.createElement(OfflineBanner, {
        overrideOnline: false,
        overridePendingCount: 3,
      })
    );

    expect(html).toContain('Modo Sin Red / Guardado Local Seguro');
    expect(html).toContain('3 acción(es) resguardada(s) en memoria local (Outbox)');
    expect(html).toContain('role="status"');
  });

  it('3. Verifica áreas táctiles >= 48px/56px y navegación accesible en BottomNavigation y AppShell', () => {
    const navHtml = renderToStaticMarkup(
      React.createElement(BottomNavigation, {
        activeTab: 'DIRECTORIO',
        onSelectTab: () => {},
        onOpenQuickPublish: () => {},
      })
    );

    expect(navHtml).toContain('Directorio');
    expect(navHtml).toContain('Mapa Barrial');
    expect(navHtml).toContain('Muro Solidario');
    expect(navHtml).toContain('Copiloto IA');
    expect(navHtml).toContain('min-h-[56px]');
    expect(navHtml).toContain('aria-current="page"');

    const shellHtml = renderToStaticMarkup(
      React.createElement(ModeProvider, {
        children: React.createElement(AppShell, {
          activeTab: 'MURO',
          onSelectTab: () => {},
          onOpenQuickPublish: () => {},
          children: React.createElement('section', null, 'Contenido Principal RedVecina'),
        }),
      })
    );

    expect(shellHtml).toContain('RedVecina');
    expect(shellHtml).toContain('Jesús María · Sector 4');
    expect(shellHtml).toContain('min-h-[48px]');
    expect(shellHtml).toContain('A / A+');
  });
});
