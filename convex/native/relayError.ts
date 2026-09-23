import { ConvexError } from 'convex/values';

export class RelayError extends ConvexError<{ code: string; message: string }> {
	constructor(args: { code: string; message: string }) {
		super(args);
	}
}
