import { createConsola } from 'consola';

import { env } from '@/lib/env/shared';

// Get Base Url
export const getBaseUrl = ({
	relativePath = true,
}: {
	relativePath?: boolean;
} = {}) => {
	if (relativePath && typeof window !== 'undefined') {
		// browser should use relative path
		return '';
	}

	if (process.env.VERCEL_URL) {
		// reference for vercel.com
		return `https://${env.VERCEL_URL}`;
	}

	if (env.NEXT_PUBLIC_ROOT_DOMAIN) {
		if (env.NEXT_PUBLIC_ROOT_DOMAIN.includes('localhost')) {
			return `http://${env.NEXT_PUBLIC_ROOT_DOMAIN}`;
		}
		return `https://${env.NEXT_PUBLIC_ROOT_DOMAIN}`;
	}

	// assume localhost
	return `http://localhost:${process.env.PORT ?? 3000}`;
};

//
// Try Catch
type Success<T> = {
	data: T;
	error: null;
};

type Failure<E> = {
	data: null;
	error: E;
};

type Result<T, E = Error> = Success<T> | Failure<E>;

export async function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
	try {
		const data = await promise;
		return { data, error: null };
	} catch (error) {
		return { data: null, error: error as E };
	}
}

//
// Logger with Consola
export const log = createConsola({
	formatOptions: {
		colors: true,
		compact: false,
	},
});
