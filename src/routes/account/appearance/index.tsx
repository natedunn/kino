import { useSyncExternalStore } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Check, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { titleMeta } from "@/lib/seo"
import {
  getCurrentThemePreference,
  getServerThemePreference,
  setThemePreference,
  subscribeThemePreference,
  type ThemePreference,
} from "@/lib/theme"

export const Route = createFileRoute("/account/appearance/")({
  head: () => ({
    meta: [titleMeta(["Appearance", "Account"])],
  }),
  component: AppearanceRoute,
})

const themeOptions: Array<{
  value: ThemePreference
  label: string
  description: string
  icon: typeof Sun
}> = [
  {
    value: "light",
    label: "Light",
    description: "Bright theme for well-lit spaces.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dimmed theme that's easier on the eyes.",
    icon: Moon,
  },
]

function AppearanceRoute() {
  // Read the active theme synchronously via the external store: avoids the
  // post-mount flash of the wrong active card while staying SSR-safe.
  const theme = useSyncExternalStore(
    subscribeThemePreference,
    getCurrentThemePreference,
    getServerThemePreference
  )

  const handleSelect = (value: ThemePreference) => {
    setThemePreference(value)
  }

  return (
    <section className="max-w-3xl">
      <header className="border-b pb-4">
        <h2 className="text-xl font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how Kino looks on this device.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {themeOptions.map((option) => {
          const Icon = option.icon
          const isActive = theme === option.value

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hocus:border-foreground/30",
                isActive && "border-foreground ring-1 ring-foreground"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="size-4" />
                  {option.label}
                </span>
                {isActive ? <Check className="size-4 text-foreground" /> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {option.description}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
