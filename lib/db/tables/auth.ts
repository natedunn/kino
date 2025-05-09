import { boolean, int, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const user = mysqlTable('user', {
	id: varchar('id', { length: 36 }).primaryKey(),
	name: text('name').notNull(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	twoFactorEnabled: boolean('two_factor_enabled'),
	normalizedEmail: varchar('normalized_email', { length: 255 }).unique(),
	username: varchar('username', { length: 255 }).notNull().unique(),
	displayUsername: text('display_username'),
	role: text('role').notNull(),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires'),
});

export const session = mysqlTable('session', {
	id: varchar('id', { length: 36 }).primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: varchar('token', { length: 255 }).notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: varchar('user_id', { length: 36 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	impersonatedBy: text('impersonated_by'),
	activeOrganizationId: text('active_organization_id'),
});

export const account = mysqlTable('account', {
	id: varchar('id', { length: 36 }).primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: varchar('user_id', { length: 36 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
});

export const verification = mysqlTable('verification', {
	id: varchar('id', { length: 36 }).primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at'),
});

export const twoFactor = mysqlTable('two_factor', {
	id: varchar('id', { length: 36 }).primaryKey(),
	secret: text('secret').notNull(),
	backupCodes: text('backup_codes').notNull(),
	userId: varchar('user_id', { length: 36 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
});

export const organization = mysqlTable('organization', {
	id: varchar('id', { length: 36 }).primaryKey(),
	name: text('name').notNull(),
	slug: varchar('slug', { length: 255 }).unique(),
	logo: text('logo'),
	createdAt: timestamp('created_at').notNull(),
	metadata: text('metadata'),
});

export const member = mysqlTable('member', {
	id: varchar('id', { length: 36 }).primaryKey(),
	organizationId: varchar('organization_id', { length: 36 })
		.notNull()
		.references(() => organization.id, { onDelete: 'cascade' }),
	userId: varchar('user_id', { length: 36 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	role: text('role').notNull(),
	createdAt: timestamp('created_at').notNull(),
});

export const invitation = mysqlTable('invitation', {
	id: varchar('id', { length: 36 }).primaryKey(),
	organizationId: varchar('organization_id', { length: 36 })
		.notNull()
		.references(() => organization.id, { onDelete: 'cascade' }),
	email: text('email').notNull(),
	role: text('role'),
	status: text('status').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	inviterId: varchar('inviter_id', { length: 36 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
});

export const apikey = mysqlTable('apikey', {
	id: varchar('id', { length: 36 }).primaryKey(),
	name: text('name'),
	start: text('start'),
	prefix: text('prefix'),
	key: text('key').notNull(),
	userId: varchar('user_id', { length: 36 })
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	refillInterval: int('refill_interval'),
	refillAmount: int('refill_amount'),
	lastRefillAt: timestamp('last_refill_at'),
	enabled: boolean('enabled'),
	rateLimitEnabled: boolean('rate_limit_enabled'),
	rateLimitTimeWindow: int('rate_limit_time_window'),
	rateLimitMax: int('rate_limit_max'),
	requestCount: int('request_count'),
	remaining: int('remaining'),
	lastRequest: timestamp('last_request'),
	expiresAt: timestamp('expires_at'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	permissions: text('permissions'),
	metadata: text('metadata'),
});
