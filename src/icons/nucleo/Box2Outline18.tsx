import type { SVGProps } from 'react';

export type Box2Outline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function Box2Outline18({ strokeWidth = 1.5, ...props }: Box2Outline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<polyline
				points='5.25 9.25 5.25 6.083 12 3.083'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></polyline>
			<path
				d='M9.406,1.931l6.344,2.819-6.344,2.819c-.259,.115-.554,.115-.812,0L2.25,4.75,8.594,1.931c.259-.115,.554-.115,.812,0Z'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
			<path
				d='M2.25,4.75v7.85c0,.395,.233,.753,.594,.914l5.75,2.556c.259,.115,.554,.115,.812,0l5.75-2.556c.361-.161,.594-.519,.594-.914V4.75'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
			<line
				x1='9'
				y1='7.656'
				x2='9'
				y2='16.069'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></line>
		</svg>
	);
}
