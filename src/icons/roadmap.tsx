import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	size?: string;
}

function IconRoadmap2FillDuo18({ size = '18px', ...props }: IconProps) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			x='0px'
			y='0px'
			width={size}
			height={size}
			viewBox='0 0 18 18'
			{...props}
		>
			<rect
				x='2'
				y='2'
				width='14'
				height='14'
				rx='2.75'
				ry='2.75'
				fill='currentColor'
				opacity='.4'
				strokeWidth='0'
				data-color='color-2'
			></rect>
			<path
				d='m11.25,9.75h-4.5c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h4.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z'
				strokeWidth='0'
				fill='currentColor'
			></path>
			<path
				d='m15.25,12.5h-4.5c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h4.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z'
				strokeWidth='0'
				fill='currentColor'
			></path>
			<path
				d='m7.25,7H2.75c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h4.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z'
				strokeWidth='0'
				fill='currentColor'
			></path>
		</svg>
	);
}

export default IconRoadmap2FillDuo18;
