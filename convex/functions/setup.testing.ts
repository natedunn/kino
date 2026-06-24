import { convexTest as baseConvexTest } from "convex-test"
import type {
  MutationCtx as ServerMutationCtx,
  QueryCtx as ServerQueryCtx,
} from "../_generated/server"
import schema from "./schema"
import { withOrm } from "./generated/server"

// convex-test needs the set of function modules so it can run scheduled
// functions and procedure calls. Tests that only drive ctx.orm directly don't
// rely on these, but loading them keeps scheduler-backed paths working.
const modules = import.meta.glob("./**/!(*.test).ts")

export function convexTest(testSchema = schema) {
  return baseConvexTest(testSchema, modules)
}

/**
 * Attach the kitcn ORM context (orm + trigger/cascade-wrapped db) to a raw
 * convex-test ctx. Use inside `t.run(async (baseCtx) => { const ctx = await
 * runCtx(baseCtx) ... })` so that ctx.orm deletes fire FK cascades and triggers
 * exactly as they do in production cRPC mutations.
 */
export async function runCtx<
  Ctx extends ServerQueryCtx | ServerMutationCtx,
>(baseCtx: Ctx) {
  return withOrm(baseCtx)
}
