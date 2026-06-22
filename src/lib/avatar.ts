// Shared client-side avatar validation, kept in sync with the server-side
// allowlist in convex/lib/storage.ts. Used by the account profile and org
// settings avatar uploaders so both enforce the same limits before uploading.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]

// Detect animated WebP without decoding the whole file: a still WebP either has
// no VP8X chunk, or a VP8X chunk whose animation flag (bit 1) is unset and no
// ANIM chunk present.
export async function isAnimatedWebp(file: File): Promise<boolean> {
  const buffer = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const matchesAscii = (offset: number, text: string) =>
    text.split("").every((char, i) => buffer[offset + i] === char.charCodeAt(0))

  if (!matchesAscii(0, "RIFF") || !matchesAscii(8, "WEBP")) return false
  if (matchesAscii(12, "VP8X") && ((buffer[20] ?? 0) & 0x02) !== 0) return true
  for (let i = 12; i < buffer.length - 4; i++) {
    if (matchesAscii(i, "ANIM")) return true
  }
  return false
}

// Returns a user-facing error message, or null when the file is acceptable.
export async function validateAvatarFile(file: File): Promise<string | null> {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return "Avatar must be a JPEG, PNG, or WebP image."
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Avatar must be 5 MB or smaller."
  }
  if (file.type === "image/webp" && (await isAnimatedWebp(file))) {
    return "Animated images are not supported. Please upload a static image."
  }
  return null
}
