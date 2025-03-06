//
// Get Base Url
type getBaseUrlArgs =
	| {
			relativePath?: boolean;
	  }
	| undefined;

export const getBaseUrl = (
	{ relativePath }: getBaseUrlArgs = {
		relativePath: true,
	}
) => {
	if (relativePath && typeof window !== 'undefined') {
		// browser should use relative path
		return '';
	}
	if (process.env.VERCEL_URL) {
		// reference for vercel.com
		return `https://${process.env.VERCEL_URL}`;
	}

	if (process.env.RENDER_INTERNAL_HOSTNAME) {
		// reference for render.com
		return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
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
