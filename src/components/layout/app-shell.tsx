'use client';

import React, { useEffect } from 'react';
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

  useEffect(() => {
    const unsub = initializeMeshRelayListener();
    return () => {
      unsub();
    };
  }, []);

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
