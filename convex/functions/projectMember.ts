import { z } from 'zod';
import { authQuery } from '../lib/crpc';
import { asId } from '../lib/kino';
import { resolveProfileImageUrl } from '../lib/storage';

const EDIT_ROLES = new Set(['admin', 'editor', 'org:admin', 'org:editor']);

export const listAssignableMembers = authQuery
  .input(
    z.object({
      projectId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const projectMembers = await ctx.orm.query.projectMember.findMany({
      where: { projectId: asId<'project'>(input.projectId) },
      with: { profile: true },
      limit: 200,
    });

    const membersWithProfiles = await Promise.all(
      projectMembers.map(async (member: any) => ({
        profile: member.profile ?? null,
        profileId: member.profileId,
        role: member.role,
      }))
    );

    const rows = await Promise.all(
      membersWithProfiles
        .filter((member) => EDIT_ROLES.has(member.role))
        .map(async (member) => ({
          profile: member.profile
            ? {
                id: member.profile._id,
                imageUrl: await resolveProfileImageUrl(member.profile),
                name: member.profile.name ?? null,
                username: member.profile.username,
              }
            : null,
          profileId: member.profileId,
          role: member.role,
        }))
    );

    return rows.filter((member) => member.profile !== null);
  });
