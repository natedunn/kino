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
import Edit from './edit';
import Github from './github';
import GridDots from './grid-dots';
import Improvements from './improvements';
import Lightbulb from './lightbulb';

export const iconRegistry = {
	lightbulb: Lightbulb,
	bug: Bug,
	improvements: Improvements,
	gridDots: GridDots,
	box: Box,
	chartUp: ChartUp,
	github: Github,
	edit: Edit,
} as const;

export type IconValue = (typeof iconRegistry)[keyof typeof iconRegistry];

export type IconName = keyof typeof iconRegistry;

export type IconTone = 'duo' | 'outline';

export type IconRegistryOption = {
	icon: IconValue;
	keywords?: Array<string>;
	label: string;
	tone: IconTone;
	value: IconName;
};

export const iconRegistryOptions: Array<IconRegistryOption> = [
	{
		icon: Lightbulb,
		keywords: ['idea', 'feature request'],
		label: 'Feature Requests',
		tone: 'duo',
		value: 'lightbulb',
	},
	{ icon: Bug, keywords: ['issue', 'defect'], label: 'Bugs', tone: 'duo', value: 'bug' },
	{
		icon: Improvements,
		keywords: ['iteration', 'enhancement', 'wrench'],
		label: 'Improvements',
		tone: 'duo',
		value: 'improvements',
	},
	{ icon: Box, keywords: ['default', 'package'], label: 'Box', tone: 'duo', value: 'box' },
	{
		icon: ChartUp,
		keywords: ['trend', 'metrics', 'growth'],
		label: 'Chart Up',
		tone: 'duo',
		value: 'chartUp',
	},
	{
		icon: GridDots,
		keywords: ['grid', 'apps'],
		label: 'Grid Dots',
		tone: 'duo',
		value: 'gridDots',
	},
	{ icon: Edit, keywords: ['write', 'pencil'], label: 'Edit', tone: 'duo', value: 'edit' },
	{
		icon: Github,
		keywords: ['repository', 'code'],
		label: 'GitHub',
		tone: 'outline',
		value: 'github',
	},
];

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
	// Callers cast dynamic strings (e.g. DB-stored board icons) to `IconName`, so
	// the lookup can miss the registry at runtime; widen the type to reflect that
	// and guard against a bad key.
	const I = (name ? iconRegistry[name] : undefined) ?? iconRegistry[fallback ?? 'box'];
	if (!I) return null;
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

export { default as GithubIcon } from './github';
export { default as EditIcon } from './edit';
export { default as SearchSparkleIcon } from './search-sparkle';
