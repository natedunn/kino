import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	size?: string;
}

function IconSettingsSlidersFillDuo18({ size = '18px', ...props }: IconProps) {
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
				d='m15.75,9.75H2.25c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h13.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z'
				fill='currentColor'
				opacity='.4'
				strokeWidth='0'
				data-color='color-2'
			/>
			<path
				d='m15.75,4.5H3.25c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h12.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z'
				fill='currentColor'
				opacity='.4'
				strokeWidth='0'
				data-color='color-2'
			/>
			<path
				d='m14.75,15H2.25c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h12.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z'
				fill='currentColor'
				opacity='.4'
				strokeWidth='0'
				data-color='color-2'
			/>
			<circle cx='9' cy='9' r='2.25' strokeWidth='0' fill='currentColor' />
			<circle cx='3.75' cy='3.75' r='2.25' strokeWidth='0' fill='currentColor' />
			<circle cx='14.25' cy='14.25' r='2.25' strokeWidth='0' fill='currentColor' />
		</svg>
	);
}

export default IconSettingsSlidersFillDuo18;
