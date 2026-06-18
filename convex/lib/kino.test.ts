import { describe, expect, it } from "vitest";

import {
  getProjectViewAccess,
  pickPersonalOrganizationId,
  reconcileSystemRole,
  sanitizeSystemRole,
  verifyProjectAccess,
} from "./kino";

function makeAccessCtx(opts: {
  project?: { id: string; slug: string; visibility: string } | null;
  profile?: { id: string; role: string; userId: string } | null;
  projectMember?: { id: string; role: string } | null;
}) {
  return {
    orm: {
      query: {
        project: {
          findMany: async () => (opts.project ? [opts.project] : []),
        },
        profile: {
          findMany: async () => (opts.profile ? [opts.profile] : []),
        },
        projectMember: {
          findMany: async () =>
            opts.projectMember
              ? [{ ...opts.projectMember, projectId: opts.project?.id }]
              : [],
        },
      },
    },
  } as any;
}

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
  it("treats org:editor members as project editors (but not deleters)", async () => {
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
                role: "org:editor",
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
    expect(access.permissions.canDelete).toBe(false);
  });

  it("lets anyone view a public project but not edit it", async () => {
    const ctx = makeAccessCtx({
      project: { id: "p1", slug: "s", visibility: "public" },
    });
    const access = await verifyProjectAccess(ctx, { id: "p1" });
    expect(access.permissions.canView).toBe(true);
    expect(access.permissions.canEdit).toBe(false);
    expect(access.permissions.canDelete).toBe(false);
  });

  it("hides a private project from non-members", async () => {
    const ctx = makeAccessCtx({
      project: { id: "p1", slug: "s", visibility: "private" },
      profile: { id: "profile_1", role: "user", userId: "user_1" },
      projectMember: null,
    });
    const access = await verifyProjectAccess(ctx, {
      id: "p1",
      userId: "user_1",
    });
    expect(access.permissions.canView).toBe(false);
    expect(access.project).toBeNull();
  });

  it("lets a private-project member view but not edit", async () => {
    const ctx = makeAccessCtx({
      project: { id: "p1", slug: "s", visibility: "private" },
      profile: { id: "profile_1", role: "user", userId: "user_1" },
      projectMember: { id: "m1", role: "member" },
    });
    const access = await verifyProjectAccess(ctx, {
      id: "p1",
      userId: "user_1",
    });
    expect(access.permissions.canView).toBe(true);
    expect(access.permissions.canEdit).toBe(false);
  });

  it("grants system admins full access to a private project", async () => {
    const ctx = makeAccessCtx({
      project: { id: "p1", slug: "s", visibility: "private" },
      profile: { id: "profile_1", role: "system:admin", userId: "user_1" },
      projectMember: null,
    });
    const access = await verifyProjectAccess(ctx, {
      id: "p1",
      userId: "user_1",
    });
    expect(access.permissions.canView).toBe(true);
    expect(access.permissions.canEdit).toBe(true);
    expect(access.permissions.canDelete).toBe(true);
  });

  it("only org:admin can delete; archived projects are view-only", async () => {
    const ctx = makeAccessCtx({
      project: { id: "p1", slug: "s", visibility: "archived" },
      profile: { id: "profile_1", role: "user", userId: "user_1" },
      projectMember: { id: "m1", role: "org:admin" },
    });
    const access = await verifyProjectAccess(ctx, {
      id: "p1",
      userId: "user_1",
    });
    expect(access.permissions.canView).toBe(true);
    expect(access.permissions.canEdit).toBe(false);
    expect(access.permissions.canDelete).toBe(true);
  });
});

describe("sanitizeSystemRole", () => {
  it("passes through the three valid system roles", () => {
    expect(sanitizeSystemRole("system:admin")).toBe("system:admin");
    expect(sanitizeSystemRole("system:editor")).toBe("system:editor");
    expect(sanitizeSystemRole("user")).toBe("user");
  });

  it("collapses unknown/empty roles to 'user'", () => {
    expect(sanitizeSystemRole("admin")).toBe("user");
    expect(sanitizeSystemRole("owner")).toBe("user");
    expect(sanitizeSystemRole(null)).toBe("user");
    expect(sanitizeSystemRole(undefined)).toBe("user");
  });
});

describe("reconcileSystemRole", () => {
  function makeReconcileCtx(
    profile: { id: string; role: string; userId: string } | null
  ) {
    const patches: Array<{ id: string; data: Record<string, unknown> }> = [];
    const ctx = {
      orm: { query: { profile: { findFirst: async () => profile } } },
      db: {
        patch: async (id: string, data: Record<string, unknown>) => {
          patches.push({ id, data });
        },
      },
    } as any;
    return { ctx, patches };
  }

  it("patches profile.role to match user.role when drifted", async () => {
    const { ctx, patches } = makeReconcileCtx({
      id: "p1",
      role: "user",
      userId: "u1",
    });
    const result = await reconcileSystemRole(ctx, {
      id: "u1",
      role: "system:admin",
    });
    expect(result).toBe("system:admin");
    expect(patches).toEqual([{ id: "p1", data: { role: "system:admin" } }]);
  });

  it("is a no-op when profile.role already matches", async () => {
    const { ctx, patches } = makeReconcileCtx({
      id: "p1",
      role: "system:admin",
      userId: "u1",
    });
    await reconcileSystemRole(ctx, { id: "u1", role: "system:admin" });
    expect(patches).toEqual([]);
  });

  it("returns null when there is no profile yet", async () => {
    const { ctx } = makeReconcileCtx(null);
    expect(await reconcileSystemRole(ctx, { id: "u1", role: "user" })).toBeNull();
  });
});

describe("getProjectViewAccess", () => {
  it("fails closed (canView=false) when the project does not exist", async () => {
    const ctx = makeAccessCtx({ project: null });
    const access = await getProjectViewAccess(ctx, { id: "missing" });
    expect(access.permissions.canView).toBe(false);
    expect(access.project).toBeNull();
  });

  it("delegates to project visibility for an anonymous viewer", async () => {
    const ctx = makeAccessCtx({
      project: { id: "p1", slug: "s", visibility: "public" },
    });
    const access = await getProjectViewAccess(ctx, { id: "p1" });
    expect(access.permissions.canView).toBe(true);
  });

  it("denies an anonymous viewer access to a private project", async () => {
    const ctx = makeAccessCtx({
      project: { id: "p1", slug: "s", visibility: "private" },
    });
    const access = await getProjectViewAccess(ctx, { id: "p1" });
    expect(access.permissions.canView).toBe(false);
  });
});
