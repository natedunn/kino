import { JSX } from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
	size?: string;
}

export type Icon = (args: IconProps) => JSX.Element;
