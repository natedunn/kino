import React from 'react';

import Box from './box';
import Bug from './bug';
import ChartUp from './chart-up';
import GridDots from './grid-dots';
import Lightbulb from './lightbulb';

type Props = {
	name: IconKey;
	size?: string;
} & React.SVGProps<SVGSVGElement>;

export const iconRegistry = {
	lightbulb: Lightbulb,
	bug: Bug,
	gridDots: GridDots,
	box: Box,
	chartUp: ChartUp,
} as const;

export type IconValue = (typeof iconRegistry)[keyof typeof iconRegistry];

export type IconKey = keyof typeof iconRegistry;

export function Icon({ name, ...rest }: Props) {
	const Cmp = iconRegistry[name];
	if (!Cmp) return null; // or a fallback icon

	return <Cmp {...rest} />;
}
