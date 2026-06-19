const APP_TITLE = "Kino"

type TitlePart = string | null | undefined | false

export function titleFromSlug(value: TitlePart) {
  if (!value) {
    return undefined
  }

  const decoded = decodeURIComponent(value)
  const cleaned = decoded
    .replace(/^@/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase()

  return cleaned || undefined
}

export function projectTitle(org: TitlePart, project: TitlePart) {
  const orgTitle = titleFromSlug(org)
  const projectName = titleFromSlug(project)

  if (!orgTitle || !projectName) {
    return projectName ?? orgTitle
  }

  return `${orgTitle}/${projectName}`
}

export function appTitle(parts: TitlePart[] = []) {
  const titleParts = parts.filter(Boolean)

  return titleParts.join(" • ") || APP_TITLE
}

export function titleMeta(parts: TitlePart[] = []) {
  return {
    title: appTitle(parts),
  }
}
