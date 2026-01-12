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
		<path d='M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z'></path>
		<circle cx='12' cy='12' r='10'></circle>
		<circle cx='12' cy='12' r='10' fill='currentColor' opacity='0.3'></circle>
	</svg>
);

export default SvgIcon;
