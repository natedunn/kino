import type { SVGProps } from 'react';

export type GridDotsOutline18Props = SVGProps<SVGSVGElement>;

export function GridDotsOutline18(props: GridDotsOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<circle cx='9' cy='3' r='1' fill='currentColor' data-stroke='none'></circle>
			<circle
				cx='3'
				cy='3'
				r='1'
				fill='currentColor'
				data-color='color-2'
				data-stroke='none'
			></circle>
			<circle
				cx='15'
				cy='3'
				r='1'
				fill='currentColor'
				data-color='color-2'
				data-stroke='none'
			></circle>
			<circle
				cx='9'
				cy='9'
				r='1'
				fill='currentColor'
				data-color='color-2'
				data-stroke='none'
			></circle>
			<circle cx='3' cy='9' r='1' fill='currentColor' data-stroke='none'></circle>
			<circle cx='15' cy='9' r='1' fill='currentColor' data-stroke='none'></circle>
			<circle cx='9' cy='15' r='1' fill='currentColor' data-stroke='none'></circle>
			<circle
				cx='3'
				cy='15'
				r='1'
				fill='currentColor'
				data-color='color-2'
				data-stroke='none'
			></circle>
			<circle
				cx='15'
				cy='15'
				r='1'
				fill='currentColor'
				data-color='color-2'
				data-stroke='none'
			></circle>
		</svg>
	);
}
