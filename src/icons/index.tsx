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

export type IconKey = keyof typeof iconRegistry;

// export const lazyIconRegistry = {
// 	lightbulb: () => import('./lightbulb').then((m) => m.default),
// 	user: () => import('./bug').then((m) => m.default),
// } as const;

// export function LazyIcon({ name, ...svgProps }: Props) {
// 	const importFn = lazyIconRegistry[name];

// 	const Cmp = React.useMemo(
// 		() =>
// 			React.lazy(async () => {
// 				const mod = await importFn();
// 				return { default: (props: any) => React.createElement(mod, props) };
// 			}),
// 		[importFn]
// 	);

// 	return (
// 		<React.Suspense fallback={<GridDots />}>
// 			<Cmp {...svgProps} />
// 		</React.Suspense>
// 	);
// }

export function Icon({ name, ...rest }: Props) {
	const Cmp = iconRegistry[name];
	if (!Cmp) return null; // or a fallback icon
	return <Cmp {...rest} />;
}
