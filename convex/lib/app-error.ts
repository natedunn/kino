import type { CRPCErrorCode } from 'kitcn/server';
import type { AppErrorCode, AppErrorValues } from '../shared/app-errors';

import { CRPCError } from 'kitcn/server';

export function appError(args: {
	code: CRPCErrorCode;
	appCode: AppErrorCode;
	message: string;
	values?: AppErrorValues;
}) {
	return new CRPCError({
		code: args.code,
		message: args.message,
		data: {
			appErrorCode: args.appCode,
			...(args.values ? { appErrorValues: JSON.stringify(args.values) } : {}),
		},
	});
}
