import { useEffect, useRef } from "react"
import { createServerFn } from "@tanstack/react-start"
import { toast } from "sonner"

// Runs in the currently deployed server bundle, so it always returns the live
// build id — even when the client tab is running an older, cached bundle.
// POST (not GET) so the response can never be edge/browser cached: a cached id
// would freeze at the old build and silently defeat stale detection.
const getDeployedBuildId = createServerFn({ method: "POST" }).handler(
  () => __KINO_BUILD_ID__
)

const CHECK_THROTTLE_MS = 30 * 1000

// Detects when the running tab is serving a stale bundle (a newer version has
// been deployed) and prompts a reload. This is the durable fix for long-lived
// tabs that auto-deploys leave behind: their cached JS can run outdated logic or
// fail to load now-removed lazy chunks. Non-destructive — we prompt rather than
// force-reload so in-progress work isn't lost.
export function StaleBundleWatcher() {
  // The build id we last prompted for (not a boolean) so an even-newer deploy
  // re-arms the toast even after the user dismissed a previous one.
  const lastPromptedIdRef = useRef<string | null>(null)
  const lastCheckRef = useRef(0)
  // Guards against concurrent probes when several wake events fire at once
  // (e.g. pageshow + visibilitychange + focus on a single tab reactivation).
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    const clientBuildId = __KINO_BUILD_ID__

    const checkForUpdate = async () => {
      if (document.visibilityState !== "visible") return
      if (inFlightRef.current) return

      const now = Date.now()
      if (now - lastCheckRef.current < CHECK_THROTTLE_MS) return

      inFlightRef.current = true
      let deployedBuildId: string | null = null
      try {
        deployedBuildId = await getDeployedBuildId()
      } catch {
        deployedBuildId = null
      } finally {
        inFlightRef.current = false
      }

      // Leave the throttle window untouched on a failed/empty probe so the next
      // wake retries instead of being silenced for the full interval.
      if (!deployedBuildId) return
      lastCheckRef.current = Date.now()

      if (deployedBuildId === clientBuildId) return
      if (deployedBuildId === lastPromptedIdRef.current) return

      lastPromptedIdRef.current = deployedBuildId
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

    const onWake = () => {
      void checkForUpdate()
    }

    document.addEventListener("visibilitychange", onWake)
    window.addEventListener("focus", onWake)
    // bfcache restore (iOS Safari / Android Chrome) may fire only pageshow,
    // not focus/visibilitychange — exactly the "wake after hours" case.
    window.addEventListener("pageshow", onWake)

    return () => {
      document.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("focus", onWake)
      window.removeEventListener("pageshow", onWake)
    }
  }, [])

  return null
}
