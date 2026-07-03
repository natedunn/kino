export function isSuperAdminEmail(email: string) {
  const configured = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.SUPER_ADMIN_EMAIL
  return !!configured && configured.toLowerCase() === email.toLowerCase()
}
