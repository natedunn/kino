import type { SVGProps } from 'react';

export type AddMagicOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function AddMagicOutline18({ strokeWidth = 1.5, ...props }: AddMagicOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<polygon
				points='7.5 3.5 9.1287 7.6204 13.25 9.25 9.1287 10.8796 7.5 15 5.8704 10.8796 1.75 9.25 5.8704 7.6204 7.5 3.5'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></polygon>
			<circle
				cx='14'
				cy='4'
				r='1.75'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></circle>
			<line
				x1='14.25'
				y1='12.5'
				x2='14.25'
				y2='16'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></line>
			<line
				x1='16'
				y1='14.25'
				x2='12.5'
				y2='14.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></line>
		</svg>
	);
}
