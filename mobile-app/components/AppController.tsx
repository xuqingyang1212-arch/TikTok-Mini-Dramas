"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BottomNav } from "@/components/BottomNav"
import { HomePage } from "@/components/HomePage"
import { LoginPage } from "@/components/LoginPage"
import { MePage } from "@/components/MePage"
import { PurchaseRecordsPage } from "@/components/PurchaseRecordsPage"
import { VideoPlayer } from "@/components/VideoPlayer"
import { useAppSession } from "@/components/app-shell/useAppSession"
import { useBrowserNavigation } from "@/components/app-shell/useBrowserNavigation"
import { useDramaSelection } from "@/components/app-shell/useDramaSelection"

interface AppControllerProps {
  initialDramaId?: string
}

type Tab = "home" | "me"

export function AppController({ initialDramaId }: AppControllerProps) {
  const {
    userData,
    currentApp,
    checkingAuth,
    login,
    logout,
    refreshCurrentApp,
  } = useAppSession()
  const { view, setView, backToMain, resetNavigation } = useBrowserNavigation(Boolean(initialDramaId))
  const {
    selectedDrama,
    episodes,
    loadingPlay,
    selectDrama,
    clearSelection,
    setEpisodes,
  } = useDramaSelection({ userId: userData?.userId, initialDramaId, setView })
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const homeScrollTopRef = useRef(0)

  const handleLogout = () => {
    clearSelection()
    resetNavigation()
    logout()
    setActiveTab("home")
  }

  const handleBack = () => {
    if (initialDramaId && window.location.pathname === "/player") {
      window.location.replace("/")
      return
    }
    if (!backToMain()) clearSelection()
  }

  const handleOpenPurchaseRecords = () => {
    if ((currentApp?.monetizationType || userData?.monetizationType) !== "IAP") return
    setView("purchase-records")
  }

  useEffect(() => {
    if (!userData || activeTab !== "me") return
    refreshCurrentApp(userData).catch((error) => {
      if ((error as Error).name !== "AbortError") console.error("Failed to refresh app config:", error)
    })
  }, [activeTab, refreshCurrentApp, userData?.userId])

  useEffect(() => {
    if (!userData) return

    const refreshWhenActive = () => {
      if (document.visibilityState !== "visible") return
      refreshCurrentApp(userData).catch((error) => {
        if ((error as Error).name !== "AbortError") console.error("Failed to refresh app config:", error)
      })
    }

    window.addEventListener("focus", refreshWhenActive)
    document.addEventListener("visibilitychange", refreshWhenActive)
    return () => {
      window.removeEventListener("focus", refreshWhenActive)
      document.removeEventListener("visibilitychange", refreshWhenActive)
    }
  }, [refreshCurrentApp, userData?.userId])

  useEffect(() => {
    if ((currentApp?.monetizationType || userData?.monetizationType) === "IAA" && view === "purchase-records") {
      setView("main")
    }
  }, [currentApp?.monetizationType, setView, userData?.monetizationType, view])

  const handleHomeScrollPositionChange = useCallback((scrollTop: number) => {
    homeScrollTopRef.current = scrollTop
  }, [])

  if (checkingAuth) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  if (!userData) return <LoginPage onLogin={login} />

  if (view === "player" && selectedDrama) {
    return (
      <VideoPlayer
        drama={selectedDrama}
        episodes={episodes}
        initialEpisode={1}
        userId={userData.userId}
        monetizationType={currentApp?.monetizationType || userData.monetizationType}
        adPlacementId={currentApp?.adPlacementId ?? userData.adPlacementId}
        onBack={handleBack}
        onEpisodesRefresh={setEpisodes}
      />
    )
  }

  if (
    view === "purchase-records" &&
    (currentApp?.monetizationType || userData.monetizationType) === "IAP"
  ) {
    return <PurchaseRecordsPage userId={userData.userId} onBack={handleBack} />
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {loadingPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeTab === "home" && (
          <HomePage
            appName={userData.appName}
            initialScrollTop={homeScrollTopRef.current}
            onScrollPositionChange={handleHomeScrollPositionChange}
            onDramaSelect={selectDrama}
          />
        )}
        {activeTab === "me" && (
          <MePage
            userId={userData.userId}
            monetizationType={currentApp?.monetizationType || userData.monetizationType}
            onOpenPurchaseRecords={handleOpenPurchaseRecords}
            onLogout={handleLogout}
          />
        )}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
