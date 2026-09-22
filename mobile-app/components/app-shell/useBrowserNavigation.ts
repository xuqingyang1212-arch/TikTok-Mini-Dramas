"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getHistoryView,
  shouldUseBrowserBack,
  syncHistoryView,
  type AppView,
} from "@/lib/app/navigation"

export function useBrowserNavigation(startInPlayer = false) {
  const [view, setView] = useState<AppView>(startInPlayer ? "player" : "main")
  const skipInitialSyncRef = useRef(startInPlayer)

  const backToMain = useCallback(() => {
    if (shouldUseBrowserBack(window.history.state, view)) {
      window.history.back()
      return true
    }
    setView("main")
    return false
  }, [view])

  const resetNavigation = useCallback(() => {
    window.history.replaceState({ view: "main" }, "", window.location.pathname)
    setView("main")
  }, [])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => setView(getHistoryView(event.state))
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    if (skipInitialSyncRef.current) {
      skipInitialSyncRef.current = false
      return
    }
    syncHistoryView(window.history, window.location.pathname, view)
  }, [view])

  return { view, setView, backToMain, resetNavigation }
}
