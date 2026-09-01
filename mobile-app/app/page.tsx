"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BottomNav } from "@/components/BottomNav"
import { HomePage } from "@/components/HomePage"
import { MePage } from "@/components/MePage"
import { PurchaseRecordsPage } from "@/components/PurchaseRecordsPage"
import { VideoPlayer } from "@/components/VideoPlayer"
import { LoginPage } from "@/components/LoginPage"
import { miniApi, type AppInfo, type Drama, type Episode } from "@/lib/api"

type AppView = "main" | "player" | "purchase-records"
type Tab = "home" | "me"

const USER_KEY = "mini_drama_user"

interface UserData {
  userId: string
  appName: string
  clientKey?: string
  monetizationType?: AppInfo["monetizationType"]
  adPlacementId?: string
}

export default function App() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [currentApp, setCurrentApp] = useState<AppInfo | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [view, setView] = useState<AppView>("main")
  const [selectedDrama, setSelectedDrama] = useState<Drama | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loadingPlay, setLoadingPlay] = useState(false)
  const homeScrollTopRef = useRef(0)
  const dramaLoadAbortRef = useRef<AbortController | null>(null)
  const appRefreshAbortRef = useRef<AbortController | null>(null)

  const refreshCurrentApp = useCallback(async (user: UserData) => {
    appRefreshAbortRef.current?.abort()
    const controller = new AbortController()
    appRefreshAbortRef.current = controller

    const [profile, appsResult] = await Promise.all([
      miniApi.getUser(user.userId, { signal: controller.signal }),
      miniApi.getApps({ signal: controller.signal }),
    ])
    if (controller.signal.aborted) return

    const app = (appsResult.list || []).find((item) => item.clientKey === profile.clientKey) || null
    const nextUser: UserData = {
      userId: user.userId,
      appName: app?.name || profile.appName || user.appName,
      clientKey: profile.clientKey || user.clientKey,
      monetizationType: app?.monetizationType || user.monetizationType,
      adPlacementId: app?.adPlacementId ?? user.adPlacementId,
    }

    setUserData(nextUser)
    setCurrentApp(app)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
  }, [])

  // Restore the user and refresh the app config so backend monetization changes take effect.
  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) {
      try {
        const data = JSON.parse(saved) as UserData
        if (data.userId) {
          setUserData(data)
          refreshCurrentApp(data)
            .catch((error) => {
              if ((error as Error).name !== "AbortError") console.error("Failed to refresh app config:", error)
            })
            .finally(() => setCheckingAuth(false))
          return
        }
      } catch {}
    }
    setCheckingAuth(false)
  }, [refreshCurrentApp])

  // Handle login
  const handleLogin = (userId: string, app: AppInfo) => {
    const data: UserData = {
      userId,
      appName: app.name,
      clientKey: app.clientKey,
      monetizationType: app.monetizationType,
      adPlacementId: app.adPlacementId,
    }
    setUserData(data)
    setCurrentApp(app)
    localStorage.setItem(USER_KEY, JSON.stringify(data))
  }

  // Handle logout
  const handleLogout = () => {
    dramaLoadAbortRef.current?.abort()
    appRefreshAbortRef.current?.abort()
    if (typeof window !== "undefined") {
      window.history.replaceState({ view: "main" }, "", window.location.pathname)
    }
    setUserData(null)
    setCurrentApp(null)
    localStorage.removeItem(USER_KEY)
    setView("main")
    setActiveTab("home")
    setSelectedDrama(null)
    setEpisodes([])
  }

  // Handle drama selection - directly play episode 1
  const handleDramaSelect = async (drama: Drama) => {
    if (!userData) return

    dramaLoadAbortRef.current?.abort()
    const controller = new AbortController()
    dramaLoadAbortRef.current = controller

    setLoadingPlay(true)
    try {
      const res = await miniApi.getEpisodes(drama.id, userData.userId, { signal: controller.signal })
      if (controller.signal.aborted) return
      setSelectedDrama(drama)
      setEpisodes(res.list || [])
      setView("player")
    } catch (err) {
      if (controller.signal.aborted) return
      console.error("Failed to load episodes:", err)
    } finally {
      if (!controller.signal.aborted) {
        setLoadingPlay(false)
      }
    }
  }

  // Handle back navigation
  const handleBack = () => {
    dramaLoadAbortRef.current?.abort()

    if (
      view !== "main" &&
      typeof window !== "undefined" &&
      (window.history.state as { view?: AppView } | null)?.view === view
    ) {
      window.history.back()
      return
    }

    setView("main")
    setSelectedDrama(null)
    setEpisodes([])
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
  }, [currentApp?.monetizationType, userData?.monetizationType, view])

  // Handle episodes refresh (after payment)
  const handleEpisodesRefresh = (newEpisodes: Episode[]) => {
    setEpisodes(newEpisodes)
  }

  const handleHomeScrollPositionChange = useCallback((scrollTop: number) => {
    homeScrollTopRef.current = scrollTop
  }, [])

  useEffect(() => {
    return () => {
      dramaLoadAbortRef.current?.abort()
      appRefreshAbortRef.current?.abort()
    }
  }, [])

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const nextView = (event.state as { view?: AppView } | null)?.view ?? "main"
      setView(nextView)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Keep app state consistent with browser history without stacking duplicate entries.
  useEffect(() => {
    if (typeof window === "undefined") return

    const currentState = window.history.state as { view?: AppView } | null
    if (currentState?.view === view) return

    if (view === "main") {
      window.history.replaceState({ view: "main" }, "", window.location.pathname)
      return
    }

    window.history.pushState({ view }, "", window.location.pathname)
  }, [view])

  // Loading state
  if (checkingAuth) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  // Login page
  if (!userData) {
    return <LoginPage onLogin={handleLogin} />
  }

  // Video player (full screen, no nav)
  if (view === "player" && selectedDrama && userData) {
    return (
      <VideoPlayer
        drama={selectedDrama}
        episodes={episodes}
        initialEpisode={1}
        userId={userData.userId}
        monetizationType={currentApp?.monetizationType || userData.monetizationType}
        adPlacementId={currentApp?.adPlacementId ?? userData.adPlacementId}
        onBack={handleBack}
        onEpisodesRefresh={handleEpisodesRefresh}
      />
    )
  }

  if (
    view === "purchase-records" &&
    userData &&
    (currentApp?.monetizationType || userData.monetizationType) === "IAP"
  ) {
    return <PurchaseRecordsPage userId={userData.userId} onBack={handleBack} />
  }

  // Main views with bottom nav
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Loading overlay */}
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
            onDramaSelect={handleDramaSelect}
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
