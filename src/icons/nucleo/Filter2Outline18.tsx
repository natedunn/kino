import type { SVGProps } from 'react';

export type Filter2Outline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function Filter2Outline18({ strokeWidth = 1.5, ...props }: Filter2Outline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<path
				d='M10.5,16.25h-3v-7.25L3.106,5.3c-.226-.19-.356-.47-.356-.765v-1.785H15.25v1.785c0,.295-.13,.575-.356,.765l-4.394,3.7v7.25Z'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
		</svg>
	);
}
