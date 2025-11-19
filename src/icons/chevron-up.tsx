import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	size?: string;
}

function IconVShapedArrowUpFillDuo18({ size = '18px', ...props }: IconProps) {
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
				d='M9.42202 5.62999C9.16702 5.45699 8.83302 5.45699 8.57802 5.62999L2.32802 9.87999C1.98602 10.113 1.89702 10.579 2.13002 10.922C2.36302 11.266 2.83001 11.353 3.17201 11.12L9.00002 7.15697L14.828 11.12C14.957 11.208 15.104 11.25 15.249 11.25C15.489 11.25 15.725 11.135 15.87 10.922C16.103 10.579 16.014 10.113 15.672 9.87999L9.42202 5.62999Z'
				fill='currentColor'
			></path>
		</svg>
	);
}

export default IconVShapedArrowUpFillDuo18;
