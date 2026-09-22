"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { miniApi, type Drama, type Episode } from "@/lib/api"
import { ensurePromotionActivation } from "@/lib/app/promotion-activation"
import type { AppView } from "@/lib/app/navigation"

interface DramaSelectionOptions {
  userId?: string
  initialDramaId?: string
  setView: (view: AppView) => void
}

export function useDramaSelection({ userId, initialDramaId, setView }: DramaSelectionOptions) {
  const [selectedDrama, setSelectedDrama] = useState<Drama | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loadingPlay, setLoadingPlay] = useState(false)
  const dramaLoadAbortRef = useRef<AbortController | null>(null)

  const selectDrama = useCallback(async (drama: Drama) => {
    if (!userId) return

    dramaLoadAbortRef.current?.abort()
    const controller = new AbortController()
    dramaLoadAbortRef.current = controller
    setLoadingPlay(true)

    try {
      const res = await miniApi.getEpisodes(drama.id, userId, { signal: controller.signal })
      if (controller.signal.aborted) return
      setSelectedDrama(drama)
      setEpisodes(res.list || [])
      setView("player")
    } catch (error) {
      if (controller.signal.aborted) return
      console.error("Failed to load episodes:", error)
    } finally {
      if (!controller.signal.aborted) setLoadingPlay(false)
    }
  }, [setView, userId])

  useEffect(() => {
    if (!userId || !initialDramaId) return

    const controller = new AbortController()
    ensurePromotionActivation(userId, window.location.search)
      .catch((error) => console.error("Failed to report user activation:", error))
      .then(() => miniApi.getDrama(initialDramaId, { signal: controller.signal }))
      .then((drama) => {
        if (!controller.signal.aborted) return selectDrama(drama)
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") console.error("Failed to load drama:", error)
      })
    return () => controller.abort()
  }, [initialDramaId, selectDrama, userId])

  const clearSelection = useCallback(() => {
    dramaLoadAbortRef.current?.abort()
    setSelectedDrama(null)
    setEpisodes([])
  }, [])

  useEffect(() => () => dramaLoadAbortRef.current?.abort(), [])

  return {
    selectedDrama,
    episodes,
    loadingPlay,
    selectDrama,
    clearSelection,
    setEpisodes,
  }
}
