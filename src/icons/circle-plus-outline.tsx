import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	strokeWidth?: number;
	size?: string;
}

function IconCirclePlusOutlineDuo18({ strokeWidth = 1.5, size = '18px', ...props }: IconProps) {
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
			<path
				d='M9 16.25C13.0041 16.25 16.25 13.0041 16.25 9C16.25 4.99594 13.0041 1.75 9 1.75C4.99594 1.75 1.75 4.99594 1.75 9C1.75 13.0041 4.99594 16.25 9 16.25Z'
				fill='currentColor'
				fillOpacity='0.3'
				data-color='color-2'
				data-stroke='none'
			></path>
			<path
				d='M9 16.25C13.0041 16.25 16.25 13.0041 16.25 9C16.25 4.99594 13.0041 1.75 9 1.75C4.99594 1.75 1.75 4.99594 1.75 9C1.75 13.0041 4.99594 16.25 9 16.25Z'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M5.75 9H12.25'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M9 5.75V12.25'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
		</svg>
	);
}

export default IconCirclePlusOutlineDuo18;
