"use client"

import { useAuth } from "@/components/AuthProvider"
import { usePromotionEntry } from "@/components/usePromotionEntry"

export function PromotionEntryController({ children }: { children: React.ReactNode }) {
  const { userData, setCurrentPromotionLinkId } = useAuth()
  usePromotionEntry({
    userId: userData?.userId,
    onActivated: setCurrentPromotionLinkId,
  })

  return children
}
