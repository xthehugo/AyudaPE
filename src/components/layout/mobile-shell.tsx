'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface MobileShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Envoltorio centrado Mobile-First para RedVecina (`max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-24`).
 * Bloquea rebotes táctiles molestos (`overscroll-behavior-y: contain` y `-webkit-overflow-scrolling: touch`).
 */
export function MobileShell({
  children,
  className,
  style,
  ...props
}: MobileShellProps): React.ReactElement {
  return (
    <div
      className={cn(
        'w-full max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col pb-28 border-x border-[var(--border-color)] shadow-xl relative box-border',
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export default MobileShell;
