import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Componente Button de shadcn/ui enriquecido con el patrón de 21st.dev (originui/button #227).
 * Garantiza objetivos táctiles >= 48px (min-h-[48px] h-12) y transiciones fluidas de microinteracción.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-xl text-sm sm:text-base font-black transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--cta-primary-bg)] text-[var(--cta-primary-fg)] shadow-sm hover:opacity-95',
        destructive:
          'bg-red-700 text-yellow-200 border-2 border-yellow-300 shadow-sm hover:bg-red-800',
        outline:
          'border border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--foreground)] shadow-soft hover:bg-[var(--accent-surface)] hover:text-[var(--accent-foreground)]',
        secondary:
          'bg-[var(--accent-surface)] text-[var(--accent-foreground)] border border-[var(--border-color)] shadow-sm hover:opacity-90',
        success:
          'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800',
        ghost:
          'text-[var(--foreground)] hover:bg-[var(--surface-card)]',
        link: 'text-[var(--foreground)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-[48px] h-12 px-4 py-2.5',
        sm: 'min-h-[48px] h-12 rounded-xl px-3.5 text-xs sm:text-sm',
        lg: 'min-h-[56px] h-14 rounded-2xl px-6 text-base sm:text-lg',
        icon: 'min-h-[48px] h-12 min-w-[48px] px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn('min-h-[48px]', buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
