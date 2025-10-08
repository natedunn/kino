import type React from 'react';

import { useState } from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CheckboxButtonProps {
	children: React.ReactNode;
	checked?: boolean;
	defaultChecked?: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
}

export default function CheckboxButton({
	children,
	checked,
	defaultChecked = false,
	onChange,
	disabled = false,
	className,
}: CheckboxButtonProps) {
	const [internalChecked, setInternalChecked] = useState(defaultChecked);

	const isChecked = checked !== undefined ? checked : internalChecked;

	const handleToggle = () => {
		if (disabled) return;

		const newChecked = !isChecked;

		if (checked === undefined) {
			setInternalChecked(newChecked);
		}

		onChange?.(newChecked);
	};

	return (
		<button
			type='button'
			onClick={handleToggle}
			disabled={disabled}
			className={cn(
				'inline-flex items-center gap-3 rounded-lg border border-input px-3 py-2.5 transition-all duration-200 dark:bg-input/30',
				'hover:bg-muted/50 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:outline-none',
				'disabled:cursor-not-allowed disabled:opacity-50',
				isChecked
					? 'border-primary bg-primary/5'
					: 'border-border bg-background hover:border-muted-foreground/20',
				className
			)}
		>
			<span
				className={cn(
					'flex h-5 w-5 items-center justify-center rounded border-2 transition-all duration-200',
					isChecked
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-muted-foreground/30 bg-background'
				)}
			>
				{isChecked && <Check className='h-3 w-3' />}
			</span>
			{children}
		</button>
	);
}
