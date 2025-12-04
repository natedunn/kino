import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	size?: string;
}

function IconLoader6FillDuo18({ size = '18px', ...props }: IconProps) {
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
				d='m9,17c-4.4111,0-8-3.5889-8-8S4.5889,1,9,1s8,3.5889,8,8-3.5889,8-8,8Zm0-14.5c-3.584,0-6.5,2.916-6.5,6.5s2.916,6.5,6.5,6.5,6.5-2.916,6.5-6.5-2.916-6.5-6.5-6.5Z'
				fill='currentColor'
				opacity='.4'
				strokeWidth='0'
				data-color='color-2'
			></path>
			<path
				d='m16.25,9.75c-.4141,0-.75-.3359-.75-.75,0-3.584-2.916-6.5-6.5-6.5-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75c4.4111,0,8,3.5889,8,8,0,.4141-.3359.75-.75.75Z'
				strokeWidth='0'
				fill='currentColor'
			></path>
		</svg>
	);
}

export default IconLoader6FillDuo18;
