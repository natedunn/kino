import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const inlineAlertVariants = cva('rounded-lg border bg-gradient-to-bl', {
  variants: {
    size: {
      default: 'p-3 text-sm',
      lg: 'p-4 text-base',
      sm: 'p-2 text-xs',
    },
    variant: {
      danger:
        'border-red-500 from-red-500/10 to-red-500/5 text-red-600 dark:border-red-400 dark:text-red-400 dark:from-red-500/20 to-red-500/10',
      default: 'from-muted to-muted/50 dark:from-accent/50 to-accent/10',
      info: 'border-blue-500 from-blue-500/10 to-blue-500/5 text-blue-600 dark:border-blue-400 dark:text-blue-400 dark:from-blue-500/20 to-blue-500/10',
      success:
        'border-green-500 from-green-500/10 to-green-500/5 text-green-600 dark:border-green-400 dark:text-green-400 dark:from-green-500/20 to-green-500/10',
      warning:
        'border-yellow-500 from-yellow-500/10 to-yellow-500/5 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400 dark:from-yellow-500/20 to-yellow-500/10',
    },
  },
  defaultVariants: {
    size: 'default',
    variant: 'default',
  },
});

export function InlineAlert({
  children,
  className,
  size,
  variant,
}: {
  children: ReactNode;
  className?: string;
} & VariantProps<typeof inlineAlertVariants>) {
  return <div className={cn(inlineAlertVariants({ className, size, variant }))}>{children}</div>;
}
