import type { SVGProps } from 'react';

export type ChartTrendUpOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function ChartTrendUpOutline18({ strokeWidth = 1.5, ...props }: ChartTrendUpOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<path
				d='M2.75,10.75l3.646-3.646c.195-.195,.512-.195,.707,0l3.293,3.293c.195,.195,.512,.195,.707,0l4.146-4.146'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></path>
			<polyline
				points='15.25 9.75 15.25 6.25 11.75 6.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></polyline>
			<path
				d='M2.75,2.75V12.75c0,1.105,.895,2,2,2H15.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
		</svg>
	);
}
