const ISSUER_BY_PROVIDER_ID = {
	credential: 'local:credential',
	github: 'local:oauth:github',
};

export function backfillAccountIssuerLine(line) {
	const account = JSON.parse(line);
	const issuer = ISSUER_BY_PROVIDER_ID[account.providerId];
	if (!issuer) {
		throw new Error(`[seed] map issuer for Better Auth provider ${account.providerId}`);
	}
	if (account.providerId === 'credential' && account.accountId !== account.userId) {
		throw new Error(`[seed] credential account ${account._id} does not use its linked user ID`);
	}
	if (account.issuer !== undefined) {
		if (account.issuer !== issuer) {
			throw new Error(`[seed] issuer mismatch for Better Auth account ${account._id}`);
		}
		return line;
	}

	// Preserve the raw export rather than JSON.stringify-ing it: Convex encodes
	// float64 values such as 0.0 distinctly, and a parse/stringify round trip
	// would turn them into integers that fail schema validation on import.
	const closingBrace = line.lastIndexOf('}');
	if (closingBrace < 0) throw new Error('[seed] expected an account JSON object');
	const separator = line.slice(0, closingBrace).trimEnd().endsWith('{') ? '' : ',';
	return `${line.slice(0, closingBrace)}${separator}"issuer":${JSON.stringify(issuer)}${line.slice(closingBrace)}`;
}

export function backfillAccountIssuerContents(contents) {
	return contents
		.split(/\r?\n/)
		.filter(Boolean)
		.map(backfillAccountIssuerLine)
		.join('\n')
		.concat(contents.trim() ? '\n' : '');
}
