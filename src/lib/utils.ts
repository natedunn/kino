export { cn } from 'cnfast';

export type ClassValue =
	| string
	| number
	| bigint
	| boolean
	| null
	| undefined
	| Array<ClassValue>
	| { [key: string]: any };
