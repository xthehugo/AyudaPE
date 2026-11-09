'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

export interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  step: number;
  title: string;
  body: string;
  illustrationLabel?: string;
  icon?: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    title: '1. Oficios Locales con Visto Bueno Vecinal',
    body: 'Encuentra gasfiteros, electricistas, enfermeras, menús caseros o clases de tus propios vecinos. Las recomendaciones de quienes viven a menos de 200 metros valen más.',
  },
  {
    step: 2,
    title: '2. Muro Solidario y Publicación por Voz en 3 Clics',
    body: 'Pide prestadas unas muletas, coordina el pool escolar o comparte ayuda sin usar dinero. Con el botón central "+ Publicar" solo dictas con tu voz y la IA llena todo.',
  },
  {
    step: 3,
    title: '3. Modo Emergencia SOS y Funciona Sin Internet',
    body: 'Ante un sismo o apagón, activa el Modo Emergencia SOS de alto contraste. Tus alertas se guardan en tu celular aunque caiga la red y tu dirección exacta queda protegida.',
  },
];

/**
 * Guía interactiva (Tour) de AyudaPE con la mascota Llama Andina:
 * - Tarjeta tooltip de 290px, radio 22px, padding 20px, sombra suave rgba(20,30,60,.18).
 * - Círculo de 66px con borde blanco de 3px para la llama a la izquierda del globo (object-position: 50% 30%).
 * - Fila superior con píldora de 22x7px (#12285A) y puntos de 7px (#D3D6DF) + botón "Omitir" (#5B6275).
 * - Botones táctiles accesibles >=48px (Atrás círculo #EEF0F5, Siguiente píldora #12285A / Listo con check).
 */
export function GuidedTourModal({
  isOpen,
  onClose,
}: GuidedTourModalProps): React.ReactElement | null {
  const [currentStep, setCurrentStep] = useState<number>(0);

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ayudape_tour_seen', 'true');
      } catch {}
    }
    onClose();
  };

  // Soporte para cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const activeSlide = TOUR_STEPS[currentStep] ?? TOUR_STEPS[0];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-dialog-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Contenedor con margen lateral >= 32px garantizado */}
      <div
        className="flex items-start justify-center max-w-[calc(100vw-64px)] mx-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 3. La llama: Círculo de 66px con borde blanco de 3px, alineada a la izquierda cerca de la parte superior */}
        <div
          className="w-[66px] h-[66px] min-w-[66px] min-h-[66px] rounded-full border-[3px] border-white shadow-[0_6px_20px_rgba(20,30,60,0.25)] overflow-hidden shrink-0 -mr-4 z-10 mt-3 bg-slate-100"
          aria-hidden="true"
        >
          <img
            src="/llama.jpeg"
            alt="Llama con chullo andino guía de AyudaPE"
            className="w-full h-full object-cover"
            style={{ objectPosition: '50% 30%' }}
          />
        </div>

        {/* 2. Globo de texto (tooltip): Tarjeta blanca, radio 22px, padding 20px, ancho 290px, sombra suave */}
        <div
          className="relative w-[290px] max-w-[calc(100vw-88px)] rounded-[22px] bg-white p-[20px] shadow-[0_8px_24px_rgba(20,30,60,0.18)] space-y-3 z-0"
          style={{ fontFamily: 'Poppins, system-ui, -apple-system, sans-serif' }}
        >
          {/* Flechita arriba apuntando al elemento */}
          <div
            className="absolute -top-[9px] left-10 w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-b-[9px] border-b-white drop-shadow-[0_-2px_2px_rgba(20,30,60,0.06)]"
            aria-hidden="true"
          />

          {/* Fila superior: Puntos de progreso a la izquierda y "Omitir" a la derecha */}
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-1.5"
              aria-label={`Paso ${currentStep + 1} de ${TOUR_STEPS.length}`}
            >
              {TOUR_STEPS.map((item, idx) => {
                const isActive = idx === currentStep;
                return (
                  <span
                    key={item.step}
                    className="transition-all duration-200"
                    style={{
                      width: isActive ? '22px' : '7px',
                      height: '7px',
                      backgroundColor: isActive ? '#12285A' : '#D3D6DF',
                      borderRadius: '9999px',
                    }}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="min-h-[48px] px-2 text-[14px] font-medium text-[#5B6275] hover:text-[#12285A] transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Omitir guía rápida"
            >
              Omitir
            </button>
          </div>

          {/* Texto del paso: 15px, peso 500, color #12285A, interlineado 1.5 */}
          <div className="space-y-1 pt-0.5">
            <h3
              id="onboarding-dialog-title"
              className="text-[15px] font-bold text-[#12285A] leading-snug tracking-tight"
            >
              {activeSlide.title}
            </h3>
            <p
              className="text-[15px] font-medium leading-[1.5]"
              style={{ color: '#12285A', fontSize: '15px', fontWeight: 500, lineHeight: 1.5 }}
            >
              {activeSlide.body}
            </p>
          </div>

          {/* Botones abajo a la derecha, con 10px de separación */}
          <div className="flex items-center justify-end gap-[10px] pt-2">
            {/* Botón Atrás: círculo de 48px, fondo #EEF0F5, flecha azul marino #12285A. Se oculta en el primer paso */}
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                aria-label="Paso anterior de la guía"
                className="w-[48px] h-[48px] min-h-[48px] min-w-[48px] rounded-full bg-[#EEF0F5] hover:bg-[#E2E6EE] text-[#12285A] flex items-center justify-center transition-transform active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-[#12285A]" strokeWidth={2.2} />
              </button>
            )}

            {/* Botón Siguiente: píldora de 48px de alto, fondo #12285A, texto blanco 15px peso 500, padding horizontal 22px */}
            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  handleClose();
                } else {
                  setCurrentStep((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1));
                }
              }}
              aria-label={isLastStep ? 'Listo, empezar a usar' : 'Siguiente paso'}
              className="h-[48px] min-h-[48px] px-[22px] rounded-full bg-[#12285A] hover:bg-[#0c1c40] text-white text-[15px] font-medium flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-xs cursor-pointer"
            >
              {isLastStep ? (
                <>
                  <Check className="w-4 h-4 text-white" strokeWidth={2.5} aria-hidden="true" />
                  <span>Listo</span>
                </>
              ) : (
                <span>Siguiente</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuidedTourModal;
