'use client';

import React, { useContext, useEffect, useRef, useState } from 'react';
import { Check, Mic, Search, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { ModeContext } from '@/context/mode-context';

export type DistanceOptionValue = 200 | 500 | 1000 | null;

export interface CategoryOption {
  id: number | string;
  label: string;
}

export interface FilterBarProps {
  placeholder: string;
  categories: CategoryOption[];
  activeCategory: number | string;
  activeDistance: DistanceOptionValue;
  onSearch: (query: string) => void;
  onCategoryChange: (categoryId: number | string) => void;
  onDistanceChange: (distance: DistanceOptionValue) => void;
  className?: string;
  searchAriaLabel?: string;
}

export const DISTANCE_OPTIONS: Array<{
  value: DistanceOptionValue;
  shortLabel: string;
  mainLabel: string;
  secondaryLabel: string;
}> = [
  { value: 200, shortLabel: '200 m', mainLabel: '200 m', secondaryLabel: 'Mi cuadra' },
  { value: 500, shortLabel: '500 m', mainLabel: '500 m', secondaryLabel: 'Mi barrio' },
  { value: 1000, shortLabel: '1 km', mainLabel: '1 km', secondaryLabel: 'Mi sector' },
  { value: null, shortLabel: 'Todo', mainLabel: 'Todo el sector', secondaryLabel: '' },
];

/**
 * Componente Reutilizable <FilterBar />
 *
 * Estructura (2 filas):
 * 1. Fila A (siempre visible): Barra de búsqueda (izquierda) y Botón de distancia (derecha). Separación: 10px.
 * 2. Etiqueta "Filtro rápido" (13px, peso 800, #5B6068, 16px arriba, 8px abajo).
 * 3. Fila B: Chips de categoría en una sola línea con scroll horizontal de borde a borde (márgenes negativos).
 * 4. Lista desplegable de distancia superpuesta (z-index alto, anclada debajo del botón de distancia, alineada a la derecha).
 *
 * Accesibilidad WCAG AAA y touch target >= 44px (min 48px).
 */
export function FilterBar({
  placeholder,
  categories,
  activeCategory,
  activeDistance,
  onSearch,
  onCategoryChange,
  onDistanceChange,
  className = '',
  searchAriaLabel,
}: FilterBarProps): React.ReactElement {
  const modeCtx = useContext(ModeContext);
  const isEmergencyMode = modeCtx?.mode === 'EMERGENCIA';

  const [searchQuery, setSearchQuery] = useState('');
  const [isDistanceOpen, setIsDistanceOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const distanceButtonRef = useRef<HTMLButtonElement>(null);

  // Debounce de búsqueda de 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  // Cierre al hacer click fuera o presionar tecla Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        distanceButtonRef.current &&
        !distanceButtonRef.current.contains(event.target as Node)
      ) {
        setIsDistanceOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDistanceOpen(false);
        distanceButtonRef.current?.focus();
      }
    }

    if (isDistanceOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDistanceOpen]);

  // Obtener etiqueta corta para el botón de distancia
  const currentOption = DISTANCE_OPTIONS.find((opt) => opt.value === activeDistance) ?? DISTANCE_OPTIONS[1]!;
  const currentShortLabel = currentOption.shortLabel;
  const distanceAriaText =
    activeDistance === null
      ? 'Filtros: distancia todo el sector'
      : `Filtros: distancia ${currentOption.shortLabel}`;

  // Dictado por voz en español es-PE
  const handleVoiceSearch = () => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-PE';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          toast.info('Escuchando dictado por voz (es-PE)... Habla ahora.');
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setSearchQuery(transcript);
          toast.success(`Búsqueda: "${transcript}"`);
        };

        recognition.onerror = () => {
          toast.info('Dictado por voz: Di lo que necesitas en tu barrio (ej. "Gasfitero")');
        };

        recognition.start();
        return;
      } catch {
        // Fallback
      }
    }
    toast.info('Escuchando... Di lo que necesitas en tu barrio (ej. "Gasfitero en El Tambo")');
  };

  return (
    <div className={`w-full relative ${className}`}>
      {/* FILA A: Barra de búsqueda (izquierda) y Botón de distancia (derecha) con separación de 10px */}
      <div className="flex items-center gap-[10px] w-full">
        {/* Barra de Búsqueda: Alto 52, esquinas 26 (píldora), fondo adaptable a modo emergencia */}
        <div
          className={`flex-1 min-h-[52px] h-[52px] rounded-[26px] px-2 pl-4 flex items-center gap-[10px] focus-within:ring-2 focus-within:ring-[#2F62D6] focus-within:ring-offset-2 transition-all ${
            isEmergencyMode
              ? 'bg-[#1E2636] border border-[#475569] shadow-md'
              : 'bg-white shadow-[0_6px_18px_rgba(30,40,60,0.07)]'
          }`}
        >
          {/* Etiqueta accesible aunque no se vea */}
          <label htmlFor="filter-bar-search-input" className="sr-only">
            {searchAriaLabel || placeholder}
          </label>

          {/* Icono de lupa a la izquierda: 20px, trazo 2.2 */}
          <Search
            className={`w-5 h-5 stroke-[2.2] shrink-0 pointer-events-none ${
              isEmergencyMode ? 'text-[#E2E8F0]' : 'text-[#5B6068]'
            }`}
            aria-hidden="true"
          />

          {/* Campo de texto: 14px, peso 500, sin recuadro interno */}
          <input
            id="filter-bar-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className={`w-full !bg-transparent !border-0 outline-none text-[14px] font-[500] min-h-[44px] ${
              isEmergencyMode
                ? 'text-[#FFFFFF] placeholder:text-[#CBD5E1]'
                : 'text-[#0B1E3F] placeholder:text-[#7A808A]'
            }`}
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
              className={`min-h-[48px] min-w-[48px] h-12 w-12 flex items-center justify-center shrink-0 cursor-pointer active:scale-[0.97] ${
                isEmergencyMode
                  ? 'text-[#E2E8F0] hover:text-[#FFFFFF]'
                  : 'text-[#5B6068] hover:text-[#0B1E3F]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Botón de micrófono a la derecha: círculo de 38px */}
          <button
            type="button"
            onClick={handleVoiceSearch}
            aria-label="Buscar por voz"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center shrink-0 cursor-pointer active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[#2F62D6]"
          >
            <div
              className={`w-[38px] h-[38px] rounded-full flex items-center justify-center transition-colors ${
                isEmergencyMode
                  ? 'bg-[#991B1B] hover:bg-[#7F1D1D] text-[#FDE047] border border-[#FDE047]/70'
                  : 'bg-[#E6ECF7] hover:bg-[#d8e3f5] text-[#0F2A56]'
              }`}
            >
              <Mic className="w-[18px] h-[18px] stroke-[2.2]" aria-hidden="true" />
            </div>
          </button>
        </div>

        {/* Botón de Distancia: Alto 52, esquinas 26 (píldora) */}
        <button
          ref={distanceButtonRef}
          type="button"
          onClick={() => setIsDistanceOpen((prev) => !prev)}
          aria-label={distanceAriaText}
          aria-expanded={isDistanceOpen}
          className={`min-h-[52px] h-[52px] rounded-[26px] px-4 flex items-center gap-2 shrink-0 cursor-pointer transition-all active:scale-[0.97] focus:outline-none focus:ring-[3px] focus:ring-[#2F62D6] focus:ring-offset-2 ${
            isDistanceOpen
              ? isEmergencyMode
                ? 'bg-[#991B1B] text-[#FFFFFF] border-2 border-[#FDE047] shadow-lg'
                : 'bg-[#0F2A56] text-white shadow-[0_8px_18px_rgba(15,42,86,0.3)]'
              : isEmergencyMode
                ? 'bg-[#1E2636] text-[#FFFFFF] border border-[#475569] shadow-md hover:bg-[#283246]'
                : 'bg-white text-[#0B1E3F] shadow-[0_6px_18px_rgba(30,40,60,0.07)] hover:bg-slate-50'
          }`}
        >
          {/* Icono de ajustes (sliders) de 18px */}
          <SlidersHorizontal
            className={`w-[18px] h-[18px] stroke-[2.2] shrink-0 ${
              isDistanceOpen
                ? isEmergencyMode
                  ? 'text-[#FDE047]'
                  : 'text-white'
                : isEmergencyMode
                  ? 'text-[#FDE047]'
                  : 'text-[#0F2A56]'
            }`}
            aria-hidden="true"
          />
          {/* Muestra SIEMPRE la distancia activa en 14px, peso 800 */}
          <span
            className={`text-[14px] font-[800] whitespace-nowrap ${
              isDistanceOpen || isEmergencyMode ? 'text-[#FFFFFF]' : 'text-[#0B1E3F]'
            }`}
          >
            {currentShortLabel}
          </span>
        </button>
      </div>

      {/* Lista Desplegable de Distancia: Se superpone al contenido (z-index 40), anclada a la derecha con 10px de separación */}
      {isDistanceOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Distancia de cobertura"
          style={{ width: '270px', maxWidth: 'calc(100vw - 40px)' }}
          className={`absolute right-0 top-[62px] z-40 rounded-[24px] p-2 border animate-in fade-in zoom-in-95 duration-150 ${
            isEmergencyMode
              ? 'bg-[#1E2636] border-[#64748B] shadow-2xl'
              : 'bg-white border-slate-100 shadow-[0_18px_44px_rgba(30,40,60,0.16)]'
          }`}
        >
          {/* Encabezado 'DISTANCIA': 13px, peso 800, letter-spacing .4px */}
          <div
            className={`text-[13px] font-[800] tracking-[0.4px] px-3 pt-2 pb-1 uppercase select-none ${
              isEmergencyMode ? 'text-[#CBD5E1]' : 'text-[#5B6068]'
            }`}
          >
            DISTANCIA
          </div>

          {/* Opciones desplegables */}
          <div className="space-y-1">
            {DISTANCE_OPTIONS.map((opt) => {
              const isSelected = activeDistance === opt.value;
              return (
                <button
                  key={opt.mainLabel}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onDistanceChange(opt.value);
                    setIsDistanceOpen(false);
                    distanceButtonRef.current?.focus();
                  }}
                  className={`w-full min-h-[52px] h-[52px] rounded-[18px] px-3 flex items-center justify-between text-left transition-all active:scale-[0.97] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2F62D6] ${
                    isSelected
                      ? isEmergencyMode
                        ? 'bg-[#991B1B] text-[#FFFFFF] border border-[#FDE047]'
                        : 'bg-[#E6ECF7]'
                      : isEmergencyMode
                        ? 'hover:bg-[#283246] text-[#FFFFFF]'
                        : 'hover:bg-slate-50 text-[#0B1E3F]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`text-[15px] ${
                        isSelected
                          ? isEmergencyMode
                            ? 'font-[800] text-[#FFFFFF]'
                            : 'font-[800] text-[#0F2A56]'
                          : isEmergencyMode
                            ? 'font-[700] text-[#F8FAFC]'
                            : 'font-[700] text-[#0B1E3F]'
                      }`}
                    >
                      {opt.mainLabel}
                    </span>
                    {opt.secondaryLabel && (
                      <span
                        className={`text-[15px] ${
                          isSelected
                            ? isEmergencyMode
                              ? 'font-[600] text-[#FEF08A]'
                              : 'font-[600] text-[#3A4A6B]'
                            : isEmergencyMode
                              ? 'font-[500] text-[#CBD5E1]'
                              : 'font-[500] text-[#5B6068]'
                        }`}
                      >
                        · {opt.secondaryLabel}
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <Check
                      className={`w-[18px] h-[18px] stroke-[2.8] shrink-0 ml-2 ${
                        isEmergencyMode ? 'text-[#FDE047]' : 'text-[#0F2A56]'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Etiqueta "Filtro rápido" encima de los chips: 13px, peso 800, letter-spacing .4px */}
      <div
        className={`text-[13px] font-[800] tracking-[0.4px] mt-4 mb-2 ${
          isEmergencyMode ? 'text-[#E2E8F0]' : 'text-[#5B6068]'
        }`}
      >
        Filtro rápido
      </div>

      {/* FILA B: Chips de categoría en una sola línea con scroll horizontal */}
      <div className="relative -mx-4 px-4">
        <div
          role="group"
          aria-label="Filtro rápido de categorías"
          className="flex items-center gap-2 pb-1 overflow-x-auto pr-8"
          style={{
            scrollbarWidth: 'none',
            scrollSnapType: 'x proximity',
          }}
        >
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={String(cat.id)}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                aria-pressed={isSelected}
                style={{ scrollSnapAlign: 'start' }}
                className={`min-h-[48px] h-[42px] rounded-[21px] px-[18px] text-[14px] font-[700] whitespace-nowrap shrink-0 transition-all active:scale-[0.97] inline-flex items-center justify-center cursor-pointer focus:outline-none focus:ring-[3px] focus:ring-[#2F62D6] focus:ring-offset-2 ${
                  isSelected
                    ? isEmergencyMode
                      ? 'bg-[#991B1B] text-[#FFFFFF] border-2 border-[#FDE047] shadow-md font-extrabold'
                      : 'bg-[#0F2A56] text-white shadow-xs'
                    : isEmergencyMode
                      ? 'bg-[#1E2636] text-[#F8FAFC] border border-[#475569] hover:bg-[#283246]'
                      : 'bg-white text-[#0B1E3F] shadow-[0_4px_12px_rgba(30,40,60,0.06)] hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
        {/* Degradado lateral de 24px adaptado al color de fondo del modo activo */}
        <div
          className={`absolute right-0 top-0 bottom-1 w-6 pointer-events-none bg-gradient-to-l to-transparent ${
            isEmergencyMode ? 'from-[#11161F]' : 'from-[var(--bg-app)]'
          }`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default FilterBar;
