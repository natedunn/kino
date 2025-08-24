import { cva, VariantProps } from 'class-variance-authority';
import { ClassValue } from 'clsx';

import { cn } from '@/lib/utils';

const inlineAlertVariants = cva('rounded-lg border bg-gradient-to-bl', {
	variants: {
		variant: {
			default: 'from-muted to-muted/50 dark:from-accent/50 to-accent/10',
			info: 'border-blue-500 from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400 dark:border-blue-400 dark:from-blue-500/20 to-blue-500/10',
			success:
				'border-green-500 from-green-500/10 to-green-500/5 text-green-600 dark:text-green-400 dark:border-green-400 dark:from-green-500/20 to-green-500/10',
			warning:
				'border-yellow-500 from-yellow-500/10 to-yellow-500/5 text-yellow-600 dark:text-yellow-400 dark:border-yellow-400 dark:from-yellow-500/20 to-yellow-500/10',
			danger:
				'border-red-500 from-red-500/10 to-red-500/5 text-red-600 dark:text-red-400 dark:border-red-400 dark:from-red-500/20 to-red-500/10',
		},
		size: {
			default: 'p-3 text-sm',
			sm: 'p-2 text-xs',
			lg: 'p-4 text-base',
		},
	},
	defaultVariants: {
		variant: 'default',
		size: 'default',
	},
});

type InlineAlertProps = {
	children: React.ReactNode;
	className?: ClassValue;
} & VariantProps<typeof inlineAlertVariants>;

export const InlineAlert = ({ variant, className, children }: InlineAlertProps) => {
	return <div className={cn(inlineAlertVariants({ variant, className }))}>{children}</div>;
};
