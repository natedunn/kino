import type { SVGProps } from 'react';

export type Folder5OpenOutline18Props = SVGProps<SVGSVGElement> & {
	strokeWidth?: number | string;
};

export function Folder5OpenOutline18({ strokeWidth = 1.5, ...props }: Folder5OpenOutline18Props) {
	return (
		<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} viewBox='0 0 18 18' {...props}>
			<path
				d='M4.18,15.25h-.43c-1.105,0-2-.895-2-2V3.75c0-.552,.448-1,1-1h3.797c.288,0,.563,.125,.753,.342l2.325,2.658h5.626'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
				data-color='color-2'
			></path>
			<path
				d='M16.187,8.25H5.308c-.472,0-.879,.329-.978,.79l-1.071,5c-.133,.623,.341,1.21,.978,1.21H15.115c.472,0,.879-.329,.978-.79l1.071-5c.133-.623-.341-1.21-.978-1.21Z'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={strokeWidth}
			></path>
		</svg>
	);
}
