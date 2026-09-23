import type { AppLocale } from '@convex/i18n';
import type { QueryFunction, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { useConvex } from 'convex/react';
import { getFunctionName } from 'convex/server';

import { api } from '../../../convex/native/_generated/api';

type Options<T> = Omit<UseQueryOptions<T>, 'queryFn'> & { queryFn?: QueryFunction<T> };
type Extra = { enabled?: boolean; skipUnauth?: boolean; subscribe?: boolean };

function read<TFunction extends FunctionReference<'query'>, TArgs>(
	fn: TFunction,
	args: (value: TArgs) => FunctionArgs<TFunction>
) {
	return {
		queryOptions: (value: TArgs, extra?: Extra): Options<FunctionReturnType<TFunction>> =>
			({
				...(extra?.enabled === false
					? { queryKey: ['convexQuery', getFunctionName(fn), 'skip'], enabled: false }
					: convexQuery(fn, args(value))),
				...(extra?.enabled === undefined ? {} : { enabled: extra.enabled }),
			}) as Options<FunctionReturnType<TFunction>>,
	};
}

function write<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
	return {
		mutationOptions: (
			options?: Omit<UseMutationOptions<TResult, Error, TArgs>, 'mutationFn'>
		): UseMutationOptions<TResult, Error, TArgs> => ({ ...options, mutationFn }),
	};
}

const nativeProfileReads = {
	findMyProfile: {
		...read(api.profiles.me, (_args: Record<string, never>) => ({})),
	},
	getByUsername: read(api.profiles.getByUsername, (args: { username: string }) => args),
};

const nativeReads = { profile: nativeProfileReads };

export const profileServer = nativeReads;

export function useProfileAPI() {
	const convex = useConvex();
	return {
		profile: {
			...nativeProfileReads,
			generateAvatarUploadUrl: write<
				Record<string, never>,
				{
					key: string;
					method?: 'POST';
					url: string;
				}
			>(async (_args) => {
				const upload = await convex.mutation(api.profiles.generateAvatarUploadUrl, {});
				return { key: upload.uploadToken, method: 'POST', url: upload.uploadUrl };
			}),
			syncMetadata: write(async (args: { key: string; storageId?: string }) => {
				if (!args.storageId) throw new Error('Avatar upload did not return a storage ID');
				try {
					await convex.mutation(api.profiles.registerAvatarUpload, {
						storageId: args.storageId as Id<'_storage'>,
						uploadToken: args.key,
					});
					await convex.mutation(api.profiles.commitAvatar, {
						storageId: args.storageId as Id<'_storage'>,
						uploadToken: args.key,
					});
				} catch (error) {
					await convex
						.mutation(api.profiles.discardAvatarUpload, {
							uploadToken: args.key,
						})
						.catch(() => undefined);
					throw error;
				}
				return null;
			}),
			update: write((args: FunctionArgs<typeof api.profiles.update>) =>
				convex.mutation(api.profiles.update, args)
			),
			updateLocale: write((args: { locale: AppLocale }) =>
				convex.mutation(api.profiles.updateLocale, args)
			),
		},
	};
}
