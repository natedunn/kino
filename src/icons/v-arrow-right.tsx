import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	strokeWidth?: number;
	size?: string;
}

function IconVShapedArrowRightOutlineDuo18({
	strokeWidth = 1.5,
	size = '18px',
	...props
}: IconProps) {
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
				d='M7.5 2.75L11.75 9L7.5 15.25'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
		</svg>
	);
}

export default IconVShapedArrowRightOutlineDuo18;
