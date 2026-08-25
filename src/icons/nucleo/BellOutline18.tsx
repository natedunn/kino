import type { SVGProps } from 'react';

export type BellOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function BellOutline18({ strokeWidth = 1.5, ...props }: BellOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<path
				d='M15.75 12.75C14.645 12.75 13.75 11.855 13.75 10.75V6.5C13.75 3.877 11.623 1.75 9 1.75C6.377 1.75 4.25 3.877 4.25 6.5V10.75C4.25 11.855 3.355 12.75 2.25 12.75H15.75Z'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>{' '}
			<path
				d='M10.5 15.3843C10.2005 15.9018 9.6409 16.25 9 16.25C8.3591 16.25 7.7995 15.9018 7.5 15.3843'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				data-color='color-2'
				fill='none'
			></path>
		</svg>
	);
}
