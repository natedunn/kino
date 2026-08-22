import type { SVGProps } from 'react';

export type Lightbulb2Outline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function Lightbulb2Outline18({ strokeWidth = 1.5, ...props }: Lightbulb2Outline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<path
				d='M9 11.25V8.25L7 6.25'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				data-color='color-2'
				fill='none'
			></path>{' '}
			<path
				d='M9 8.25L11 6.25'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				data-color='color-2'
				fill='none'
			></path>{' '}
			<path
				d='M14 6.75C14 3.637 11.154 1.18801 7.92201 1.86301C5.99001 2.26601 4.44702 3.85599 4.08802 5.79599C3.65402 8.13999 4.85901 10.255 6.75001 11.211V14.25C6.75001 15.355 7.64501 16.25 8.75001 16.25H9.25001C10.355 16.25 11.25 15.355 11.25 14.25V11.211C12.88 10.387 14 8.701 14 6.75Z'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>{' '}
			<path
				d='M6.75 11.25H11.25'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
		</svg>
	);
}
