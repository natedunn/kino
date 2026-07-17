import type { ExportCtx, ExportSectionId } from './userDataExport.lib';

import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authQuery } from '../lib/crpc';
import { getCurrentProfileOrThrow } from '../lib/kino';
import {
	EXPORT_FORMAT,
	EXPORT_VERSION,
	exportSectionIds,
	exportSectionIdSchema,
	exportSections,
	MAX_EXPORT_BYTES,
	resolveRequestedSections,
} from './userDataExport.lib';

export const getAvailableSections = authQuery.input(z.object({})).query(async () =>
	exportSectionIds.map((sectionId) => {
		const section = exportSections[sectionId];
		return {
			id: section.id,
			label: section.label,
			description: section.description,
			includedByDefault: section.includedByDefault,
		};
	})
);

export const exportData = authQuery
	.input(
		z.object({
			sections: z.array(exportSectionIdSchema).optional(),
		})
	)
	.query(async ({ ctx, input }) => {
		const exportCtx = ctx as ExportCtx;
		const profile = await getCurrentProfileOrThrow(exportCtx, exportCtx.userId);
		const requestedSections = resolveRequestedSections(input.sections);
		const sections: Partial<Record<ExportSectionId, unknown>> = {};

		for (const sectionId of requestedSections) {
			sections[sectionId] = await exportSections[sectionId].build({
				ctx: exportCtx,
				profile,
			});
		}

		const exportDocument = {
			format: EXPORT_FORMAT,
			version: EXPORT_VERSION,
			generatedAt: new Date().toISOString(),
			account: {
				userId: exportCtx.userId,
				profileId: profile._id,
				username: profile.username,
				email: profile.email ?? exportCtx.user.email ?? null,
			},
			sections,
		};

		if (new TextEncoder().encode(JSON.stringify(exportDocument)).length > MAX_EXPORT_BYTES) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message:
					'Your export is too large for immediate download. Try again after async exports are available.',
			});
		}

		return exportDocument;
	});
