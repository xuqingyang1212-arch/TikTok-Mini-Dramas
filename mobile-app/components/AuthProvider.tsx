"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { miniApi, type AppInfo, type LoginResult } from "@/lib/api"
import { clearPromotionLink, getPendingPromotionLink } from "@/lib/promotion-entry"

const USER_KEY = "mini_drama_user"

export interface UserData {
  userId: string
  openId?: string
  appName: string
  clientKey?: string
  monetizationType?: AppInfo["monetizationType"]
  adPlacementId?: string
  currentPromotionLinkId?: string | null
}

interface AuthContextValue {
  userData: UserData | null
  currentApp: AppInfo | null
  checkingAuth: boolean
  login: (result: LoginResult, app: AppInfo, openId: string) => void
  logout: () => void
  refreshCurrentApp: () => Promise<void>
  setCurrentPromotionLinkId: (linkId: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [currentApp, setCurrentApp] = useState<AppInfo | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const userRef = useRef<UserData | null>(null)
  const refreshAbortRef = useRef<AbortController | null>(null)

  const persistUser = useCallback((user: UserData | null) => {
    userRef.current = user
    setUserData(user)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  }, [])

  const refreshUser = useCallback(async (user: UserData) => {
    refreshAbortRef.current?.abort()
    const controller = new AbortController()
    refreshAbortRef.current = controller

    const [profile, appsResult] = await Promise.all([
      miniApi.getUser(user.userId, { signal: controller.signal }),
      miniApi.getApps({ signal: controller.signal }),
    ])
    if (controller.signal.aborted) return

    const app = (appsResult.list || []).find((item) => item.clientKey === profile.clientKey) || null
    const nextUser: UserData = {
      userId: user.userId,
      openId: profile.openId || user.openId,
      appName: app?.name || profile.appName || user.appName,
      clientKey: profile.clientKey || user.clientKey,
      monetizationType: app?.monetizationType || user.monetizationType,
      adPlacementId: app?.adPlacementId ?? user.adPlacementId,
      currentPromotionLinkId: profile.currentPromotionLinkId,
    }

    persistUser(nextUser)
    setCurrentApp(app)
  }, [persistUser])

  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (!saved) {
      setCheckingAuth(false)
      return
    }

    try {
      const restoredUser = JSON.parse(saved) as UserData
      if (!restoredUser.userId) throw new Error("Invalid saved user")
      persistUser(restoredUser)
      refreshUser(restoredUser)
        .catch((error) => {
          if ((error as Error).name !== "AbortError") console.error("Failed to refresh app config:", error)
        })
        .finally(() => setCheckingAuth(false))
    } catch {
      localStorage.removeItem(USER_KEY)
      setCheckingAuth(false)
    }
  }, [persistUser, refreshUser])

  useEffect(() => {
    if (checkingAuth || userData || pathname === "/login") return
    const nextPath = `${window.location.pathname}${window.location.search}`
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`)
  }, [checkingAuth, pathname, router, userData])

  useEffect(() => {
    if (!userData) return

    const refreshWhenActive = () => {
      if (document.visibilityState !== "visible" || !userRef.current) return
      refreshUser(userRef.current).catch((error) => {
        if ((error as Error).name !== "AbortError") console.error("Failed to refresh app config:", error)
      })
    }

    window.addEventListener("focus", refreshWhenActive)
    document.addEventListener("visibilitychange", refreshWhenActive)
    return () => {
      window.removeEventListener("focus", refreshWhenActive)
      document.removeEventListener("visibilitychange", refreshWhenActive)
    }
  }, [refreshUser, userData?.userId])

  useEffect(() => () => refreshAbortRef.current?.abort(), [])

  const login = useCallback((result: LoginResult, app: AppInfo, openId: string) => {
    persistUser({
      userId: result.userId,
      openId,
      appName: app.name,
      clientKey: app.clientKey,
      monetizationType: app.monetizationType,
      adPlacementId: app.adPlacementId,
      currentPromotionLinkId: result.currentPromotionLinkId,
    })
    setCurrentApp(app)
  }, [persistUser])

  const logout = useCallback(() => {
    refreshAbortRef.current?.abort()
    const pendingLinkId = getPendingPromotionLink()
    if (pendingLinkId) clearPromotionLink(pendingLinkId)
    persistUser(null)
    setCurrentApp(null)
    router.replace("/login")
  }, [persistUser, router])

  const refreshCurrentApp = useCallback(async () => {
    if (userRef.current) await refreshUser(userRef.current)
  }, [refreshUser])

  const setCurrentPromotionLinkId = useCallback((linkId: string) => {
    const currentUser = userRef.current
    if (!currentUser || currentUser.currentPromotionLinkId === linkId) return
    persistUser({ ...currentUser, currentPromotionLinkId: linkId })
  }, [persistUser])

  const value = useMemo(() => ({
    userData,
    currentApp,
    checkingAuth,
    login,
    logout,
    refreshCurrentApp,
    setCurrentPromotionLinkId,
  }), [checkingAuth, currentApp, login, logout, refreshCurrentApp, setCurrentPromotionLinkId, userData])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
