import type { SVGProps } from 'react';

export type InterviewOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function InterviewOutline18({ strokeWidth = 1.5, ...props }: InterviewOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<path
				d='m10.75,1.25h-3.5c-.827,0-1.5.673-1.5,1.5v1.5c0,.827.673,1.5,1.5,1.5h.5v2l2.227-2h.773c.827,0,1.5-.673,1.5-1.5v-1.5c0-.827-.673-1.5-1.5-1.5Z'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></path>
			<path
				d='m1.75,16.25v-1.5h1.353c.865,0,1.584-.668,1.646-1.532l.092-1.274,1.241-.496-1.238-1.651c0-2.255-1.508-4.159-3.57-4.757'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
			<path
				d='m2.5,10c.414,0,.75-.336.75-.75s-.336-.75-.75-.75-.75.336-.75.75.336.75.75.75Z'
				strokeWidth={0}
				fill='currentColor'
			></path>
			<path
				d='m16.25,16.25v-1.5h-1.353c-.865,0-1.584-.668-1.646-1.532l-.092-1.274-1.241-.496,1.238-1.651c0-2.255,1.508-4.159,3.57-4.757'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
			<path
				d='m15.5,10c.414,0,.75-.336.75-.75s-.336-.75-.75-.75-.75.336-.75.75.336.75.75.75Z'
				strokeWidth={0}
				fill='currentColor'
			></path>
		</svg>
	);
}
