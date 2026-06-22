import { useEffect, useRef } from "react"
import { createServerFn } from "@tanstack/react-start"
import { toast } from "sonner"

// Runs in the currently deployed server bundle, so it always returns the live
// build id — even when the client tab is running an older, cached bundle.
const getDeployedBuildId = createServerFn({ method: "GET" }).handler(
  () => __KINO_BUILD_ID__
)

const CHECK_THROTTLE_MS = 30 * 1000

// Detects when the running tab is serving a stale bundle (a newer version has
// been deployed) and prompts a reload. This is the durable fix for long-lived
// tabs that auto-deploys leave behind: their cached JS can run outdated logic or
// fail to load now-removed lazy chunks. Non-destructive — we prompt rather than
// force-reload so in-progress work isn't lost.
export function StaleBundleWatcher() {
  const promptedRef = useRef(false)
  const lastCheckRef = useRef(0)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    const clientBuildId = __KINO_BUILD_ID__

    const checkForUpdate = async () => {
      if (promptedRef.current) return
      if (document.visibilityState !== "visible") return

      const now = Date.now()
      if (now - lastCheckRef.current < CHECK_THROTTLE_MS) return
      lastCheckRef.current = now

      let deployedBuildId: string
      try {
        deployedBuildId = await getDeployedBuildId()
      } catch {
        return
      }

      if (!deployedBuildId || deployedBuildId === clientBuildId) return

      promptedRef.current = true
      toast("A new version of Kino is available", {
        description: "Reload to get the latest updates.",
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "Reload",
          onClick: () => window.location.reload(),
        },
      })
    }

    void checkForUpdate()

    const onVisible = () => {
      void checkForUpdate()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [])

  return null
}
