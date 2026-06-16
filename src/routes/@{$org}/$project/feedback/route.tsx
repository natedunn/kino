import { useMemo } from "react"
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router"

import { useRegisterCommands } from "@/components/command"
import CirclePlusOutline from "@/icons/circle-plus-outline"

export const Route = createFileRoute("/@{$org}/$project/feedback")({
  component: FeedbackRoute,
})

function FeedbackRoute() {
  const navigate = useNavigate()
  const params = Route.useParams()
  const commands = useMemo(
    () => [
      {
        group: "Feedback" as const,
        icon: CirclePlusOutline,
        id: "feedback.add",
        keywords: ["create", "new", "request"],
        title: "Add feedback",
        run: () =>
          navigate({
            params,
            to: "/@{$org}/$project/feedback/new",
          }),
      },
    ],
    [navigate, params]
  )

  useRegisterCommands("feedback", commands)

  return <Outlet />
}
