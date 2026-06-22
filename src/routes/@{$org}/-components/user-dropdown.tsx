import { useNavigate, useParams } from "@tanstack/react-router"
import { ChevronDown, Settings, User } from "lucide-react"
import type { API } from "@/lib/api"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth/auth-client"

export function UserDropdown({
  user,
}: {
  user: NonNullable<API["profile"]["findMyProfile"]>
}) {
  const navigate = useNavigate()
  const orgParams = useParams({
    from: "/@{$org}",
    shouldThrow: false,
  })
  const orgSlug = orgParams?.org

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <Avatar className="size-6 border">
            <AvatarImage src={user.imageUrl} />
            <AvatarFallback>
              <User className="size-4" />
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {user.username}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            navigate({
              params: { username: user.username },
              to: "/u/$username",
            })
          }}
        >
          Your profile
        </DropdownMenuItem>
        <DropdownMenuItem>Your organizations</DropdownMenuItem>
        <DropdownMenuItem>Your projects</DropdownMenuItem>
        <DropdownMenuSeparator />
        {!!orgSlug && (
          <DropdownMenuItem
            onClick={() => {
              navigate({
                params: { org: orgSlug },
                to: "/@{$org}/settings",
              })
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            Org settings
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            navigate({
              to: "/account/profile",
            })
          }}
        >
          Account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            authClient.signOut()
            navigate({
              to: "/auth",
            })
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
