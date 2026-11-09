'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { OperationalMode, SystemRole } from '@shared/types';

export type FontScaleMode = 'NORMAL' | 'LARGE';

export interface ModeContextValue {
  mode: OperationalMode;
  setMode: (nextMode: OperationalMode) => void;
  toggleMode: () => void;
  fontScale: FontScaleMode;
  toggleFontScale: () => void;
  activeRole: SystemRole;
  setActiveRole: (role: SystemRole) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
}

export const MODE_STORAGE_KEY = 'redvecina_operational_mode';
export const FONT_SCALE_STORAGE_KEY = 'redvecina_font_scale';
export const ROLE_STORAGE_KEY = 'redvecina_active_role';
export const THEME_STORAGE_KEY = 'redvecina_theme';

export interface ModeContextValue {
  mode: OperationalMode;
  setMode: (nextMode: OperationalMode) => void;
  toggleMode: () => void;
  fontScale: FontScaleMode;
  toggleFontScale: () => void;
  activeRole: SystemRole;
  setActiveRole: (role: SystemRole) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const ModeContext = createContext<ModeContextValue | undefined>(undefined);

/**
 * Sincroniza de forma inmediata (<5ms) las clases CSS del nodo raíz HTML
 * para que las variables CSS de alto contraste AAA y tamaño de letra surtan efecto sin parpadeos.
 */
export function applyRootThemeClasses(
  rootElement: HTMLElement | null | undefined,
  mode: OperationalMode,
  fontScale: FontScaleMode,
  isDark?: boolean
): void {
  if (!rootElement) return;

  if (mode === 'EMERGENCIA') {
    rootElement.classList.add('emergency-mode');
    rootElement.setAttribute('data-operational-mode', 'EMERGENCIA');
  } else {
    rootElement.classList.remove('emergency-mode');
    rootElement.setAttribute('data-operational-mode', 'HABITUAL');
  }

  if (fontScale === 'LARGE') {
    rootElement.classList.add('font-scale-large');
  } else {
    rootElement.classList.remove('font-scale-large');
  }

  if (isDark) {
    rootElement.classList.add('dark');
  } else {
    rootElement.classList.remove('dark');
  }
}

export function ModeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [mode, setModeState] = useState<OperationalMode>('HABITUAL');
  const [fontScale, setFontScaleState] = useState<FontScaleMode>('NORMAL');
  const [activeRole, setActiveRoleState] = useState<SystemRole>('VECINO');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (savedMode === 'EMERGENCIA' || savedMode === 'HABITUAL') {
        setModeState(savedMode);
      }

      const savedScale = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
      if (savedScale === 'LARGE' || savedScale === 'NORMAL') {
        setFontScaleState(savedScale);
      }

      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
      }

      const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY) as SystemRole | null;
      if (
        savedRole === 'VECINO' ||
        savedRole === 'BRIGADISTA_CERTIFICADO' ||
        savedRole === 'LIDER_VECINAL' ||
        savedRole === 'OPERADOR_MUNICIPAL'
      ) {
        setActiveRoleState(savedRole);
      }

      // Si el usuario es nuevo, abrir la Guía Interactiva con la Llama Andina
      const tourSeen = window.localStorage.getItem('ayudape_tour_seen');
      if (!tourSeen) {
        setTimeout(() => {
          setIsOnboardingOpen(true);
        }, 650);
      }
    } catch {
      // Ignorar si localStorage está bloqueado en navegación privada
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      applyRootThemeClasses(document.documentElement, mode, fontScale, isDarkMode);
    }
  }, [mode, fontScale, isDarkMode]);

  const setMode = useCallback((nextMode: OperationalMode) => {
    setModeState(nextMode);
    if (typeof document !== 'undefined') {
      applyRootThemeClasses(document.documentElement, nextMode, fontScale, isDarkMode);
    }
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, nextMode);
    } catch {
      // Ignorar errores de almacenamiento
    }
  }, [fontScale, isDarkMode]);

  const toggleMode = useCallback(() => {
    setMode(mode === 'HABITUAL' ? 'EMERGENCIA' : 'HABITUAL');
  }, [mode, setMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        applyRootThemeClasses(document.documentElement, mode, fontScale, next);
      }
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  }, [fontScale, mode]);

  const toggleFontScale = useCallback(() => {
    const nextScale: FontScaleMode = fontScale === 'NORMAL' ? 'LARGE' : 'NORMAL';
    setFontScaleState(nextScale);
    if (typeof document !== 'undefined') {
      applyRootThemeClasses(document.documentElement, mode, nextScale, isDarkMode);
    }
    try {
      window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, nextScale);
    } catch {
      // Ignorar
    }
  }, [fontScale, isDarkMode, mode]);

  const setActiveRole = useCallback((role: SystemRole) => {
    setActiveRoleState(role);
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch {
      // Ignorar
    }
  }, []);

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        fontScale,
        toggleFontScale,
        activeRole,
        setActiveRole,
        isOnboardingOpen,
        setIsOnboardingOpen,
        isDarkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useOperationalMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    throw new Error('useOperationalMode debe usarse dentro de un <ModeProvider>');
  }
  return ctx;
}
