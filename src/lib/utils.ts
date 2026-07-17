export { cn } from 'cnfast';

export type ClassValue =
	| string
	| number
	| bigint
	| boolean
	| null
	| undefined
	| ClassValue[]
	| { [key: string]: any };
