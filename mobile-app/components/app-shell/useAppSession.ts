"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { miniApi, type AppInfo } from "@/lib/api"
import {
  persistUser,
  readStoredUser,
  USER_KEY,
  USER_SESSION_EVENT,
  type UserData,
} from "@/lib/app/session"

export function useAppSession() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [currentApp, setCurrentApp] = useState<AppInfo | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
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
    persistUser(localStorage, nextUser)
  }, [])

  useEffect(() => {
    const savedUser = readStoredUser(localStorage)
    if (savedUser) {
      setUserData(savedUser)
      refreshCurrentApp(savedUser)
        .catch((error) => {
          if ((error as Error).name !== "AbortError") console.error("Failed to refresh app config:", error)
        })
        .finally(() => setCheckingAuth(false))
      return
    }
    setCheckingAuth(false)
  }, [refreshCurrentApp])

  const login = useCallback((userId: string, app: AppInfo) => {
    const data: UserData = {
      userId,
      appName: app.name,
      clientKey: app.clientKey,
      monetizationType: app.monetizationType,
      adPlacementId: app.adPlacementId,
    }
    setUserData(data)
    setCurrentApp(app)
    persistUser(localStorage, data)
    window.dispatchEvent(new CustomEvent(USER_SESSION_EVENT, { detail: data }))
  }, [])

  const logout = useCallback(() => {
    appRefreshAbortRef.current?.abort()
    setUserData(null)
    setCurrentApp(null)
    localStorage.removeItem(USER_KEY)
  }, [])

  useEffect(() => () => appRefreshAbortRef.current?.abort(), [])

  return {
    userData,
    currentApp,
    checkingAuth,
    login,
    logout,
    refreshCurrentApp,
  }
}
