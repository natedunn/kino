// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendEmail } from "../lib/bento"

const CREDS: Record<string, string> = {
  BENTO_PUBLISHABLE_KEY: "pub_test",
  BENTO_SECRET_KEY: "sec_test",
  BENTO_SITE_UUID: "site_test",
  BENTO_FROM: "Kino <noreply@mail.usekino.com>",
}

describe("sendEmail (Bento)", () => {
  const original: Record<string, string | undefined> = {}
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    for (const [key, value] of Object.entries(CREDS)) {
      original[key] = process.env[key]
      process.env[key] = value
    }
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ results: 1 }), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    for (const key of Object.keys(CREDS)) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
    vi.unstubAllGlobals()
  })

  it("maps args to the Bento batch payload", async () => {
    const count = await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
    })

    expect(count).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("site_uuid=site_test")
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${btoa("pub_test:sec_test")}`
    )

    const body = JSON.parse(init.body as string)
    expect(body.emails).toEqual([
      {
        to: "user@example.com",
        from: "Kino <noreply@mail.usekino.com>",
        subject: "Hi",
        html_body: "<p>Hi</p>",
        transactional: true,
      },
    ])
  })

  it("fans out an array of recipients to one entry each", async () => {
    await sendEmail({
      to: ["a@example.com", "b@example.com"],
      subject: "S",
      html: "<p>S</p>",
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(init.body as string)
    expect(body.emails).toHaveLength(2)
    expect(body.emails.map((e: { to: string }) => e.to)).toEqual([
      "a@example.com",
      "b@example.com",
    ])
  })

  it("throws naming the missing credential", async () => {
    delete process.env.BENTO_SECRET_KEY
    await expect(
      sendEmail({ to: "user@example.com", subject: "Hi", html: "<p>Hi</p>" })
    ).rejects.toThrow(/BENTO_SECRET_KEY/)
  })

  it("throws when Bento returns a non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 422 }))
    await expect(
      sendEmail({ to: "user@example.com", subject: "Hi", html: "<p>Hi</p>" })
    ).rejects.toThrow(/422/)
  })
})
