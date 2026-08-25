import type { SVGProps } from 'react';

export type ChevronLeftOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function ChevronLeftOutline18({ strokeWidth = 1.5, ...props }: ChevronLeftOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<polyline
				points='11.5 15.25 5.25 9 11.5 2.75'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></polyline>
		</svg>
	);
}
