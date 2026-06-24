import { useMemo, useState } from "react"

import type { AppCommand, CommandGroupName } from "./types"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"

const GROUP_ORDER: Array<CommandGroupName> = [
  "Global",
  "Navigation",
  "Feedback",
]

type CommandPaletteProps = {
  commands: Array<AppCommand>
  onOpenChange: (open: boolean) => void
  onRunCommand: (command: AppCommand) => void
  open: boolean
}

export function CommandPalette({
  commands,
  onOpenChange,
  onRunCommand,
  open,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const commandsByGroup = useMemo(() => {
    const grouped = new Map<CommandGroupName, Array<AppCommand>>()

    for (const command of commands) {
      if (command.disabled) continue

      const existing = grouped.get(command.group)
      if (existing) {
        existing.push(command)
      } else {
        grouped.set(command.group, [command])
      }
    }

    return grouped
  }, [commands])
  const groupOrder = useMemo(() => {
    const contextualGroups = GROUP_ORDER.filter((group) =>
      commandsByGroup.get(group)?.some((command) => command.contextual)
    )
    const remainingGroups = GROUP_ORDER.filter(
      (group) => !contextualGroups.includes(group)
    )

    return [...contextualGroups, ...remainingGroups]
  }, [commandsByGroup])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery("")
    }

    onOpenChange(nextOpen)
  }

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        onValueChange={setQuery}
        placeholder="Type a command or search..."
        value={query}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groupOrder.map((group) => {
          const groupCommands = commandsByGroup.get(group)

          if (!groupCommands || groupCommands.length === 0) return null

          return (
            <CommandGroup key={group} heading={group}>
              {groupCommands.map((command) => {
                const Icon = command.icon

                return (
                  <CommandItem
                    key={command.id}
                    keywords={command.keywords}
                    onSelect={() => onRunCommand(command)}
                    value={`${command.title} ${command.keywords?.join(" ") ?? ""}`}
                  >
                    {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                    <span>{command.title}</span>
                    {command.shortcut ? (
                      <CommandShortcut>{command.shortcut}</CommandShortcut>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}
