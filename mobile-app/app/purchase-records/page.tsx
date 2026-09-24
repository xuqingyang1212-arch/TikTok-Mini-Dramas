"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppLoading } from "@/components/AppLoading"
import { PurchaseRecordsPage } from "@/components/PurchaseRecordsPage"
import { useAuth } from "@/components/AuthProvider"

export default function PurchaseRecordsRoute() {
  const router = useRouter()
  const { userData, currentApp, checkingAuth } = useAuth()
  const monetizationType = currentApp?.monetizationType || userData?.monetizationType

  useEffect(() => {
    if (!checkingAuth && userData && monetizationType !== "IAP") router.replace("/me")
  }, [checkingAuth, monetizationType, router, userData])

  if (checkingAuth || !userData || monetizationType !== "IAP") return <AppLoading />

  return <PurchaseRecordsPage userId={userData.userId} onBack={() => router.back()} />
}
