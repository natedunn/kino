// components/ClickableCard.tsx
import { forwardRef, useRef, useState } from 'react';

interface ClickableContainerProps {
	onClick: () => void;
	children: React.ReactNode;
	className?: string;
	'aria-label'?: string;
	'aria-labelledby'?: string;
	'aria-describedby'?: string;
	disabled?: boolean;
}

export const ClickableContainer = forwardRef<HTMLDivElement, ClickableContainerProps>(
	(
		{
			onClick,
			children,
			className = '',
			'aria-label': ariaLabel,
			'aria-labelledby': ariaLabelledBy,
			'aria-describedby': ariaDescribedBy,
			disabled = false,
			...props
		},
		ref
	) => {
		const [hasActiveSelection, setHasActiveSelection] = useState(false);
		const mouseStartPos = useRef<{ x: number; y: number } | null>(null);

		const handleMouseDown = (e: React.MouseEvent) => {
			mouseStartPos.current = { x: e.clientX, y: e.clientY };
			setHasActiveSelection(false);
		};

		const handleMouseMove = (e: React.MouseEvent) => {
			if (!mouseStartPos.current) return;

			const moved =
				Math.abs(e.clientX - mouseStartPos.current.x) > 3 ||
				Math.abs(e.clientY - mouseStartPos.current.y) > 3;

			if (moved) {
				setHasActiveSelection(true);
			}
		};

		const handleMouseUp = () => {
			setTimeout(() => {
				const selection = window.getSelection();
				const hasSelection = selection && selection.toString().length > 0 ? true : false;
				setHasActiveSelection(hasSelection);
			}, 10);
		};

		const handleClick = (e: React.MouseEvent) => {
			if (disabled || hasActiveSelection) {
				return;
			}

			// Don't navigate if clicking on interactive elements
			const target = e.target as HTMLElement;
			if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
				return;
			}

			onClick();
		};

		const handleKeyDown = (e: React.KeyboardEvent) => {
			if (disabled) return;

			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onClick();
			}
		};

		return (
			<div
				ref={ref}
				role='button'
				tabIndex={disabled ? -1 : 0}
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledBy}
				aria-describedby={ariaDescribedBy}
				aria-disabled={disabled}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				className={` ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className} `}
				{...props}
			>
				{children}
			</div>
		);
	}
);

ClickableContainer.displayName = 'ClickableContainer';
