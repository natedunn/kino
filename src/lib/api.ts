import { api } from '@convex/api';

export { api };

export type API = {
	[K in keyof typeof api]: {
		[P in keyof (typeof api)[K]]: (typeof api)[K][P] extends {
			_returnType: infer R;
		}
			? R
			: never;
	};
};
