"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, Check } from "lucide-react"
import { miniApi, type AppInfo } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/I18nProvider"

interface LoginPageProps {
  onLogin: (userId: string, appName: string) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { t } = useI18n()
  const [apps, setApps] = useState<AppInfo[]>([])
  const [selectedApp, setSelectedApp] = useState<string>("")
  const [openId, setOpenId] = useState("")
  const [loading, setLoading] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    miniApi.getApps().then((res) => {
      const list = res.list || []
      setApps(list)
      if (list.length > 0) {
        setSelectedApp(list[0].clientKey)
      }
      setLoading(false)
    }).catch(() => {
      setError(t("login.loadAppsFailed"))
      setLoading(false)
    })
  }, [t])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedAppInfo = apps.find(a => a.clientKey === selectedApp)
  const selectedAppName = selectedAppInfo?.name || t("login.selectApp")

  const handleSelectApp = (clientKey: string) => {
    setSelectedApp(clientKey)
    setShowDropdown(false)
  }

  const handleLogin = async () => {
    if (!selectedApp || !openId.trim()) {
      setError(t("login.missingFields"))
      return
    }

    setError("")
    setLoggingIn(true)

    try {
      const result = await miniApi.login(selectedApp, openId.trim())
      const appName = selectedAppInfo?.name || "Mini Drama"
      onLogin(result.userId, appName)
    } catch (err: any) {
      setError(err.message || t("login.failed"))
    } finally {
      setLoggingIn(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-black">
      {/* Header area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo / Title */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.32)] ring-1 ring-white/15">
            <img
              src="/assets/brand/app-logo.png"
              alt="Mini Drama"
              className="h-[122%] w-[122%] max-w-none translate-x-[2%] translate-y-[3%] object-contain"
              draggable={false}
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Mini Drama</h1>
          <p className="mt-2 text-[14px] text-white/50">{t("login.subtitle")}</p>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm space-y-4">
          {/* App selector - Custom dropdown */}
          <div ref={dropdownRef} className="relative">
            <label className="mb-1.5 block text-[13px] font-medium text-white/70">{t("login.app")}</label>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border bg-white/5 px-4 py-3 text-left text-[15px] outline-none transition-colors",
                showDropdown ? "border-[#ff8a34]/55" : "border-white/10"
              )}
            >
              <span className="text-white">{selectedAppName}</span>
              <ChevronDown 
                size={20} 
                className={cn(
                  "text-white/50 transition-transform",
                  showDropdown && "rotate-180"
                )} 
              />
            </button>

            {/* Dropdown menu */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl">
                {apps.map((app) => (
                  <button
                    key={app.clientKey}
                    type="button"
                    onClick={() => handleSelectApp(app.clientKey)}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-3 text-left text-[15px] transition-colors",
                      app.clientKey === selectedApp
                        ? "bg-[#ff8a34]/10 text-white"
                        : "text-white/80 active:bg-white/5"
                    )}
                  >
                    <span>{app.name}</span>
                    {app.clientKey === selectedApp && (
                      <Check size={18} className="text-[#ff8a34]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* OpenID input */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-white/70">{t("login.openId")}</label>
            <input
              type="text"
              value={openId}
              onChange={(e) => setOpenId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder={t("login.openIdPlaceholder")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-white placeholder-white/30 outline-none transition-colors focus:border-[#ff8a34]/55"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-[13px] text-red-400">{error}</p>
          )}

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={loggingIn || !selectedApp || !openId.trim()}
            className="w-full rounded-xl bg-[#ff8a34] py-3.5 text-[16px] font-semibold text-white transition-all active:scale-[0.98] active:bg-[#f47c24] disabled:opacity-50 disabled:active:scale-100"
          >
            {loggingIn ? t("login.submitting") : t("login.submit")}
          </button>
        </div>
      </div>

      {/* Footer hint */}
      <div className="pb-8 text-center safe-area-bottom">
        <p className="text-[12px] text-white/30">{t("login.demoHint")}</p>
      </div>
    </div>
  )
}
