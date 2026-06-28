// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { internal } from "./_generated/api"
import { verifyNuntlyWebhook } from "../lib/nuntly"
import { convexTest, runCtx } from "./setup.testing"

function makeEvent(overrides: Partial<{ eventId: string }> = {}) {
  return {
    eventId: overrides.eventId ?? "evt_test_1",
    type: "email.delivered",
    emailId: "em_abc",
    recipient: "user@example.com",
    occurredAt: 1_700_000_000_000,
    payload: { id: overrides.eventId ?? "evt_test_1", type: "email.delivered" },
  }
}

describe("recordWebhookEvent", () => {
  it("inserts a new event", async () => {
    const t = convexTest()
    const result = await t.mutation(
      internal.email.recordWebhookEvent,
      makeEvent()
    )
    expect(result).toEqual({ duplicate: false })

    const rows = await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      return ctx.db.query("emailEvent").collect()
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      eventId: "evt_test_1",
      type: "email.delivered",
      emailId: "em_abc",
      recipient: "user@example.com",
    })
  })

  it("dedupes a repeated event id (Nuntly retries non-200s)", async () => {
    const t = convexTest()
    const first = await t.mutation(
      internal.email.recordWebhookEvent,
      makeEvent()
    )
    const second = await t.mutation(
      internal.email.recordWebhookEvent,
      makeEvent()
    )
    expect(first).toEqual({ duplicate: false })
    expect(second).toEqual({ duplicate: true })

    const rows = await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      return ctx.db.query("emailEvent").collect()
    })
    expect(rows).toHaveLength(1)
  })

  it("stores distinct event ids separately", async () => {
    const t = convexTest()
    await t.mutation(
      internal.email.recordWebhookEvent,
      makeEvent({ eventId: "evt_a" })
    )
    await t.mutation(
      internal.email.recordWebhookEvent,
      makeEvent({ eventId: "evt_b" })
    )

    const rows = await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      return ctx.db.query("emailEvent").collect()
    })
    expect(rows).toHaveLength(2)
  })
})

describe("verifyNuntlyWebhook", () => {
  const original = process.env.NUNTLY_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.NUNTLY_WEBHOOK_SECRET = "whsec_dGVzdHNlY3JldA"
  })
  afterEach(() => {
    if (original === undefined) delete process.env.NUNTLY_WEBHOOK_SECRET
    else process.env.NUNTLY_WEBHOOK_SECRET = original
  })

  it("rejects a missing signature header", async () => {
    await expect(verifyNuntlyWebhook("{}", null)).rejects.toThrow()
  })

  it("rejects a malformed/invalid signature", async () => {
    await expect(
      verifyNuntlyWebhook('{"id":"evt_x"}', "t=123,v0=deadbeef")
    ).rejects.toThrow()
  })

  it("throws when the secret is not configured", async () => {
    delete process.env.NUNTLY_WEBHOOK_SECRET
    await expect(
      verifyNuntlyWebhook("{}", "t=123,v0=deadbeef")
    ).rejects.toThrow(/NUNTLY_WEBHOOK_SECRET/)
  })
})
