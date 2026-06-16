export type ThemePreference = "dark" | "light"

export function setThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined") return

  document.documentElement.classList.add("disable-transitions")

  if (theme === "dark") {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }

  try {
    localStorage.theme = theme
  } catch {
    // Accessing localStorage can throw (Safari private mode, blocked
    // storage). The class change above still applies for this session.
  }

  window.setTimeout(() => {
    document.documentElement.classList.remove("disable-transitions")
  }, 10)
}

export function getCurrentThemePreference(): ThemePreference {
  if (typeof document === "undefined") return "light"

  if (document.documentElement.classList.contains("dark")) {
    return "dark"
  }

  try {
    if (
      !("theme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark"
    }
  } catch {
    // localStorage may be inaccessible; fall back to system preference.
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark"
    }
  }

  return "light"
}

export function toggleThemePreference() {
  setThemePreference(getCurrentThemePreference() === "dark" ? "light" : "dark")
}
