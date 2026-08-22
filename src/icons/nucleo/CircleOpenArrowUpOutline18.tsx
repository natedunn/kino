import type { SVGProps } from 'react';

export type CircleOpenArrowUpOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function CircleOpenArrowUpOutline18({
	strokeWidth = 1.5,
	...props
}: CircleOpenArrowUpOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<polyline
				points='12.25 9 9 5.75 5.75 9'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></polyline>
			<path
				d='M9,5.75v10.5'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></path>
			<path
				d='M9,16.25c-4.004,0-7.25-3.246-7.25-7.25,0-4.004,3.246-7.25,7.25-7.25s7.25,3.246,7.25,7.25c0,2.934-1.743,5.461-4.25,6.602'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
		</svg>
	);
}
