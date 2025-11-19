import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	strokeWidth?: number;
	size?: string;
}

function IconGridEmptyObjBottomLeftOutlineDuo18({
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
				d='M11.75 7.25L14.75 7.25C15.3023 7.25 15.75 6.80228 15.75 6.25V3.25C15.75 2.69772 15.3023 2.25 14.75 2.25L11.75 2.25C11.1977 2.25 10.75 2.69772 10.75 3.25V6.25C10.75 6.80228 11.1977 7.25 11.75 7.25Z'
				fill='currentColor'
				fillOpacity='0.3'
				data-color='color-2'
				data-stroke='none'
			></path>
			<path
				d='M11.75 15.75H14.75C15.3023 15.75 15.75 15.3023 15.75 14.75V11.75C15.75 11.1977 15.3023 10.75 14.75 10.75H11.75C11.1977 10.75 10.75 11.1977 10.75 11.75V14.75C10.75 15.3023 11.1977 15.75 11.75 15.75Z'
				fill='currentColor'
				fillOpacity='0.3'
				data-color='color-2'
				data-stroke='none'
			></path>
			<path
				d='M3.25 7.25L6.25 7.25C6.80228 7.25 7.25 6.80228 7.25 6.25L7.25 3.25C7.25 2.69772 6.80228 2.25 6.25 2.25L3.25 2.25C2.69772 2.25 2.25 2.69772 2.25 3.25L2.25 6.25C2.25 6.80228 2.69772 7.25 3.25 7.25Z'
				fill='currentColor'
				fillOpacity='0.3'
				data-color='color-2'
				data-stroke='none'
			></path>
			<path
				d='M11.75 7.25L14.75 7.25C15.3023 7.25 15.75 6.80228 15.75 6.25V3.25C15.75 2.69772 15.3023 2.25 14.75 2.25L11.75 2.25C11.1977 2.25 10.75 2.69772 10.75 3.25V6.25C10.75 6.80228 11.1977 7.25 11.75 7.25Z'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M11.75 15.75H14.75C15.3023 15.75 15.75 15.3023 15.75 14.75V11.75C15.75 11.1977 15.3023 10.75 14.75 10.75H11.75C11.1977 10.75 10.75 11.1977 10.75 11.75V14.75C10.75 15.3023 11.1977 15.75 11.75 15.75Z'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M3.25 7.25L6.25 7.25C6.80228 7.25 7.25 6.80228 7.25 6.25L7.25 3.25C7.25 2.69772 6.80228 2.25 6.25 2.25L3.25 2.25C2.69772 2.25 2.25 2.69772 2.25 3.25L2.25 6.25C2.25 6.80228 2.69772 7.25 3.25 7.25Z'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M7.25 12V11.75C7.25 11.198 6.802 10.75 6.25 10.75H6'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M6 15.75H6.25C6.802 15.75 7.25 15.302 7.25 14.75V14.5'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M2.25 14.5V14.75C2.25 15.302 2.698 15.75 3.25 15.75H3.5'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
			<path
				d='M3.5 10.75H3.25C2.698 10.75 2.25 11.198 2.25 11.75V12'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>
		</svg>
	);
}

export default IconGridEmptyObjBottomLeftOutlineDuo18;
