import type { SVGProps } from 'react';

export type Loader6Outline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function Loader6Outline18({ strokeWidth = 1.5, ...props }: Loader6Outline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<path
				d='m9,1.75c4.0041,0,7.25,3.2459,7.25,7.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
		</svg>
	);
}
