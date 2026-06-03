import { describe, expect, it } from "vitest"

import { formatContentForDisplay } from "./format-content-for-display"

describe("formatContentForDisplay", () => {
  it("adds syntax highlighting classes to fenced code blocks", () => {
    const html =
      '<pre><code class="language-typescript">const value = &quot;ok&quot;</code></pre>'

    const formatted = formatContentForDisplay(html)

    expect(formatted).toContain('class="language-typescript hljs"')
    expect(formatted).toContain("hljs-keyword")
    expect(formatted).toContain("&quot;ok&quot;")
  })

  it("formats inline backticks as inline code", () => {
    const html = "<p>Use `pnpm build` here.</p>"

    expect(formatContentForDisplay(html)).toBe(
      "<p>Use <code>pnpm build</code> here.</p>"
    )
  })

  it("keeps inline code content escaped", () => {
    const html = "<p>Use `&lt;img src=x onerror=alert(1)&gt;` here.</p>"

    expect(formatContentForDisplay(html)).toBe(
      "<p>Use <code>&lt;img src=x onerror=alert(1)&gt;</code> here.</p>"
    )
  })

  it("leaves non-code content unchanged", () => {
    const html = "<p>Just text.</p>"

    expect(formatContentForDisplay(html)).toBe(html)
  })
})
