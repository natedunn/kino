import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

/**
 * Security regression guard for privilege escalation via better-auth
 * `additionalFields`.
 *
 * `role` and `profileId` are declared as `user.additionalFields` in auth.ts.
 * Better-auth additional fields are CLIENT-WRITABLE by default: unless a field
 * sets `input: false`, its value is accepted straight from the request body of
 * the public `/api/auth/sign-up/email` and `/api/auth/update-user` routes
 * (better-auth's `parseInputData` only rejects a field when `input === false`).
 *
 * Without `input: false`, any user could POST `{ "role": "system:admin" }` and
 * escalate to a system admin (which short-circuits verifyOrgAccess /
 * verifyProjectAccess to all-permissions). Both fields are set exclusively
 * server-side (the user.create.before / user.change triggers and
 * ensureUserBootstrap), so `input: false` must always be present.
 *
 * This is a source-level assertion because the escalation lives in better-auth's
 * HTTP route parsing, which the convex-test harness (mocked identity via
 * `t.withIdentity`) does not exercise.
 */
describe("auth additionalFields lock down client-writable role/profileId", () => {
  const authSource = readFileSync(
    fileURLToPath(new URL("./auth.ts", import.meta.url)),
    "utf8"
  )

  // Grab the object body for a given additionalField key, up to its closing
  // brace, so we can assert `input: false` belongs to THAT field.
  function fieldBody(field: string) {
    const match = authSource.match(
      new RegExp(`${field}:\\s*\\{([\\s\\S]*?)\\}`, "m")
    )
    expect(match, `${field} additionalField declaration not found`).toBeTruthy()
    return match![1]
  }

  test.each(["role", "profileId"])(
    "%s additionalField sets input: false",
    (field) => {
      expect(fieldBody(field)).toMatch(/input:\s*false/)
    }
  )
})
