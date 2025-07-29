import type { AnyFieldApi } from '@tanstack/react-form';

import { Ban, Check, Dot } from 'lucide-react';
import { cn } from 'src/lib/utils';

export const FieldInfo = ({ field }: { field: AnyFieldApi }) => {
	return (
		<>
			{field.state.meta.isTouched && !field.state.meta.isValid ? (
				<em>{field.state.meta.errors.join(', ')}</em>
			) : null}
		</>
	);
};

export const FieldStatus = ({
	field,
	requireTouched = false,
	showValid = true,
}: {
	field: AnyFieldApi;
	requireTouched?: boolean;
	showValid?: boolean;
}) => {
	const touched = field.state.meta.isTouched;
	const invalid = !field.state.meta.isValid;

	if (requireTouched && !touched) return null;
	if (!showValid && !invalid) return null;

	return (
		<div
			className={cn('flex size-[42px] items-center justify-center rounded-lg', {
				'bg-muted text-muted-foreground': !touched,
				'bg-red-500/10 text-red-500': touched && invalid,
				'bg-green-500/10 text-green-500': touched && !invalid,
			})}
		>
			{!touched && <Dot className='h-4 w-4' />}
			{touched && invalid && <Ban className='h-4 w-4' />}
			{touched && !invalid && <Check className='h-4 w-4' />}
		</div>
	);
};
