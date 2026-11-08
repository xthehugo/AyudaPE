'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  HeartHandshake,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';

export interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  step: number;
  title: string;
  body: string;
  illustrationLabel: string;
  icon: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    title: '1. Oficios Locales con Visto Bueno Vecinal',
    body: 'Encuentra gasfiteros, electricistas, enfermeras, menús caseros o clases de tus propios vecinos. Las recomendaciones de quienes viven a menos de 200 metros valen más.',
    illustrationLabel: 'Ilustración de Oficios y Confianza Barrial',
    icon: <Wrench className="w-10 h-10" strokeWidth={2} aria-hidden="true" />,
  },
  {
    step: 2,
    title: '2. Muro Solidario y Publicación por Voz en 3 Clics',
    body: 'Pide prestadas unas muletas, coordina el pool escolar o comparte ayuda sin usar dinero. Con el botón central "+ Publicar" solo dictas con tu voz y la IA llena todo.',
    illustrationLabel: 'Ilustración de Cadena de Favores Cero Dinero',
    icon: <HeartHandshake className="w-10 h-10" strokeWidth={2} aria-hidden="true" />,
  },
  {
    step: 3,
    title: '3. Modo Emergencia SOS y Funciona Sin Internet',
    body: 'Ante un sismo o apagón, activa el Modo Emergencia SOS de alto contraste. Tus alertas se guardan en tu celular aunque caiga la red y tu dirección exacta queda protegida.',
    illustrationLabel: 'Ilustración de Escudo SOS Offline',
    icon: <ShieldAlert className="w-10 h-10" strokeWidth={2} aria-hidden="true" />,
  },
];

/**
 * Tutorial interactivo de bienvenida de 3 pasos con texto grande (>=16px),
 * ilustraciones simples de alto contraste y botón "Empezar a usar" (>=48px).
 */
export function GuidedTourModal({
  isOpen,
  onClose,
}: GuidedTourModalProps): React.ReactElement | null {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) {
    return null;
  }

  const activeSlide = TOUR_STEPS[currentStep] ?? TOUR_STEPS[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-dialog-title"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface-elevated)] text-[var(--foreground)] border-2 border-[var(--border-color)] p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="px-3 py-1 rounded-xl bg-[var(--surface-card)] border border-[var(--border-color)] text-sm font-extrabold uppercase tracking-wider">
            Paso {currentStep + 1} de {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía rápida"
            className="min-h-[48px] h-12 px-3.5 rounded-xl border-2 border-[var(--border-color)] bg-[var(--surface-card)] font-extrabold text-sm inline-flex items-center gap-2"
          >
            <X className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            <span>Cerrar</span>
          </button>
        </div>

        {/* Ilustración Simple y Clara */}
        <div
          role="img"
          aria-label={activeSlide.illustrationLabel}
          className="w-full rounded-2xl border-2 border-[var(--border-color)] bg-[var(--surface-card)] p-5 flex flex-col items-center justify-center gap-2 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-surface)] text-[var(--accent-foreground)] flex items-center justify-center shadow-md">
            {activeSlide.icon}
          </div>
          <span className="text-sm font-bold text-[var(--muted-foreground)]">
            {activeSlide.illustrationLabel}
          </span>
        </div>

        <div className="space-y-2">
          <h2 id="onboarding-dialog-title" className="text-lg font-extrabold leading-snug">
            {activeSlide.title}
          </h2>
          <p className="text-base leading-relaxed text-[var(--muted-foreground)]">
            {activeSlide.body}
          </p>
        </div>

        {/* Indicadores de paso */}
        <div className="flex items-center justify-center gap-2" aria-hidden="true">
          {TOUR_STEPS.map((item, idx) => (
            <span
              key={item.step}
              className={`h-2.5 rounded-full transition-all ${
                idx === currentStep
                  ? 'w-8 bg-[var(--cta-primary-bg)]'
                  : 'w-2.5 bg-[var(--border-color)]'
              }`}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            className="min-h-[48px] h-12 px-4 rounded-xl border-2 border-[var(--border-color)] bg-[var(--surface-card)] font-extrabold text-base disabled:opacity-40"
          >
            Anterior
          </button>

          <div className="flex items-center gap-2">
            {currentStep < TOUR_STEPS.length - 1 && (
              <button
                type="button"
                onClick={() =>
                  setCurrentStep((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1))
                }
                className="min-h-[48px] h-12 px-4 rounded-xl border-2 border-[var(--border-color)] bg-[var(--surface-card)] font-extrabold text-base"
              >
                Siguiente
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] h-12 px-5 rounded-xl bg-emerald-700 text-white border-2 border-emerald-400 font-extrabold text-base inline-flex items-center gap-2 shadow-md"
            >
              <CheckCircle2 className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
              <span>Empezar a usar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuidedTourModal;
