import { describe, expect, it } from "vitest"

import {
  RESERVED_HANDLES as CLIENT_RESERVED_HANDLES,
  SLUG_PATTERN as CLIENT_SLUG_PATTERN,
} from "../../src/lib/validation"
import {
  RESERVED_HANDLES as SERVER_RESERVED_HANDLES,
  SLUG_PATTERN as SERVER_SLUG_PATTERN,
} from "./validation"

// The client (`src/lib/validation.ts`) and server (`convex/lib/validation.ts`)
// each keep their own copy of these constants because they live in separate
// build contexts. This test fails the moment they drift, so a reserved word or
// slug-rule change made in one copy can't silently desync the other.
describe("client/server validation parity", () => {
  it("keeps the reserved-handle lists identical", () => {
    expect([...CLIENT_RESERVED_HANDLES]).toEqual([...SERVER_RESERVED_HANDLES])
  })

  it("keeps the slug pattern identical", () => {
    expect(CLIENT_SLUG_PATTERN.source).toBe(SERVER_SLUG_PATTERN.source)
    expect(CLIENT_SLUG_PATTERN.flags).toBe(SERVER_SLUG_PATTERN.flags)
  })
})
