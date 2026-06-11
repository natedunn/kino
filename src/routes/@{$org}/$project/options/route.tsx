import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/@{$org}/$project/options")({
  component: ProjectOptionsRedirectShell,
})

function ProjectOptionsRedirectShell() {
  return <Outlet />
}
