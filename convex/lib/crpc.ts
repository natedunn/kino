
import { getHeaders } from 'kitcn/auth';
import { CRPCError } from 'kitcn/server';

import { getAuth } from '../functions/generated/auth';
import { initCRPC } from '../functions/generated/server';
import type { ActionCtx, MutationCtx, QueryCtx } from '../functions/generated/server';

const c = initCRPC
	.meta<{
		auth?: 'optional' | 'required';
	}>()
	.create();

type SessionUser = {
	id: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
	username?: string | null;
	role?: string | null;
	profileId?: string | null;
};

function requireAuth<T>(user: T | null): T {
	if (!user) {
		throw new CRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
	}

	return user;
}

async function getSessionContext(ctx: QueryCtx | MutationCtx): Promise<{
	auth: ReturnType<typeof getAuth>;
	headers: Headers;
	user: SessionUser | null;
}> {
	const auth = getAuth(ctx);
	const headers = await getHeaders(ctx);
	const session = await auth.api.getSession({ headers });
	return {
		auth,
		headers,
		user: (session?.user ?? null) as SessionUser | null,
	};
}

async function getActionIdentityUser(ctx: ActionCtx): Promise<SessionUser | null> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) return null;
	return {
		email: identity.email,
		id: identity.subject,
		name: identity.name,
	};
}

export const publicQuery = c.query;
export const publicAction = c.action;
export const publicMutation = c.mutation;

export const privateQuery = c.query.internal();
export const privateMutation = c.mutation.internal();
export const privateAction = c.action.internal();

export const optionalAuthQuery = c.query.meta({ auth: 'optional' }).use(async ({ ctx, next }) => {
	const session = await getSessionContext(ctx);

	return next({
		ctx: {
			...ctx,
			auth: session.auth,
			headers: session.headers,
			user: session.user,
			userId: session.user?.id ?? null,
		},
	});
});

export const authQuery = c.query.meta({ auth: 'required' }).use(async ({ ctx, next }) => {
	const session = await getSessionContext(ctx);
	const user = requireAuth(session.user);

	return next({
		ctx: {
			...ctx,
			auth: session.auth,
			headers: session.headers,
			user,
			userId: user.id,
		},
	});
});

export const optionalAuthMutation = c.mutation
	.meta({ auth: 'optional' })
	.use(async ({ ctx, next }) => {
		const session = await getSessionContext(ctx);

		return next({
			ctx: {
				...ctx,
				auth: session.auth,
				headers: session.headers,
				user: session.user,
				userId: session.user?.id ?? null,
			},
		});
	});

export const authMutation = c.mutation.meta({ auth: 'required' }).use(async ({ ctx, next }) => {
	const session = await getSessionContext(ctx);
	const user = requireAuth(session.user);

	return next({
		ctx: {
			...ctx,
			auth: session.auth,
			headers: session.headers,
			user,
			userId: user.id,
		},
	});
});

export const authAction = c.action.meta({ auth: 'required' }).use(async ({ ctx, next }) => {
	const user = requireAuth(await getActionIdentityUser(ctx));

	return next({
		ctx: {
			...ctx,
			user,
			userId: user.id,
		},
	});
});

export const publicRoute = c.httpAction;
export const authRoute = c.httpAction.use(async ({ ctx, next }) => {
	const user = requireAuth(await getActionIdentityUser(ctx));

	return next({
		ctx: {
			...ctx,
			user,
			userId: user.id,
		},
	});
});
export const optionalAuthRoute = c.httpAction.use(async ({ ctx, next }) => {
	const user = await getActionIdentityUser(ctx);

	return next({
		ctx: {
			...ctx,
			user,
			userId: user?.id ?? null,
		},
	});
});
export const router = c.router;
