import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	strokeWidth?: number;
	size?: string;
}

function IconPen2OutlineDuo18({ strokeWidth = 1.5, size = '18px', ...props }: IconProps) {
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
				fillRule='evenodd'
				clipRule='evenodd'
				d='M13.5606 7.47042L10.5306 4.44042L4.266 10.705C3.32896 11.642 2.76299 15.1756 2.75119 15.2498C2.7504 15.2499 2.75 15.25 2.75 15.25L2.751 15.251C2.751 15.251 2.75106 15.2506 2.75119 15.2498C2.82545 15.238 6.35897 14.672 7.296 13.735L13.5606 7.47042Z'
				fill='currentColor'
				fillOpacity='0.3'
				data-color='color-2'
				data-stroke='none'
			></path>
			<path
				d='M10.547 4.422L13.578 7.453'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M2.75 15.25C2.75 15.25 6.349 14.682 7.296 13.735C8.243 12.788 14.623 6.408 14.623 6.408C15.46 5.571 15.46 4.214 14.623 3.378C13.786 2.541 12.429 2.541 11.593 3.378C11.593 3.378 5.213 9.758 4.266 10.705C3.319 11.652 2.751 15.251 2.751 15.251L2.75 15.25Z'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
		</svg>
	);
}

export default IconPen2OutlineDuo18;
