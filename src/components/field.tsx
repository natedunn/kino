import * as React from 'react';

import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { cn } from '@/lib/utils';

// A labeled form field: a bold label with optional helper text above a single
// control (Input, Textarea, Select, …). The control is auto-associated with the
// label — Field generates an id and injects it onto the child, so callers don't
// wire `htmlFor`/`id` by hand. Pass an explicit `htmlFor` (and set the matching
// id yourself) to opt out, or set an id on the control and it's respected.
function Field({
	children,
	className,
	description,
	error,
	htmlFor,
	label,
	...props
}: Omit<React.ComponentProps<'div'>, 'label'> & {
	description?: React.ReactNode;
	error?: React.ReactNode;
	htmlFor?: string;
	label: React.ReactNode;
}) {
	const generatedId = React.useId();
	const child = React.isValidElement(children) ? children : null;
	const childId = (child?.props as { id?: string } | undefined)?.id;
	const controlId = htmlFor ?? childId ?? generatedId;

	// Inject the generated id onto the control only when the caller hasn't
	// provided one (via `htmlFor` or an id on the child).
	const control =
		child && htmlFor == null && childId == null
			? React.cloneElement(child as React.ReactElement<{ id?: string }>, { id: controlId })
			: children;

	return (
		<div className={cn('flex flex-col gap-2', className)} {...props}>
			<LabelWrapper>
				<Label htmlFor={controlId}>{label}</Label>
				{description == null ? null : <LabelDescription>{description}</LabelDescription>}
			</LabelWrapper>
			{control}
			{error ? <p className='text-sm text-destructive'>{error}</p> : null}
		</div>
	);
}

export { Field };
