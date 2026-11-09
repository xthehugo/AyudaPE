'use client';

import React, { useEffect, useState } from 'react';
import { useOperationalMode } from '@/context/mode-context';
import { GuidedTourModal } from '@/components/onboarding/guided-tour-modal';
import { BottomNavigation, type NavigationTabId } from './bottom-nav';
import { MobileShell } from './mobile-shell';
import { OfflineBanner } from './offline-banner';
import { TopBar } from './top-bar';
import { FloatingNotificationBell } from '@/components/notifications/floating-notification-bell';
import { initializeMeshRelayListener } from '@/lib/mesh/mesh-relay';

export interface AppShellProps {
  activeTab: NavigationTabId;
  onSelectTab: (tab: NavigationTabId) => void;
  onOpenQuickPublish: () => void;
  onOpenSosPublish?: () => void;
  hasEmergency?: boolean;
  children: React.ReactNode;
}

/**
 * App Shell Mobile-First y Accesible WCAG AAA:
 * - Cabecera global limpia (sin títulos de app ni marcas invasivas).
 * - Banner de sincronización violeta ubicado DEBAJO de la cabecera.
 * - Fondo suave #F4F5F7 con tipografía Plus Jakarta Sans y bordes suaves.
 */
export function AppShell({
  activeTab,
  onSelectTab,
  onOpenQuickPublish,
  onOpenSosPublish,
  hasEmergency,
  children,
}: AppShellProps): React.ReactElement {
  const { isOnboardingOpen, setIsOnboardingOpen } = useOperationalMode();
  const [showFloatingGuide, setShowFloatingGuide] = useState<boolean>(false);

  useEffect(() => {
    const unsub = initializeMeshRelayListener();
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const completed = localStorage.getItem('ayudape_tour_completed') === 'true';
    setShowFloatingGuide(!completed);
  }, [isOnboardingOpen]);

  return (
    <MobileShell>
      {/* 1. Cabecera Global con ubicación y acciones SOS / 105 / Perfil */}
      <TopBar
        onOpenTutorial={() => setIsOnboardingOpen(true)}
        onOpenSosPublish={onOpenSosPublish ?? onOpenQuickPublish}
      />

      {/* 2. Banner de Sincronización Violeta (va DEBAJO de la cabecera, solo si hay conexión y pendientes) */}
      <OfflineBanner sectorId={1} />

      <main className="flex-1 w-full max-w-full px-4 py-4 space-y-4">
        {children}
      </main>

      <FloatingNotificationBell />

      {/* 3. Botón flotante inicial de la Llama Andina (solo se muestra mientras no se haya completado el tour) */}
      {showFloatingGuide && !isOnboardingOpen && (
        <button
          type="button"
          onClick={() => setIsOnboardingOpen(true)}
          className="fixed bottom-[76px] left-4 z-40 min-h-[48px] h-12 px-3.5 rounded-full bg-white dark:bg-slate-900 text-[#12285A] dark:text-sky-200 border-2 border-[#12285A]/25 shadow-xl flex items-center gap-2 font-black text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
          aria-label="Abrir guía de la página con la llama andina"
        >
          <div className="w-7 h-7 rounded-full overflow-hidden border border-white shadow-xs shrink-0 bg-slate-100">
            <img
              src="/llama.jpeg"
              alt="Llama Guía"
              className="w-full h-full object-cover"
              style={{ objectPosition: '50% 30%' }}
            />
          </div>
          <span className="tracking-tight">¿Cómo funciona? Guía</span>
        </button>
      )}

      <BottomNavigation
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        onOpenQuickPublish={onOpenQuickPublish}
        hasEmergency={hasEmergency}
      />

      <GuidedTourModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </MobileShell>
  );
}

export default AppShell;
