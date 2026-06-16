import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Home, MoonStar, Settings, User } from "lucide-react"

import { CommandContext } from "./command-context"
import { CommandPalette } from "./command-palette"
import type { ReactNode } from "react"
import type { AppCommand, CommandRegistration } from "./types"

import ArchivePencil from "@/icons/archive-pencil"
import CalendarDays from "@/icons/calendar-days"
import HomeIcon from "@/icons/home"
import Interview from "@/icons/interview"
import Roadmap from "@/icons/roadmap"
import { authClient } from "@/lib/auth/auth-client"
import { toggleThemePreference } from "@/lib/theme"

export function CommandProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [registrations, setRegistrations] = useState<
    Array<CommandRegistration>
  >([])
  const navigate = useNavigate()
  const session = authClient.useSession()
  const orgParams = useParams({
    from: "/@{$org}",
    shouldThrow: false,
  })
  const projectParams = useParams({
    from: "/@{$org}/$project",
    shouldThrow: false,
  })

  const orgSlug = orgParams?.org
  const projectSlug = projectParams?.project
  const isAuthenticated = !!session.data?.user

  const registerCommands = useCallback(
    (scopeId: string, commands: Array<AppCommand>) => {
      setRegistrations((current) => [
        ...current.filter((registration) => registration.scopeId !== scopeId),
        { scopeId, commands },
      ])

      return () => {
        setRegistrations((current) =>
          current.filter((registration) => registration.scopeId !== scopeId)
        )
      }
    },
    []
  )

  const globalCommands = useMemo<Array<AppCommand>>(() => {
    const commands: Array<AppCommand> = [
      {
        group: "Global",
        icon: MoonStar,
        id: "theme.toggle",
        keywords: ["appearance", "dark", "light"],
        title: "Toggle light/dark mode",
        run: toggleThemePreference,
      },
    ]

    if (isAuthenticated) {
      commands.push(
        {
          group: "Global",
          icon: Home,
          id: "global.dashboard",
          keywords: ["home", "teams"],
          title: "Go to dashboard",
          run: () => navigate({ to: "/dashboard" }),
        },
        {
          group: "Global",
          icon: User,
          id: "global.profile-settings",
          keywords: ["account", "settings"],
          title: "Go to profile settings",
          run: () => navigate({ to: "/profile/settings" }),
        }
      )
    }

    if (orgSlug) {
      commands.push(
        {
          group: "Navigation",
          icon: Home,
          id: "org.home",
          keywords: ["organization", "team"],
          title: "Go to organization home",
          run: () => navigate({ params: { org: orgSlug }, to: "/@{$org}" }),
        },
        {
          group: "Navigation",
          icon: Settings,
          id: "org.settings",
          keywords: ["organization", "team", "settings"],
          title: "Go to organization settings",
          run: () =>
            navigate({ params: { org: orgSlug }, to: "/@{$org}/settings" }),
        }
      )
    }

    if (orgSlug && projectSlug) {
      const params = { org: orgSlug, project: projectSlug }

      commands.push(
        {
          group: "Navigation",
          icon: HomeIcon,
          id: "project.overview",
          keywords: ["project", "overview"],
          title: "Go to overview",
          run: () => navigate({ params, to: "/@{$org}/$project" }),
        },
        {
          group: "Navigation",
          icon: ArchivePencil,
          id: "project.feedback",
          keywords: ["project", "feedback"],
          title: "Go to feedback",
          run: () => navigate({ params, to: "/@{$org}/$project/feedback" }),
        },
        {
          group: "Navigation",
          icon: CalendarDays,
          id: "project.updates",
          keywords: ["project", "updates", "changelog"],
          title: "Go to updates",
          run: () => navigate({ params, to: "/@{$org}/$project/updates" }),
        },
        {
          group: "Navigation",
          icon: Roadmap,
          id: "project.roadmap",
          keywords: ["project", "roadmap"],
          title: "Go to roadmap",
          run: () => navigate({ params, to: "/@{$org}/$project/roadmap" }),
        },
        {
          group: "Navigation",
          icon: Interview,
          id: "project.discussions",
          keywords: ["project", "discussions"],
          title: "Go to discussions",
          run: () =>
            navigate({ params, to: "/@{$org}/$project/discussions" }),
        }
      )
    }

    return commands
  }, [isAuthenticated, navigate, orgSlug, projectSlug])

  const commands = useMemo(
    () => [
      ...globalCommands,
      ...registrations.flatMap((registration) =>
        registration.commands.map((command) => ({
          ...command,
          contextual: command.contextual ?? true,
        }))
      ),
    ],
    [globalCommands, registrations]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const runCommand = useCallback((command: AppCommand) => {
    setOpen(false)
    void command.run()
  }, [])

  const contextValue = useMemo(
    () => ({
      close: () => setOpen(false),
      open: () => setOpen(true),
      registerCommands,
    }),
    [registerCommands]
  )

  return (
    <CommandContext.Provider value={contextValue}>
      {children}
      <CommandPalette
        commands={commands}
        onOpenChange={setOpen}
        onRunCommand={runCommand}
        open={open}
      />
    </CommandContext.Provider>
  )
}
