import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/options")({
  component: OrganizationOptionsRedirectShell,
})

function OrganizationOptionsRedirectShell() {
  return <Outlet />
}
