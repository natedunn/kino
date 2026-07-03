export function firstRecipient(to: unknown): string | undefined {
  if (typeof to === "string") return to
  if (Array.isArray(to) && typeof to[0] === "string") return to[0]
  return undefined
}
