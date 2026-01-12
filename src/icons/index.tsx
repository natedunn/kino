import React from 'react';

import { cn } from '@/lib/utils';

import Box from './box';
import Bug from './bug';
import ChartUp from './chart-up';
import CircleCheck from './circle-check';
import CircleDot from './circle-dot';
import CirclePause from './circle-pause';
import CirclePlay from './circle-play';
import CircleSlash from './circle-slash';
import GridDots from './grid-dots';
import Lightbulb from './lightbulb';

export const iconRegistry = {
	lightbulb: Lightbulb,
	bug: Bug,
	gridDots: GridDots,
	box: Box,
	chartUp: ChartUp,
} as const;

export type IconValue = (typeof iconRegistry)[keyof typeof iconRegistry];

export type IconName = keyof typeof iconRegistry;

type IconProps = {
	name?: IconName;
	size?: string;
} & React.SVGProps<SVGSVGElement>;

export function Icon({
	name,
	fallback,
	...rest
}: IconProps & {
	fallback?: IconName;
}) {
	if (!name && !fallback) {
		console.warn('No icon set');
		return null;
	}
	const I = iconRegistry[!!name ? name : !!fallback ? fallback : 'box'];
	if (!I) {
		return null;
	}
	return <I {...rest} />;
}

export const StatusIcon = ({
	status,
	size,
	colored,
	...rest
}: {
	status: 'open' | 'in-progress' | 'closed' | 'completed' | 'paused';
	size?: string;
	colored: boolean;
} & React.SVGProps<SVGSVGElement>) => {
	const { className, ...props } = rest;

	const classes = cn(
		className,
		colored
			? {
					'text-blue-400': status === 'open',
					'text-purple-400': status === 'in-progress',
					'text-red-400': status === 'closed',
					'text-green-400': status === 'completed',
					'text-orange-400': status === 'paused',
				}
			: ''
	);

	switch (status) {
		case 'open':
			return <CircleDot className={classes} size={size} {...props} />;
		case 'completed':
			return <CircleCheck className={classes} size={size} {...props} />;
		case 'in-progress':
			return <CirclePlay className={classes} size={size} {...props} />;
		case 'paused':
			return <CirclePause className={classes} size={size} {...props} />;
		case 'closed':
			return <CircleSlash className={classes} size={size} {...props} />;
		default:
			return <CircleDot className={classes} size={size} {...props} />;
	}
};
