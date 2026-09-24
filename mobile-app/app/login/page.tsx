"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AppLoading } from "@/components/AppLoading"
import { LoginPage } from "@/components/LoginPage"
import { useAuth } from "@/components/AuthProvider"

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/"
}

function LoginRouteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userData, checkingAuth, login } = useAuth()
  const nextPath = safeNextPath(searchParams.get("next"))

  useEffect(() => {
    if (!checkingAuth && userData) router.replace(nextPath)
  }, [checkingAuth, nextPath, router, userData])

  if (checkingAuth || userData) return <AppLoading />

  return (
    <LoginPage
      onLogin={(result, app, openId) => {
        login(result, app, openId)
        router.replace(nextPath)
      }}
    />
  )
}

export default function LoginRoute() {
  return (
    <Suspense fallback={<AppLoading />}>
      <LoginRouteContent />
    </Suspense>
  )
}
