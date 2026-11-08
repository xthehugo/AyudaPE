import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton accesible de shadcn/ui para estados de carga de IA no intrusivos.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
