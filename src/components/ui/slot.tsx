import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Slot component that merges its props onto its child element.
 * Used to implement the asChild pattern for polymorphic components.
 */
function Slot({
	children,
	...props
}: React.PropsWithChildren<React.HTMLAttributes<HTMLElement> & Record<string, unknown>>) {
	if (!React.isValidElement(children)) {
		return null;
	}

	const childProps = children.props as Record<string, unknown>;

	return React.cloneElement(children, {
		...props,
		...childProps,
		className: cn(props.className as string, childProps.className as string),
		style: {
			...(props.style as React.CSSProperties),
			...(childProps.style as React.CSSProperties),
		},
	} as React.Attributes);
}

export { Slot };
