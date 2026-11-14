'use client';

import React, { useContext } from 'react';
import {
  AlertTriangle,
  Heart,
  MapPin,
  Plus,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { ModeContext } from '@/context/mode-context';

export type NavigationTabId = 'DIRECTORIO' | 'MAPA' | 'MURO' | 'COPILOTO';

export interface BottomNavigationProps {
  activeTab: NavigationTabId;
  onSelectTab: (tab: NavigationTabId) => void;
  onOpenQuickPublish: () => void;
  hasEmergency?: boolean;
}

interface NavTabConfig {
  id: NavigationTabId;
  label: string;
  ariaLabel: string;
  renderIcon: () => React.ReactNode;
}

/**
 * Barra de navegación inferior fija adaptativa (Mobile-First):
 * - Flexbox fluido sin desbordamientos en pantallas desde 320px hasta 450px.
 * - Icono de alerta roja en Solidario cuando hay una emergencia activa.
 * - Botón central destacado "+ Publicar" con icono de micrófono y área táctil >= 56px.
 * - Sombra sutil elevada con desenfoque de fondo y microinteracciones de pulsación.
 */
export function BottomNavigation({
  activeTab,
  onSelectTab,
  onOpenQuickPublish,
  hasEmergency,
}: BottomNavigationProps): React.ReactElement {
  const modeCtx = useContext(ModeContext);
  const isEmergencyMode = modeCtx?.mode === 'EMERGENCIA';
  const isEmergencyActive =
    hasEmergency !== undefined ? hasEmergency : isEmergencyMode;

  const primaryNavTabs: NavTabConfig[] = [
    {
      id: 'MAPA',
      label: 'Mapa',
      ariaLabel: 'Mapa Vecinal · Mapa Barrial',
      renderIcon: () => (
        <MapPin className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden="true" />
      ),
    },
    {
      id: 'DIRECTORIO',
      label: 'Oficios y Productos',
      ariaLabel: 'Oficios y Productos Locales · Directorio',
      renderIcon: () => (
        <Wrench className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden="true" />
      ),
    },
    {
      id: 'MURO',
      label: 'Solidario',
      ariaLabel: isEmergencyActive
        ? 'Muro Solidario · Alerta de emergencia activa'
        : 'Muro Solidario',
      renderIcon: () =>
        isEmergencyActive ? (
          <div className="relative inline-flex items-center justify-center">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 animate-pulse stroke-[2.4] ${
                isEmergencyMode
                  ? activeTab === 'MURO'
                    ? 'text-[#FDE047]'
                    : 'text-[#FCA5A5]'
                  : 'text-red-600 dark:text-red-500'
              }`}
              aria-hidden="true"
            />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
            </span>
          </div>
        ) : (
          <Heart className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} aria-hidden="true" />
        ),
    },
    {
      id: 'COPILOTO',
      label: 'IA',
      ariaLabel: 'Asistente de Inteligencia Artificial · Copiloto IA',
      renderIcon: () => (
        <Sparkles className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden="true" />
      ),
    },
  ];

  const leftTabs = primaryNavTabs.slice(0, 2);
  const rightTabs = primaryNavTabs.slice(2, 4);

  const renderTabButton = (tab: NavTabConfig) => {
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => onSelectTab(tab.id)}
        aria-current={isActive ? 'page' : undefined}
        aria-label={tab.ariaLabel}
        className={`min-h-[52px] h-13 flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-1 rounded-xl text-[11px] font-bold transition-all active:scale-[0.96] ${
          isActive
            ? isEmergencyMode
              ? 'bg-[#991B1B] text-[#FFFFFF] border border-[#FDE047] font-black shadow-sm'
              : 'bg-[#E6ECF7] text-[#0F2A56] font-black shadow-xs'
            : isEmergencyMode
              ? 'text-[#FFFFFF] hover:text-[#FDE047] hover:bg-[#1E2636]'
              : 'text-[#334155] dark:text-[#E2E8F0] hover:text-[#0B1E3F] hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        {tab.renderIcon()}
        <span className="leading-tight truncate max-w-full">{tab.label}</span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Navegación principal barrial"
      className={`fixed bottom-0 left-0 right-0 z-30 w-full max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-2 py-1.5 shadow-floating-bar ${
        isEmergencyMode
          ? 'bg-[#141A24] border-t-2 border-[#FB7185]/80 text-white'
          : 'bg-white dark:bg-[#0F172A] border-t border-slate-200 dark:border-slate-800 text-[#0F172A] dark:text-[#F8FAFC]'
      }`}
    >
      <div className="flex items-center justify-between gap-1 w-full">
        {leftTabs.map(renderTabButton)}

        {/* Botón Central Destacado: Circle CTA Button Elevado con Acento Naranja #E8741A */}
        <div className="flex flex-col items-center justify-center -mt-6 shrink-0 relative z-40 px-1">
          <button
            type="button"
            onClick={onOpenQuickPublish}
            aria-label="Publicar en mi barrio"
            className={`w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-[#E8741A] hover:bg-[#d46614] text-white shadow-md shadow-black/10 flex items-center justify-center border-4 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8741A] group cursor-pointer ${
              isEmergencyMode ? 'border-[#1E2636]' : 'border-white'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Plus className="w-7 h-7 text-white stroke-[2.8] transition-transform duration-150 group-active:scale-95" aria-hidden="true" />
            </div>
            <span className="sr-only">Publicar en mi barrio</span>
          </button>
          <span
            className={`text-[12px] font-bold mt-1 tracking-tight ${
              isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#16181D]'
            }`}
          >
            Publicar
          </span>
        </div>

        {rightTabs.map(renderTabButton)}
      </div>
    </nav>
  );
}

export default BottomNavigation;
