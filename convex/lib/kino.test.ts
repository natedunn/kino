import { describe, expect, it } from "vitest";

import { pickPersonalOrganizationId } from "./kino";

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
