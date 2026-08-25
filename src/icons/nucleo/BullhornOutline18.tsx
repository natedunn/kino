import type { SVGProps } from 'react';

export type BullhornOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function BullhornOutline18({ strokeWidth = 1.5, ...props }: BullhornOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<path
				d='M8.805 10.75L9.787 15.397C9.901 15.937 9.556 16.468 9.015 16.582L8.037 16.789C7.497 16.903 6.966 16.558 6.852 16.017L5.75 10.75'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				data-color='color-2'
				fill='none'
			></path>{' '}
			<path
				d='M13.75 13.25C13.75 13.25 11.813 10.75 9.5 10.75H5C3.205 10.75 1.75 9.295 1.75 7.5C1.75 5.705 3.205 4.25 5 4.25H9.5C11.812 4.25 13.75 1.75 13.75 1.75V13.25Z'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>{' '}
			<path
				d='M5.75 4.25V10.75'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				fill='none'
			></path>{' '}
			<path
				d='M16.3843 6C16.9018 6.2995 17.25 6.8591 17.25 7.5C17.25 8.1409 16.9018 8.7005 16.3843 9'
				stroke='currentColor'
				strokeWidth={strokeWidth}
				strokeLinecap='round'
				strokeLinejoin='round'
				data-color='color-2'
				fill='none'
			></path>
		</svg>
	);
}
