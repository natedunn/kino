const INLINE_CODE_REGEX = /(^|[^`])`([^`\n]+)`(?!`)/g

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, token) => {
    if (token[0] === "#") {
      const isHex = token[1]?.toLowerCase() === "x"
      const codePoint = Number.parseInt(
        token.slice(isHex ? 2 : 1),
        isHex ? 16 : 10
      )

      if (Number.isNaN(codePoint)) {
        return entity
      }

      return String.fromCodePoint(codePoint)
    }

    switch (token) {
      case "amp":
        return "&"
      case "apos":
      case "nbsp":
        return token === "nbsp" ? " " : "'"
      case "gt":
        return ">"
      case "lt":
        return "<"
      case "quot":
        return '"'
      default:
        return entity
    }
  })
}

export function formatInlineCode(html: string) {
  let insideCode = false
  let insidePre = false

  return html
    .split(/(<\/?[^>]+>)/g)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<pre\b/i.test(part)) insidePre = true
        if (/^<\/pre/i.test(part)) insidePre = false
        if (/^<code\b/i.test(part)) insideCode = true
        if (/^<\/code/i.test(part)) insideCode = false
        return part
      }

      if (insideCode || insidePre) {
        return part
      }

      return part.replace(
        INLINE_CODE_REGEX,
        (_match, prefix: string, code: string) =>
          `${prefix}<code>${escapeHtml(decodeHtmlEntities(code))}</code>`
      )
    })
    .join("")
}
