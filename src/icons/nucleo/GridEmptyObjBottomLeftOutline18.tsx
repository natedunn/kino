import type { SVGProps } from 'react';

export type GridEmptyObjBottomLeftOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function GridEmptyObjBottomLeftOutline18({
	strokeWidth = 1.5,
	...props
}: GridEmptyObjBottomLeftOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<rect
				x='10.75'
				y='2.25'
				width={5}
				height={5}
				rx='1'
				ry='1'
				transform='translate(26.5 9.5) rotate(-180)'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></rect>
			<rect
				x='10.75'
				y='10.75'
				width={5}
				height={5}
				rx='1'
				ry='1'
				transform='translate(26.5 26.5) rotate(-180)'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></rect>
			<rect
				x='2.25'
				y='2.25'
				width={5}
				height={5}
				rx='1'
				ry='1'
				transform='translate(9.5 9.5) rotate(-180)'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></rect>
			<path
				d='M7.25,12v-.25c0-.552-.448-1-1-1h-.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></path>
			<path
				d='M6,15.75h.25c.552,0,1-.448,1-1v-.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></path>
			<path
				d='M2.25,14.5v.25c0,.552,.448,1,1,1h.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></path>
			<path
				d='M3.5,10.75h-.25c-.552,0-1,.448-1,1v.25'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></path>
		</svg>
	);
}
