import type { SVGProps } from 'react';

export type VShapedArrowRightOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function VShapedArrowRightOutline18({
	strokeWidth = 1.5,
	...props
}: VShapedArrowRightOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<polyline
				points='7.5 2.75 11.75 9 7.5 15.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></polyline>
		</svg>
	);
}
