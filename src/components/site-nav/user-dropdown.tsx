import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Building2,
  ChevronDown,
  FolderKanban,
  Keyboard,
  LogOut,
  Settings,
  User,
} from "lucide-react"
import { NavButton } from "./nav-button"
import type { ComponentType } from "react"
import type { API } from "@/lib/api"

import { useShortcuts } from "@/components/shortcuts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSignOutMutationOptions } from "@/lib/auth/auth-client"
import { beginSignOut, endSignOut } from "@/lib/auth/sign-out-state"
import { trackAuthError, trackAuthSuccess } from "@/lib/auth-analytics"

export function UserDropdown({
  orgSlug,
  user,
}: {
  orgSlug?: string
  user: NonNullable<API["profile"]["findMyProfile"]>
}) {
  const navigate = useNavigate()
  const shortcuts = useShortcuts()
  const signOut = useMutation(useSignOutMutationOptions())

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <NavButton className="h-8 w-8 rounded-full px-0 min-[460px]:w-auto min-[460px]:min-w-28 min-[460px]:rounded-md min-[460px]:px-2.5">
          <Avatar className="size-6 border">
            <AvatarImage src={user.imageUrl} />
            <AvatarFallback>
              <User className="size-4" />
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {user.username}
          </span>
          <ChevronDown className="hidden h-3 w-3 min-[460px]:block" />
        </NavButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <UserDropdownItem
          icon={User}
          onClick={() => {
            navigate({
              params: { username: user.username },
              to: "/u/$username",
            })
          }}
        >
          Your profile
        </UserDropdownItem>
        <UserDropdownItem disabled icon={Building2}>
          Your organizations
        </UserDropdownItem>
        <UserDropdownItem disabled icon={FolderKanban}>
          Your projects
        </UserDropdownItem>
        <DropdownMenuSeparator />
        {!!orgSlug && (
          <UserDropdownItem
            icon={Settings}
            onClick={() => {
              navigate({
                search: { org: orgSlug },
                to: "/org/settings",
              })
            }}
          >
            Org settings
          </UserDropdownItem>
        )}
        <UserDropdownItem
          icon={Settings}
          onClick={() => {
            navigate({
              to: "/account/profile",
            })
          }}
        >
          Account
        </UserDropdownItem>
        <DropdownMenuSeparator />
        <UserDropdownItem icon={Keyboard} onClick={() => shortcuts.open()}>
          Keyboard shortcuts
        </UserDropdownItem>
        <DropdownMenuSeparator />
        <UserDropdownItem
          disabled={signOut.isPending}
          icon={LogOut}
          onClick={() => {
            // Mark sign-out in progress so /auth doesn't bounce us back into the
            // app on the transient "still looks authenticated" state while the
            // sign-out network round-trip settles (~1–3s). Cleared once auth
            // genuinely settles (in /auth's redirect effect) or on error below.
            beginSignOut()
            // The authed route guards redirect to /auth the instant `signOut`
            // flips client auth state to `false` (synchronously, before the
            // network round-trip), so we don't depend on this `onSuccess` to
            // leave the page — it's a fallback for any view not behind an
            // auth-loss guard.
            signOut.mutate(undefined, {
              onSuccess: () => {
                trackAuthSuccess("sign_out")
                navigate({
                  to: "/auth",
                })
              },
              onError: (error) => {
                endSignOut()
                trackAuthError("sign_out", error)
              },
            })
          }}
        >
          {signOut.isPending ? "Signing out..." : "Sign out"}
        </UserDropdownItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserDropdownItem({
  children,
  disabled,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  icon: ComponentType<{ className?: string }>
  onClick?: () => void
}) {
  return (
    <DropdownMenuItem className="gap-2" disabled={disabled} onClick={onClick}>
      <Icon className="size-4 text-muted-foreground/65" />
      <span>{children}</span>
    </DropdownMenuItem>
  )
}
