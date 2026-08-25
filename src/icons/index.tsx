import React from 'react';

import { cn } from '@/lib/utils';

import Box from './box';
import Bug from './bug';
import ChartUp from './chart-up';
import UpChevron from './chevron-up';
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
import { Box2Outline18 } from './nucleo/Box2Outline18';
import { BugOutline18 } from './nucleo/BugOutline18';
import { ChartTrendUpOutline18 } from './nucleo/ChartTrendUpOutline18';
import { CircleOpenArrowUpOutline18 } from './nucleo/CircleOpenArrowUpOutline18';
import { GridDotsOutline18 } from './nucleo/GridDotsOutline18';
import { Lightbulb2Outline18 } from './nucleo/Lightbulb2Outline18';
import { PenOutline18 } from './nucleo/PenOutline18';
import { SettingsWrenchOutline18 } from './nucleo/SettingsWrenchOutline18';
import { VShapedArrowUpOutline18 } from './nucleo/VShapedArrowUpOutline18';
import UpArrowCircle from './up-arrow-circle';

export const iconRegistry = {
	lightbulb: { 'glyph-duo': Lightbulb, outline: Lightbulb2Outline18 },
	bug: { 'glyph-duo': Bug, outline: BugOutline18 },
	improvements: { 'glyph-duo': Improvements, outline: SettingsWrenchOutline18 },
	gridDots: { 'glyph-duo': GridDots, outline: GridDotsOutline18 },
	box: { 'glyph-duo': Box, outline: Box2Outline18 },
	chartUp: { 'glyph-duo': ChartUp, outline: ChartTrendUpOutline18 },
	github: { outline: Github },
	edit: { 'glyph-duo': Edit, outline: PenOutline18 },
	upArrowCircle: { 'glyph-duo': UpArrowCircle, outline: CircleOpenArrowUpOutline18 },
	upChevron: { 'glyph-duo': UpChevron, outline: VShapedArrowUpOutline18 },
} as const;

export type IconValue = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type IconName = keyof typeof iconRegistry;

export type IconVariant = 'glyph-duo' | 'outline';

export type IconTone = IconVariant;

export type IconRegistryOption = {
	icon: IconValue;
	keywords?: Array<string>;
	label: string;
	tone: IconTone;
	value: IconName;
};

export const iconRegistryOptions: Array<IconRegistryOption> = [
	{
		icon: iconRegistry.lightbulb['glyph-duo'],
		keywords: ['idea', 'feature request'],
		label: 'Feature Requests',
		tone: 'glyph-duo',
		value: 'lightbulb',
	},
	{
		icon: iconRegistry.bug['glyph-duo'],
		keywords: ['issue', 'defect'],
		label: 'Bugs',
		tone: 'glyph-duo',
		value: 'bug',
	},
	{
		icon: iconRegistry.improvements['glyph-duo'],
		keywords: ['iteration', 'enhancement', 'wrench'],
		label: 'Improvements',
		tone: 'glyph-duo',
		value: 'improvements',
	},
	{
		icon: iconRegistry.box['glyph-duo'],
		keywords: ['default', 'package'],
		label: 'Box',
		tone: 'glyph-duo',
		value: 'box',
	},
	{
		icon: iconRegistry.chartUp['glyph-duo'],
		keywords: ['trend', 'metrics', 'growth'],
		label: 'Chart Up',
		tone: 'glyph-duo',
		value: 'chartUp',
	},
	{
		icon: iconRegistry.gridDots['glyph-duo'],
		keywords: ['grid', 'apps'],
		label: 'Grid Dots',
		tone: 'glyph-duo',
		value: 'gridDots',
	},
	{
		icon: iconRegistry.edit['glyph-duo'],
		keywords: ['write', 'pencil'],
		label: 'Edit',
		tone: 'glyph-duo',
		value: 'edit',
	},
	{
		icon: iconRegistry.github.outline,
		keywords: ['repository', 'code'],
		label: 'GitHub',
		tone: 'outline',
		value: 'github',
	},
	{
		icon: iconRegistry.upArrowCircle['glyph-duo'],
		keywords: ['scroll to top', 'back to top', 'arrow up'],
		label: 'Up Arrow Circle',
		tone: 'glyph-duo',
		value: 'upArrowCircle',
	},
	{
		icon: iconRegistry.upChevron['glyph-duo'],
		keywords: ['up', 'expand', 'top', 'chevron'],
		label: 'Up Chevron',
		tone: 'glyph-duo',
		value: 'upChevron',
	},
];

type IconProps = {
	name?: IconName;
	size?: string;
	variant?: IconVariant;
} & React.SVGProps<SVGSVGElement>;

export function Icon({
	name,
	fallback,
	size,
	variant = 'glyph-duo',
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
	const registry = iconRegistry as Partial<Record<string, (typeof iconRegistry)[IconName]>>;
	const entry = (name ? registry[name] : undefined) ?? registry[fallback ?? 'box'];
	if (!entry) return null;
	const variants = entry as Partial<Record<IconVariant, IconValue>>;
	const I = variants[variant] ?? variants['glyph-duo'] ?? variants.outline;
	if (!I) return null;
	return <I height={size} width={size} {...rest} />;
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
export { default as UpArrowCircleIcon } from './up-arrow-circle';
export { default as UpChevronIcon } from './chevron-up';
export { default as SearchSparkleIcon } from './search-sparkle';
