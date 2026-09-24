"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppLoading } from "@/components/AppLoading"
import { MainNavigation } from "@/components/MainNavigation"
import { MePage } from "@/components/MePage"
import { useAuth } from "@/components/AuthProvider"

export default function MeRoute() {
  const router = useRouter()
  const { userData, currentApp, checkingAuth, logout, refreshCurrentApp } = useAuth()

  useEffect(() => {
    if (!userData) return
    refreshCurrentApp().catch((error) => {
      if ((error as Error).name !== "AbortError") console.error("Failed to refresh app config:", error)
    })
  }, [refreshCurrentApp, userData?.userId])

  if (checkingAuth || !userData) return <AppLoading />

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <MePage
          userId={userData.userId}
          monetizationType={currentApp?.monetizationType || userData.monetizationType}
          onOpenPurchaseRecords={() => router.push("/purchase-records")}
          onLogout={logout}
        />
      </div>
      <MainNavigation />
    </div>
  )
}
