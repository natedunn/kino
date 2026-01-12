import * as React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
	size?: string;
}

const SvgIcon = ({ size = '18px', ...props }: IconProps) => (
	<svg
		xmlns='http://www.w3.org/2000/svg'
		width={size}
		height={size}
		fill='none'
		stroke='currentColor'
		strokeLinecap='round'
		strokeLinejoin='round'
		strokeWidth='2'
		viewBox='0 0 24 24'
		{...props}
	>
		<circle cx='12' cy='12' r='10'></circle>
		<circle cx='12' cy='12' r='10' fill='currentColor' opacity='0.3'></circle>
		<path d='M10 15V9M14 15V9'></path>
	</svg>
);

export default SvgIcon;
