import { useCallback, useMemo } from "react"
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router"

import { useRegisterCommands } from "@/components/command"
import { useRegisterShortcuts } from "@/components/shortcuts"
import CirclePlusOutline from "@/icons/circle-plus-outline"
import { projectTitle, titleMeta } from "@/lib/seo"

export const Route = createFileRoute("/@{$org}/$project/feedback")({
  head: ({ params }) => ({
    meta: [titleMeta(["Feedback", projectTitle(params.org, params.project)])],
  }),
  component: FeedbackRoute,
})

function FeedbackRoute() {
  const navigate = useNavigate()
  const params = Route.useParams()

  const goToNewFeedback = useCallback(
    () =>
      navigate({
        params,
        to: "/@{$org}/$project/feedback/new",
      }),
    [navigate, params]
  )

  const commands = useMemo(
    () => [
      {
        group: "Feedback" as const,
        icon: CirclePlusOutline,
        id: "feedback.add",
        keywords: ["create", "new", "request"],
        shortcut: "N",
        title: "Add feedback",
        run: goToNewFeedback,
      },
    ],
    [goToNewFeedback]
  )

  const shortcuts = useMemo(
    () => [
      {
        group: "Feedback" as const,
        id: "feedback.new",
        keys: ["n"],
        description: "New feedback",
        run: goToNewFeedback,
      },
    ],
    [goToNewFeedback]
  )

  useRegisterCommands("feedback", commands)
  useRegisterShortcuts("feedback", shortcuts)

  return <Outlet />
}
