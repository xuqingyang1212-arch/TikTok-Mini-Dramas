"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppLoading } from "@/components/AppLoading"
import { HomePage } from "@/components/HomePage"
import { MainNavigation } from "@/components/MainNavigation"
import { useAuth } from "@/components/AuthProvider"

export default function HomeRoute() {
  const router = useRouter()
  const { userData, checkingAuth } = useAuth()

  const openPlayer = useCallback((dramaId: string, episode = 1) => {
    router.push(`/player?dramaId=${encodeURIComponent(dramaId)}&episode=${episode}`)
  }, [router])

  if (checkingAuth || !userData) return <AppLoading />

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <HomePage
          appName={userData.appName}
          initialScrollTop={0}
          onScrollPositionChange={() => undefined}
          onDramaSelect={(drama) => openPlayer(drama.id)}
        />
      </div>
      <MainNavigation />
    </div>
  )
}
