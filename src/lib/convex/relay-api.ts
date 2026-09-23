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
	args: (a: TArgs) => FunctionArgs<TFunction>
) {
	const queryOptions = (a: TArgs, extra?: Extra): Options<FunctionReturnType<TFunction>> =>
		({
			...(extra?.enabled === false
				? { queryKey: ['convexQuery', getFunctionName(fn), 'skip'], enabled: false }
				: convexQuery(fn, args(a))),
			...(extra?.enabled === undefined ? {} : { enabled: extra.enabled }),
		}) as Options<FunctionReturnType<TFunction>>;
	return {
		queryOptions,
		staticQueryOptions: queryOptions,
		queryKey: (a: TArgs) => queryOptions(a).queryKey,
	};
}
function write<TArgs, TResult>(mutationFn: (a: TArgs) => Promise<TResult>) {
	return {
		mutationOptions: (
			options?: Omit<UseMutationOptions<TResult, Error, TArgs>, 'mutationFn'>
		): UseMutationOptions<TResult, Error, TArgs> => ({ ...options, mutationFn }),
	};
}
type Slugs = { orgSlug: string; projectSlug?: string };
const integration = read(api.relay.integration, (a: Slugs) => a);
const nativeReads = {
	github: { getOrgIntegration: integration, getProjectIntegration: integration },
	project: {
		getDetails: read(api.projects.getBySlugs, (a: { orgSlug: string; slug: string }) => ({
			organizationSlug: a.orgSlug,
			projectSlug: a.slug,
		})),
	},
	feedbackGithub: {
		getAvailability: read(api.relayFeedback.getAvailability, (a: { feedbackId: string }) => ({
			feedbackId: a.feedbackId as Id<'feedback'>,
		})),
		listByFeedback: read(api.relayFeedback.listByFeedback, (a: { feedbackId: string }) => ({
			feedbackId: a.feedbackId as Id<'feedback'>,
		})),
	},
};
export const relayServer = nativeReads;
export function useRelayAPI() {
	const c = useConvex();
	const start =
		(refresh: boolean) =>
		async (a: Slugs & { mode?: 'read' | 'read_write'; callbackTargetUrl?: string }) => {
			const r = await c.mutation(api.relay.start, { ...a, refresh });
			return { installUrl: r.url, authorizeUrl: r.url };
		};
	return {
		...nativeReads,
		github: {
			...nativeReads.github,
			startOrgConnection: write(start(false)),
			startProjectConnection: write(start(false)),
			startInstallationRefresh: write(start(true)),
			startOrgInstallationRefresh: write(start(true)),
			disconnectRepository: write((a: Slugs & { projectSlug: string; connectionId: string }) =>
				c.mutation(api.relay.disconnectRepository, {
					...a,
					connectionId: a.connectionId as Id<'relayConnections'>,
				})
			),
		},
		githubExternal: {
			listInstallationRepositoriesForProject: write(
				(a: FunctionArgs<typeof api.relayActions.listInstallationRepositoriesForProject>) =>
					c.action(api.relayActions.listInstallationRepositoriesForProject, a)
			),
			connectRepository: write((a: FunctionArgs<typeof api.relayActions.connectRepository>) =>
				c.action(api.relayActions.connectRepository, a)
			),
		},
		feedbackGithub: {
			...nativeReads.feedbackGithub,
			searchTargets: {
				queryOptions: (a: { feedbackId: string; kind: 'issue'; query: string }, extra?: Extra) => ({
					queryKey: ['relayIssueSearch', a],
					queryFn: () =>
						c.action(api.relayFeedbackActions.searchTargets, {
							...a,
							feedbackId: a.feedbackId as Id<'feedback'>,
						}),
					enabled: extra?.enabled,
					retry: false,
				}),
			},
			connectExisting: write(
				(a: { feedbackId: string; kind: 'issue'; githubNumber: number; feedbackUrl: string }) =>
					c.action(api.relayFeedbackActions.connect, {
						...a,
						feedbackId: a.feedbackId as Id<'feedback'>,
					})
			),
			createAndConnect: write(
				(a: {
					feedbackId: string;
					kind: 'issue';
					title: string;
					body: string;
					feedbackUrl: string;
				}) =>
					c.action(api.relayFeedbackActions.connect, {
						...a,
						feedbackId: a.feedbackId as Id<'feedback'>,
					})
			),
			refreshCounts: write((a: { feedbackId: string }) =>
				c.action(api.relayFeedbackActions.refreshCounts, {
					feedbackId: a.feedbackId as Id<'feedback'>,
				})
			),
		},
	};
}
