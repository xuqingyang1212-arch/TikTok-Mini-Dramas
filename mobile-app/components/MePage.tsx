"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronRight, Copy, Globe2, Loader2, LogOut, ReceiptText, X } from "lucide-react"
import { miniApi, type AppInfo, type UserInfo } from "@/lib/api"
import { VipDiamondIcon } from "./payment/VipDiamondIcon"
import { useI18n } from "@/lib/i18n/I18nProvider"
import type { Locale } from "@/lib/i18n/messages"

interface MePageProps {
  userId: string
  monetizationType?: AppInfo["monetizationType"]
  onOpenPurchaseRecords: () => void
  onLogout: () => void
}

function getBrowserTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return timeZone || undefined
}

function formatExpireAt(expireAt: string | undefined, locale: Locale) {
  if (!expireAt) return ""
  const date = new Date(expireAt)
  if (Number.isNaN(date.getTime())) return expireAt

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    timeZone: getBrowserTimeZone(),
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand("copy")
  textarea.remove()
  if (!copied) throw new Error("Copy failed")
}

export function MePage({ userId, monetizationType, onOpenPurchaseRecords, onLogout }: MePageProps) {
  const { locale, setLocale, t } = useI18n()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [showLanguageSheet, setShowLanguageSheet] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    if (monetizationType !== "IAP") {
      setUserInfo(null)
      setLoading(false)
      setLoadFailed(false)
      return () => controller.abort()
    }

    setLoading(true)
    setLoadFailed(false)
    miniApi
      .getUser(userId, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setUserInfo(data)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error("Failed to load user info:", err)
        setLoadFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [monetizationType, userId])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = (message: string) => {
    setToastMessage(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 1800)
  }

  const handleCopyUserId = async () => {
    try {
      await copyToClipboard(userId)
      showToast(t("me.copySuccess"))
    } catch {
      showToast(t("me.copyFailed"))
    }
  }

  const handleLanguageChange = (nextLocale: Locale) => {
    setLocale(nextLocale)
    setShowLanguageSheet(false)
  }

  const subscription = userInfo?.subscription
  const isVip = subscription?.active === true
  const expireText = formatExpireAt(subscription?.expireAt, locale)
  const isIap = monetizationType === "IAP"

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Header with gradient */}
      <div className="relative safe-area-top">
        <div className="absolute inset-0 h-48 bg-gradient-to-b from-[#ff8a34]/24 to-transparent" />
        
        <div className="relative px-4 pt-10 pb-6">
          {/* Avatar & Info */}
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/35 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <img
                src="/assets/user/default-avatar.png"
                alt={t("common.defaultAvatar")}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-bold text-white">User</h2>
              <button
                type="button"
                onClick={handleCopyUserId}
                aria-label={t("me.copyUserId")}
                className="mt-1.5 flex max-w-full items-center gap-1.5 text-left font-mono text-[14px] text-white/72 transition-colors active:text-[#ffad62]"
              >
                <span className="truncate">{t("common.userId", { id: userId })}</span>
                <Copy size={14} className="flex-shrink-0 text-white/48" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Menu list */}
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-20">
        {isIap && (
          <>
            {/* VIP Banner */}
            <div
              className={isVip
                ? "vip-card vip-card--gold vip-card--recommended relative mx-4 mb-4 flex min-h-[104px] items-center overflow-hidden rounded-[18px] p-4"
                : "profile-vip-card--inactive relative mx-4 mb-4 flex min-h-[104px] items-center overflow-hidden rounded-[18px] p-4"
              }
            >
              {loading ? (
                <div className="flex w-full items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-white/65" />
                </div>
              ) : loadFailed ? (
                <div className="flex w-full items-center gap-3">
                  <VipDiamondIcon theme="gold" className="h-14 w-14 flex-shrink-0 opacity-70" />
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-bold text-white">{t("me.memberLoadFailed")}</h3>
                    <p className="mt-1 text-[14px] text-white/55">{t("me.memberLoadRetry")}</p>
                  </div>
                </div>
              ) : (
                <div className="relative flex w-full items-center gap-3">
                  <VipDiamondIcon
                    theme={isVip ? "gold" : "purple"}
                    crown
                    className="h-14 w-14 flex-shrink-0 drop-shadow-[0_3px_8px_rgba(0,0,0,0.3)]"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[20px] font-bold text-white">
                      {isVip ? t("me.subscribed") : t("me.notSubscribed")}
                    </h3>
                    <p className={isVip ? "mt-1 truncate text-[14px] text-white/85" : "mt-1 truncate text-[14px] text-white/50"}>
                      {isVip && expireText ? t("me.validUntil", { date: expireText }) : t("me.noActiveMember")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Purchase records */}
            <div className="mx-4 mt-2 overflow-hidden rounded-2xl border border-[#ff9b42]/25 bg-gradient-to-r from-[#211a15] via-[#1b1816] to-[#171717] shadow-[0_8px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.035)]">
              <button
                type="button"
                onClick={onOpenPurchaseRecords}
                className="flex min-h-16 w-full items-center gap-3 px-4 text-left transition-colors active:bg-[#ff9b42]/[0.07]"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#ffad62]/25 bg-[#ff8a34]/18 text-[#ffad62] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <ReceiptText size={23} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-white">
                  {t("me.purchaseRecords")}
                </span>
                <ChevronRight size={20} className="flex-shrink-0 text-[#ffad62]/65" />
              </button>
            </div>
          </>
        )}

        {/* Language */}
        <div className="mx-4 mt-3 overflow-hidden rounded-2xl border border-[#ff9b42]/30 bg-gradient-to-r from-[#2a2019] via-[#211a16] to-[#191716] shadow-[0_8px_24px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,183,112,0.06)]">
          <button
            type="button"
            onClick={() => setShowLanguageSheet(true)}
            className="flex min-h-16 w-full items-center gap-3 px-4 text-left transition-colors active:bg-[#ff9b42]/[0.08]"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#ffad62]/28 bg-[#ff8a34]/16 text-[#ffb36f] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <Globe2 size={23} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-white">
              {t("me.language")}
            </span>
            <span className="flex flex-shrink-0 items-center gap-1.5 text-[15px] font-medium text-[#ffc18a]">
              {locale === "zh" ? t("language.chinese") : t("language.english")}
              <ChevronRight size={20} className="text-[#ffad62]/65" />
            </span>
          </button>
        </div>

        {/* Logout button */}
        <div className="mx-4 mt-6">
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3.5 text-[16px] text-white/75 transition-colors active:bg-white/10"
          >
            <LogOut size={18} />
            <span>{t("me.switchAccount")}</span>
          </button>
        </div>

        {/* Version info */}
        <div className="mt-6 text-center">
          <p className="text-[13px] text-white/48">{t("me.version", { version: "1.0.0" })}</p>
        </div>
      </div>

      {toastMessage && (
        <div className="pointer-events-none fixed left-0 right-0 top-[calc(env(safe-area-inset-top,0px)+20px)] z-[100] flex justify-center px-4 animate-fade-in">
          <div className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-[#25211d]/95 px-4 text-[15px] font-medium text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md">
            {toastMessage === t("me.copySuccess") && <Check size={17} className="text-[#ffad62]" />}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {showLanguageSheet && (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-black/65 backdrop-blur-[2px]"
          onClick={() => setShowLanguageSheet(false)}
        >
          <div
            className="animate-slide-up w-full rounded-t-3xl border-t border-white/10 bg-[#171513] px-4 pb-[calc(18px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-16px_44px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex h-12 items-center justify-between px-1">
              <h2 className="text-[19px] font-semibold text-white">{t("language.title")}</h2>
              <button
                type="button"
                onClick={() => setShowLanguageSheet(false)}
                aria-label={t("common.close")}
                className="flex h-11 w-11 items-center justify-center rounded-full text-white/65 active:bg-white/10"
              >
                <X size={21} />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.045]">
              {(["zh", "en"] as const).map((optionLocale, index) => (
                <button
                  key={optionLocale}
                  type="button"
                  onClick={() => handleLanguageChange(optionLocale)}
                  className={`flex min-h-[60px] w-full items-center justify-between px-4 text-[17px] transition-colors active:bg-white/[0.07] ${
                    index > 0 ? "border-t border-white/[0.07]" : ""
                  }`}
                >
                  <span className={locale === optionLocale ? "font-semibold text-white" : "text-white/72"}>
                    {optionLocale === "zh" ? t("language.chinese") : t("language.english")}
                  </span>
                  {locale === optionLocale && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff8a34] text-white">
                      <Check size={17} strokeWidth={2.6} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
