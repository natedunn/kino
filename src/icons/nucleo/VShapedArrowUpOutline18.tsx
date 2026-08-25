import type { SVGProps } from 'react';

export type VShapedArrowUpOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function VShapedArrowUpOutline18({
	strokeWidth = 1.5,
	...props
}: VShapedArrowUpOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<polyline
				points='2.75 10.5 9 6.25 15.25 10.5'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></polyline>
		</svg>
	);
}
