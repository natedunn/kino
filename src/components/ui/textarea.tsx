'use client';

import type { ExtendedComponentProps } from '@/lib/types';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { mergeRefs } from 'react-merge-refs';

import { cn } from '@/lib/utils';

export type TextAreaProps = ExtendedComponentProps<
	'textarea',
	{
		adaptive?: boolean | number;
		error?: string;
		children?: ((state: ChildrenState) => React.ReactNode) | React.ReactNode;
		onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>, data: OnChangeData) => void;
	}
>;

type ChildrenState = {
	value: TextAreaProps['value'];
	isDirty: boolean;
	maxLength: number;
};

type OnChangeData = {
	isDirty: boolean;
};

/**
 * ✳️ — A textarea component with optional adaptive height.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
	(
		{
			rows = 2,
			adaptive = true,
			maxLength = 1000,
			children,
			// id,
			// error,
			onChange,
			className,
			...props
		}: TextAreaProps,
		ref
	) => {
		const inputRef = useRef<HTMLTextAreaElement>(null);
		const [value, setValue] = useState(props.defaultValue ?? '');
		const [isDirty, setIsDirty] = useState(false);

		useEffect(() => {
			if (inputRef.current && !!adaptive) {
				inputRef.current.style.height = 'auto';
				const scrollHeight = inputRef.current.scrollHeight;

				// Set the bumper to adjust for the border
				const heightBumper = typeof adaptive === 'number' ? adaptive : 0;

				if (!!value) {
					inputRef.current.style.height = scrollHeight + heightBumper + 'px';
				} else {
					inputRef.current.style.height = 'auto';
				}
			}
		}, [inputRef, value, adaptive]);

		// Dirty checker
		useEffect(() => {
			if ((props.defaultValue && props.defaultValue !== value) || (!props.defaultValue && value)) {
				setIsDirty(true);
			} else {
				setIsDirty(false);
			}
		}, [props.defaultValue, value]);

		const render = () => {
			if (typeof children === 'function') {
				return children({ value, isDirty, maxLength });
			}
			return children;
		};

		return (
			<>
				<textarea
					ref={mergeRefs([inputRef, ref])}
					onChange={(e) => {
						setValue(e.target.value);
						onChange?.(e, {
							isDirty,
						});
					}}
					className={cn(
						'flex min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-base transition-[color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40',
						adaptive && 'resize-none',
						className
					)}
					maxLength={maxLength}
					rows={rows}
					{...props}
				/>
				{render()}
			</>
		);
	}
);
Textarea.displayName = 'Textarea';
