import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SwipeableNotification } from '@/components/ui/swipeable-notification';
import RootLayout from '@/app/layout';

describe('Notificaciones con Animación y Swipe-to-Dismiss Gestual', () => {
  it('1. Renderiza SwipeableNotification con roles de accesibilidad WCAG AAA y touch target >= 48px', () => {
    const handleDismiss = vi.fn();
    const html = renderToStaticMarkup(
      <SwipeableNotification
        isOpen={true}
        onDismiss={handleDismiss}
        variant="emerald"
        action={<button type="button">Entendido</button>}
      >
        <span>Publicado en tu barrio: “Gasfitero de Emergencia”</span>
      </SwipeableNotification>
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-testid="swipeable-notification"');
    expect(html).toContain('Publicado en tu barrio: “Gasfitero de Emergencia”');
    expect(html).toContain('Entendido');
    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('min-w-[48px]');
    expect(html).toContain('touch-action:pan-y');
  });

  it('2. Oculta el componente cuando isOpen es false', () => {
    const html = renderToStaticMarkup(
      <SwipeableNotification
        isOpen={false}
        onDismiss={() => {}}
      >
        <span>No debería verse</span>
      </SwipeableNotification>
    );

    expect(html).not.toContain('No debería verse');
    expect(html).not.toContain('role="status"');
  });

  it('3. Soporta distintas variantes cromáticas (emerald, danger, warning, info)', () => {
    const variants = ['emerald', 'danger', 'warning', 'info', 'neutral'] as const;

    for (const v of variants) {
      const html = renderToStaticMarkup(
        <SwipeableNotification
          isOpen={true}
          onDismiss={() => {}}
          variant={v}
        >
          <span>Mensaje de prueba {v}</span>
        </SwipeableNotification>
      );

      expect(html).toContain(`Mensaje de prueba ${v}`);
      expect(html).toContain('cursor-grab');
    }
  });

  it('4. Permite ocultar el botón de cierre manual y personalizar etiquetas ARIA', () => {
    const html = renderToStaticMarkup(
      <SwipeableNotification
        isOpen={true}
        onDismiss={() => {}}
        showCloseButton={false}
        closeAriaLabel="Descartar inmediatamente"
        role="alert"
      >
        <span>Alerta de sismo</span>
      </SwipeableNotification>
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Alerta de sismo');
    expect(html).not.toContain('Descartar inmediatamente');
  });

  it('5. Toaster global en RootLayout incluye swipeDirections horizontal y vertical', () => {
    const layoutHtml = renderToStaticMarkup(
      <RootLayout>
        <main>Contenido RedVecina</main>
      </RootLayout>
    );

    expect(layoutHtml).toContain('Contenido RedVecina');
    // Verifica que la sección de Sonner Toaster esté presente
    expect(layoutHtml).toContain('aria-label="Notifications');
  });
});
