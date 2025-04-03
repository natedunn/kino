export const immutableColumns = {
	createdAt: true,
	updatedAt: true,
} as const;

export const inaccessibleColumns = {
	autoId: true,
} as const;
