import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Componente Badge de shadcn/ui + 21st.dev (sean0205/badge #3559 y motion-multi-state-badge #24966).
 * Respeta tamaño mínimo legible >= 12px-14px y alto contraste para exteriores.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--accent-surface)] text-[var(--accent-foreground)]',
        secondary:
          'border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--foreground)]',
        success:
          'border-emerald-500/40 bg-emerald-950/90 text-emerald-200',
        destructive:
          'border-yellow-300 bg-red-700 text-yellow-200 shadow-sm',
        warning:
          'border-amber-400/50 bg-amber-950/90 text-yellow-200',
        outline:
          'border-[var(--border-color)] text-[var(--foreground)] bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
