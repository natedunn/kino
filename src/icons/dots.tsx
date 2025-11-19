import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	strokeWidth?: number;
	size?: string;
}

function IconDotsOutline18({ strokeWidth = 1.5, size = '18px', ...props }: IconProps) {
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
			<circle
				cx='9'
				cy='9'
				r='.5'
				fill='currentColor'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></circle>
			<circle
				cx='3.25'
				cy='9'
				r='.5'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				fill='currentColor'
			></circle>
			<circle
				cx='14.75'
				cy='9'
				r='.5'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				fill='currentColor'
			></circle>
		</svg>
	);
}

export default IconDotsOutline18;
