import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const mode = v.union(v.literal('read'), v.literal('read_write'));
export const source = v.union(v.literal('issues'), v.literal('discussions'));
export const installationStatus = v.union(
	v.literal('active'),
	v.literal('stale'),
	v.literal('deleted'),
	v.literal('suspended')
);
export const verification = v.object({
	issues: v.object({ ok: v.boolean() }),
	discussions: v.object({ ok: v.boolean(), enabled: v.boolean() }),
});
export const installationFields = {
	orgId: v.id('organizations'),
	orgSlug: v.string(),
	connectedByProfileId: v.id('profiles'),
	installationId: v.number(),
	accountId: v.number(),
	accountLogin: v.string(),
	accountType: v.string(),
	events: v.array(v.string()),
	permissions: v.record(v.string(), v.string()),
	repositorySelection: v.string(),
	status: installationStatus,
	updatedTime: v.number(),
};
export const connectionFields = {
	orgId: v.id('organizations'),
	orgSlug: v.string(),
	projectId: v.id('projects'),
	projectSlug: v.string(),
	connectedByProfileId: v.id('profiles'),
	githubInstallationId: v.id('relayInstallations'),
	repoId: v.number(),
	repoNodeId: v.string(),
	repoName: v.string(),
	repoFullName: v.string(),
	repoOwner: v.string(),
	repoPrivate: v.boolean(),
	mode,
	enabledSources: v.array(source),
	verificationStatus: v.string(),
	verificationSummary: verification,
	updatedTime: v.number(),
	deletedTime: v.optional(v.number()),
};
export const issueFields = {
	projectId: v.id('projects'),
	feedbackId: v.id('feedback'),
	connectedByProfileId: v.id('profiles'),
	githubRepositoryConnectionId: v.id('relayConnections'),
	kind: v.literal('issue'),
	githubNodeId: v.string(),
	githubDatabaseId: v.number(),
	githubNumber: v.number(),
	title: v.string(),
	state: v.string(),
	url: v.string(),
	updatedTime: v.number(),
};
export const installationView = v.object({ ...installationFields, id: v.id('relayInstallations') });
export const connectionView = v.object({ ...connectionFields, id: v.id('relayConnections') });
export const issueView = v.object({ ...issueFields, id: v.id('relayIssues') });
export const githubInstallation = v.object({
	id: v.number(),
	account: v.union(v.null(), v.object({ id: v.number(), login: v.string(), type: v.string() })),
	events: v.array(v.string()),
	permissions: v.record(v.string(), v.string()),
	repository_selection: v.string(),
});
export const githubRepository = v.object({
	id: v.number(),
	node_id: v.string(),
	name: v.string(),
	full_name: v.string(),
	private: v.boolean(),
	owner: v.object({ login: v.string() }),
});
export const relayTables = {
	relayStates: defineTable({
		createdByUserId: v.id('users'),
		orgId: v.id('organizations'),
		orgSlug: v.string(),
		projectId: v.optional(v.id('projects')),
		projectSlug: v.optional(v.string()),
		mode,
		hash: v.string(),
		expiresAt: v.number(),
		consumedAt: v.optional(v.number()),
	})
		.index('by_hash', ['hash'])
		.index('by_projectId', ['projectId'])
		.index('by_expiresAt', ['expiresAt']),
	relayInstallations: defineTable(installationFields)
		.index('by_orgId', ['orgId'])
		.index('by_orgId_and_installationId', ['orgId', 'installationId'])
		.index('by_installationId', ['installationId']),
	relayConnections: defineTable(connectionFields)
		.index('by_projectId_and_deletedTime', ['projectId', 'deletedTime'])
		.index('by_orgId_and_repoId', ['orgId', 'repoId'])
		.index('by_orgId_and_deletedTime', ['orgId', 'deletedTime'])
		.index('by_githubInstallationId', ['githubInstallationId'])
		.index('by_repoId', ['repoId']),
	relayIssues: defineTable(issueFields)
		.index('by_feedbackId', ['feedbackId'])
		.index('by_projectId', ['projectId'])
		.index('by_githubRepositoryConnectionId_and_githubNodeId', [
			'githubRepositoryConnectionId',
			'githubNodeId',
		])
		.index('by_feedbackId_and_githubNodeId', ['feedbackId', 'githubNodeId']),
	relayDeliveries: defineTable({
		deliveryId: v.string(),
		event: v.string(),
		result: v.union(v.literal('processed'), v.literal('ignored')),
		receivedAt: v.number(),
	})
		.index('by_deliveryId', ['deliveryId'])
		.index('by_receivedAt', ['receivedAt']),
};
