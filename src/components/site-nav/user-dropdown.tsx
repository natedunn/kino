import { useNavigate } from "@tanstack/react-router"
import {
  Building2,
  ChevronDown,
  FolderKanban,
  LogOut,
  Settings,
  User,
} from "lucide-react"
import type { ComponentType } from "react"
import type { API } from "@/lib/api"

import { NavButton } from "./nav-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth/auth-client"

export function UserDropdown({
  orgSlug,
  user,
}: {
  orgSlug?: string
  user: NonNullable<API["profile"]["findMyProfile"]>
}) {
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <NavButton
          className="h-8 w-8 rounded-full px-0 min-[460px]:w-auto min-[460px]:rounded-md min-[460px]:px-2.5"
        >
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
        <UserDropdownItem icon={Building2}>Your organizations</UserDropdownItem>
        <UserDropdownItem icon={FolderKanban}>Your projects</UserDropdownItem>
        <DropdownMenuSeparator />
        {!!orgSlug && (
          <UserDropdownItem
            icon={Settings}
            onClick={() => {
              navigate({
                params: { org: orgSlug },
                to: "/@{$org}/settings",
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
        <UserDropdownItem
          icon={LogOut}
          onClick={() => {
            authClient.signOut()
            navigate({
              to: "/auth",
            })
          }}
        >
          Sign out
        </UserDropdownItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserDropdownItem({
  children,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode
  icon: ComponentType<{ className?: string }>
  onClick?: () => void
}) {
  return (
    <DropdownMenuItem className="gap-2" onClick={onClick}>
      <Icon className="size-4 text-muted-foreground/65" />
      <span>{children}</span>
    </DropdownMenuItem>
  )
}
