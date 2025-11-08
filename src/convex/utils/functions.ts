import { customAction, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import { zCustomAction, zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import {
	action as _action,
	internalAction as _internalAction,
	internalMutation as _internalMutation,
	internalQuery as _internalQuery,
	mutation as _mutation,
	query as _query,
} from '../_generated/server';
import { actionCtx, mutationCtx, mutationCtxAuthed, queryCtx, queryCtxAuthed } from './context';

//
// External
export const zQuery = zCustomQuery(_query, queryCtx);
export const zMutation = zCustomMutation(_mutation, mutationCtx);
export const zAction = zCustomAction(_action, actionCtx);
export const query = customQuery(_query, queryCtx);
export const mutation = customMutation(_mutation, mutationCtx);
export const action = customAction(_action, actionCtx);

// External -> Authed
// Note: there is no way to check for authentication in an action
export const zAuthedQuery = zCustomQuery(_query, queryCtxAuthed);
export const zAuthedMutation = zCustomMutation(_mutation, mutationCtxAuthed);
export const authedQuery = customQuery(_query, queryCtxAuthed);
export const authedMutation = customMutation(_mutation, mutationCtxAuthed);

//
// Internal
export const zInternalQuery = zCustomQuery(_internalQuery, queryCtx);
export const zInternalMutation = zCustomMutation(_internalMutation, mutationCtx);
export const zInternalAction = zCustomAction(_internalAction, actionCtx);
export const internalQuery = customQuery(_internalQuery, queryCtx);
export const internalMutation = customMutation(_internalMutation, mutationCtx);
export const internalAction = customAction(_internalAction, actionCtx);
