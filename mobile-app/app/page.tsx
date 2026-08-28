"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BottomNav } from "@/components/BottomNav"
import { HomePage } from "@/components/HomePage"
import { MePage } from "@/components/MePage"
import { PurchaseRecordsPage } from "@/components/PurchaseRecordsPage"
import { VideoPlayer } from "@/components/VideoPlayer"
import { LoginPage } from "@/components/LoginPage"
import { miniApi, type Drama, type Episode } from "@/lib/api"

type AppView = "main" | "player" | "purchase-records"
type Tab = "home" | "me"

const USER_KEY = "mini_drama_user"

interface UserData {
  userId: string
  appName: string
}

export default function App() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [view, setView] = useState<AppView>("main")
  const [selectedDrama, setSelectedDrama] = useState<Drama | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loadingPlay, setLoadingPlay] = useState(false)
  const homeScrollTopRef = useRef(0)

  // Check saved user on mount
  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.userId) {
          setUserData(data)
        }
      } catch {}
    }
    setCheckingAuth(false)
  }, [])

  // Handle login
  const handleLogin = (userId: string, appName: string) => {
    const data = { userId, appName }
    setUserData(data)
    localStorage.setItem(USER_KEY, JSON.stringify(data))
  }

  // Handle logout
  const handleLogout = () => {
    setUserData(null)
    localStorage.removeItem(USER_KEY)
    setView("main")
    setActiveTab("home")
  }

  // Handle drama selection - directly play episode 1
  const handleDramaSelect = async (drama: Drama) => {
    if (!userData) return
    setLoadingPlay(true)
    try {
      // Fetch episodes with unlock status
      const res = await miniApi.getEpisodes(drama.id, userData.userId)
      setSelectedDrama(drama)
      setEpisodes(res.list || [])
      setView("player")
    } catch (err) {
      console.error("Failed to load episodes:", err)
    } finally {
      setLoadingPlay(false)
    }
  }

  // Handle back navigation
  const handleBack = () => {
    setView("main")
    setSelectedDrama(null)
  }

  const handleOpenPurchaseRecords = () => {
    setView("purchase-records")
  }

  // Handle episodes refresh (after payment)
  const handleEpisodesRefresh = (newEpisodes: Episode[]) => {
    setEpisodes(newEpisodes)
  }

  const handleHomeScrollPositionChange = useCallback((scrollTop: number) => {
    homeScrollTopRef.current = scrollTop
  }, [])

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (view !== "main") {
        setView("main")
        setSelectedDrama(null)
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [view])

  // Push history state on navigation
  useEffect(() => {
    if (view !== "main") {
      window.history.pushState({ view }, "")
    }
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
        onBack={handleBack}
        onEpisodesRefresh={handleEpisodesRefresh}
      />
    )
  }

  if (view === "purchase-records" && userData) {
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
            onOpenPurchaseRecords={handleOpenPurchaseRecords}
            onLogout={handleLogout}
          />
        )}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
