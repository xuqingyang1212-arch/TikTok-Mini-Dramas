"use client"

import { useEffect, useRef } from "react"
import { miniApi } from "@/lib/api"
import {
  capturePromotionLink,
  clearPendingPromotionLink,
  getPendingPromotionLink,
} from "@/lib/promotion-entry"

interface UsePromotionEntryOptions {
  userId?: string
  onActivated: (linkId: string) => void
}

export function usePromotionEntry({ userId, onActivated }: UsePromotionEntryOptions) {
  const activationAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    capturePromotionLink()
  }, [])

  useEffect(() => {
    if (!userId) return
    const linkId = getPendingPromotionLink()
    if (!linkId) return

    activationAbortRef.current?.abort()
    const controller = new AbortController()
    activationAbortRef.current = controller

    const activate = async () => {
      try {
        const activation = await miniApi.activateUser(userId, linkId, { signal: controller.signal })
        if (controller.signal.aborted) return

        clearPendingPromotionLink(linkId)
        if (activation.currentPromotionLinkId) {
          onActivated(activation.currentPromotionLinkId)
        }
      } catch (activationError) {
        if (controller.signal.aborted) return
        clearPendingPromotionLink(linkId)
        console.warn("Promotion attribution failed:", activationError)
      }
    }

    const activationTimer = window.setTimeout(() => void activate(), 0)
    return () => {
      window.clearTimeout(activationTimer)
      controller.abort()
    }
  }, [onActivated, userId])

  useEffect(() => () => activationAbortRef.current?.abort(), [])
}
