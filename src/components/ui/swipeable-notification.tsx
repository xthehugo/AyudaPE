'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SwipeableNotificationProps {
  /** Indica si la notificación está visible */
  isOpen: boolean;
  /** Función callback ejecutada al descartar (por deslizamiento o botón) */
  onDismiss: () => void;
  /** Contenido principal del banner */
  children: React.ReactNode;
  /** Variante cromática con alto contraste (WCAG AAA) */
  variant?: 'emerald' | 'danger' | 'warning' | 'info' | 'neutral';
  /** Botón o elemento de acción secundario opcional (ej. "Entendido") */
  action?: React.ReactNode;
  /** Clases CSS adicionales para el contenedor */
  className?: string;
  /** Muestra u oculta el botón accesible de cierre (>=48px touch target) */
  showCloseButton?: boolean;
  /** Etiqueta accesible para lectores de pantalla */
  closeAriaLabel?: string;
  /** Muestra un indicador visual sutil de arrastre/swipe */
  showSwipeHint?: boolean;
  /** Rol accesible para tecnologías de asistencia (default: 'status') */
  role?: 'status' | 'alert';
  /** Duración en milisegundos antes de desaparecer automáticamente (default: 4000ms, 0 para desactivar) */
  autoDismissMs?: number;
}

const VARIANT_STYLES: Record<NonNullable<SwipeableNotificationProps['variant']>, string> = {
  emerald: 'bg-emerald-950 text-emerald-100 border-2 border-emerald-400 shadow-md',
  danger: 'bg-red-950 text-red-100 border-2 border-red-500 shadow-md',
  warning: 'bg-amber-950 text-amber-100 border-2 border-amber-400 shadow-md',
  info: 'bg-sky-950 text-sky-100 border-2 border-sky-400 shadow-md',
  neutral: 'bg-slate-900 text-slate-100 border-2 border-slate-700 shadow-md',
};

/**
 * Componente SwipeableNotification:
 * - Entrada suave con animación de muelle (Spring slide-down + fade-in).
 * - Cierre gestual deslizable hacia cualquier lado (Swipe-to-dismiss izquierda/derecha).
 * - Salida animada hacia la dirección de descarte (Slide-out + fade-out).
 * - Soporte de accesibilidad WCAG AAA con touch targets >= 48px y aria-live.
 */
export function SwipeableNotification({
  isOpen,
  onDismiss,
  children,
  variant = 'emerald',
  action,
  className = '',
  showCloseButton = true,
  closeAriaLabel = 'Cerrar aviso (o desliza hacia los lados)',
  showSwipeHint = true,
  role = 'status',
  autoDismissMs = 4000,
}: SwipeableNotificationProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const [exitX, setExitX] = useState<number>(350);

  // Auto-descarte suave a los 4 segundos (Punto 1: Alertas temporales)
  React.useEffect(() => {
    if (isOpen && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        setExitX(350);
        onDismiss();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoDismissMs, onDismiss]);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const swipeThreshold = 55;
    const velocityThreshold = 250;

    if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      setExitX(400);
      onDismiss();
    } else if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      setExitX(-400);
      onDismiss();
    }
  };

  const handleManualDismiss = () => {
    setExitX(350);
    onDismiss();
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          role={role}
          aria-live="polite"
          data-testid="swipeable-notification"
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: -20, scale: 0.95 }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: 'spring',
                    damping: 24,
                    stiffness: 320,
                  },
                }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  x: exitX,
                  scale: 0.92,
                  transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] },
                }
          }
          style={{ touchAction: 'pan-y' }}
          className={cn(
            'relative overflow-hidden rounded-2xl p-3.5 select-none transition-shadow',
            'cursor-grab active:cursor-grabbing hover:shadow-lg',
            VARIANT_STYLES[variant],
            className
          )}
        >
          {/* Indicador sutil de gesto swipe */}
          {showSwipeHint && (
            <div
              aria-hidden="true"
              className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-current opacity-30 pointer-events-none"
            />
          )}

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <div className="min-w-0 flex-1">{children}</div>

            <div className="flex items-center gap-2 shrink-0">
              {action}

              {showCloseButton && (
                <button
                  type="button"
                  onClick={handleManualDismiss}
                  aria-label={closeAriaLabel}
                  title="Cerrar (o desliza hacia un lado)"
                  className="min-h-[48px] min-w-[48px] h-12 w-12 rounded-xl flex items-center justify-center border border-white/20 hover:bg-white/10 active:scale-95 transition-all text-current font-bold"
                >
                  <X className="w-5 h-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SwipeableNotification;
