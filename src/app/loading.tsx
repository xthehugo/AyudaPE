'use client';

import React from 'react';
import { LottieLoader } from '@/components/ui/lottie-loader';

/**
 * Pantalla Global de Carga de Next.js (App Router loading.tsx):
 * Se activa automáticamente durante transiciones de ruta y carga asíncrona de páginas.
 */
export default function Loading(): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F4F5F7]/90 dark:bg-slate-950/90 backdrop-blur-xs">
      <div className="max-w-xs w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-6 shadow-card-diffuse flex flex-col items-center">
        <LottieLoader
          message="Cargando tu barrio..."
          size={200}
        />
      </div>
    </div>
  );
}
