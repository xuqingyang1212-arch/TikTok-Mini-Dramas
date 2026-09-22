"use client"

import { useEffect } from "react"
import { ensurePromotionActivation } from "@/lib/app/promotion-activation"
import { readStoredUser, USER_SESSION_EVENT, type UserData } from "@/lib/app/session"

export function PromotionActivation() {
  useEffect(() => {
    const activate = (user: UserData | null) => {
      if (!user) return
      ensurePromotionActivation(user.userId, window.location.search).catch((error) => {
        console.error("Failed to report user activation:", error)
      })
    }

    activate(readStoredUser(localStorage))
    const handleSession = (event: Event) => activate((event as CustomEvent<UserData>).detail)
    window.addEventListener(USER_SESSION_EVENT, handleSession)
    return () => window.removeEventListener(USER_SESSION_EVENT, handleSession)
  }, [])

  return null
}
