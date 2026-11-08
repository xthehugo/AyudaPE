'use client';

import React, { useEffect, useRef } from 'react';

export interface LottieLoaderProps {
  message?: string;
  size?: number;
  className?: string;
}

/**
 * Componente Global de Animación de Carga Lottie (Paperplane / loading.json).
 * Utiliza lottie-web para renderizado nativo vectorial SVG acelerado por hardware.
 */
export function LottieLoader({
  message = 'Cargando...',
  size = 180,
  className = '',
}: LottieLoaderProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anim: any = null;
    let isMounted = true;

    async function loadLottie() {
      try {
        const lottie = (await import('lottie-web')).default;
        if (!isMounted || !containerRef.current) return;

        // Limpiar animaciones previas
        containerRef.current.innerHTML = '';

        anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: '/loading.json',
        });
      } catch (err) {
        // Fallback sutil si lottie fallara
      }
    }

    void loadLottie();

    return () => {
      isMounted = false;
      if (anim) {
        anim.destroy();
      }
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-6 text-center select-none ${className}`}
    >
      <div
        ref={containerRef}
        style={{ width: `${size}px`, height: `${Math.round(size * 0.75)}px` }}
        className="flex items-center justify-center overflow-hidden"
      />
      {message && (
        <p className="text-xs sm:text-sm font-extrabold text-[#0B1E3F] dark:text-slate-200 tracking-tight mt-2 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}

export default LottieLoader;
