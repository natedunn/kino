import { useEffect, useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"

import { useCRPC } from "@/lib/convex/crpc"

type UseEmoteToggleOptions = {
  updateId: string
  serverIsLiked: boolean
  serverLikeCount: number
  /** Whether the current viewer is allowed to react (i.e. is signed in). */
  canInteract: boolean
}

/**
 * Optimistic "heart" toggle for an update, shared by the updates list card and
 * the update detail page.
 *
 * The optimistic value only "wins" while it disagrees with the server. Once the
 * Convex subscription pushes a matching value, the derived display falls back to
 * the server value automatically — so there is no reconcile `useEffect` syncing
 * server data into local state. A trailing 300ms debounce coalesces rapid
 * like/unlike clicks into a single mutation (or none, if it nets out).
 */
export function useEmoteToggle({
  updateId,
  serverIsLiked,
  serverLikeCount,
  canInteract,
}: UseEmoteToggleOptions) {
  const crpc = useCRPC()
  const toggleEmote = useMutation(crpc.updateEmote.toggle.mutationOptions())
  const latestServerIsLikedRef = useRef(serverIsLiked)
  useEffect(() => {
    latestServerIsLikedRef.current = serverIsLiked
  }, [serverIsLiked])
  const latestCanInteractRef = useRef(canInteract)
  useEffect(() => {
    latestCanInteractRef.current = canInteract
  }, [canInteract])

  const [optimistic, setOptimistic] = useState<{
    liked: boolean
    count: number
  } | null>(null)

  const showOptimistic =
    optimistic !== null && optimistic.liked !== serverIsLiked
  const isLiked = showOptimistic ? optimistic.liked : serverIsLiked
  const likeCount = showOptimistic ? optimistic.count : serverLikeCount

  const [isAnimating, setIsAnimating] = useState(false)
  const prevLikedRef = useRef(isLiked)
  useEffect(() => {
    if (isLiked && !prevLikedRef.current) {
      prevLikedRef.current = isLiked
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 600)
      return () => clearTimeout(timer)
    }
    prevLikedRef.current = isLiked
  }, [isLiked])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStateRef = useRef<boolean | null>(null)
  const previousUpdateIdRef = useRef(updateId)
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )
  useEffect(() => {
    if (previousUpdateIdRef.current === updateId) return

    previousUpdateIdRef.current = updateId
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = null
    pendingStateRef.current = null
    prevLikedRef.current = serverIsLiked
    setIsAnimating(false)
    setOptimistic(null)
  }, [serverIsLiked, updateId])
  useEffect(() => {
    if (canInteract) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = null
    pendingStateRef.current = null
    setOptimistic(null)
  }, [canInteract])

  function toggle() {
    if (!canInteract) return

    const newIsLiked = !isLiked
    const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1)
    setOptimistic({ liked: newIsLiked, count: newCount })
    pendingStateRef.current = newIsLiked

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!latestCanInteractRef.current) {
        setOptimistic(null)
        pendingStateRef.current = null
        return
      }

      if (pendingStateRef.current !== latestServerIsLikedRef.current) {
        toggleEmote.mutate({ content: "heart", updateId })
      } else {
        setOptimistic(null)
      }
      pendingStateRef.current = null
    }, 300)
  }

  return { isLiked, likeCount, isAnimating, toggle }
}
