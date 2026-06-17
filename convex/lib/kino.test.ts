import { describe, expect, it } from "vitest";

import { pickPersonalOrganizationId, verifyProjectAccess } from "./kino";

describe("pickPersonalOrganizationId", () => {
  it("prefers an admin membership whose slug matches the username", () => {
    expect(
      pickPersonalOrganizationId({
        memberships: [
          { organizationId: "org_team", role: "admin", slug: "acme" },
          { organizationId: "org_personal", role: "admin", slug: "nate" },
        ],
        profileUsername: "nate",
      })
    ).toBe("org_personal");
  });

  it("falls back to the only admin-owned organization when there is no slug match", () => {
    expect(
      pickPersonalOrganizationId({
        memberships: [
          { organizationId: "org_personal", role: "admin", slug: "old-handle" },
          { organizationId: "org_team", role: "member", slug: "acme" },
        ],
        profileUsername: "nate",
      })
    ).toBe("org_personal");
  });

  it("does not infer a personal workspace from non-admin memberships", () => {
    expect(
      pickPersonalOrganizationId({
        memberships: [
          { organizationId: "org_team", role: "member", slug: "acme" },
        ],
        profileUsername: "nate",
      })
    ).toBeNull();
  });
});

describe("verifyProjectAccess", () => {
  it("treats direct project editors as project editors", async () => {
    const ctx = {
      orm: {
        query: {
          project: {
            findMany: async () => [
              {
                id: "project_1",
                slug: "feedback",
                visibility: "public",
              },
            ],
          },
          profile: {
            findMany: async () => [
              {
                id: "profile_1",
                role: "user",
                userId: "user_1",
              },
            ],
          },
          projectMember: {
            findMany: async () => [
              {
                id: "member_1",
                profileId: "profile_1",
                projectId: "project_1",
                role: "editor",
              },
            ],
          },
        },
      },
    };

    const access = await verifyProjectAccess(ctx as any, {
      id: "project_1",
      userId: "user_1",
    });

    expect(access.permissions.canEdit).toBe(true);
    expect(access.permissions.canView).toBe(true);
  });
});
