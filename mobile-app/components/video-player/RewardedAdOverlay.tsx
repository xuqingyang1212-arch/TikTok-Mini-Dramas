"use client"

import { CheckCircle2, Loader2, PlaySquare, X } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider"
import type { AdUnlockSession } from "@/lib/api"

interface RewardedAdOverlayProps {
  session: AdUnlockSession
  remainingSeconds: number | null
  isRewarded: boolean
  isSubmitting: boolean
  showCloseConfirm: boolean
  onClose: () => void
  onCancel: () => void
  onContinue: () => void
}

export function RewardedAdOverlay({
  session,
  remainingSeconds,
  isRewarded,
  isSubmitting,
  showCloseConfirm,
  onClose,
  onCancel,
  onContinue,
}: RewardedAdOverlayProps) {
  const { t } = useI18n()

  return (
    <div className="absolute inset-0 z-[60] overflow-hidden bg-[#080808]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,138,52,0.24),transparent_38%),linear-gradient(180deg,#1a1511_0%,#080808_62%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:18px_18px]" />

      <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-[#ffad62]/30 bg-[#ff8a34]/15 shadow-[0_0_50px_rgba(255,138,52,0.2)]">
          {isRewarded ? (
            <CheckCircle2 size={50} className="text-[#ffad62]" />
          ) : (
            <PlaySquare size={50} className="text-[#ffad62]" />
          )}
        </div>
        <h2 className="mt-6 text-[24px] font-bold text-white">
          {isRewarded ? t("player.adRewardEarned") : t("player.adPlaying")}
        </h2>
        <p className="mt-2 max-w-sm text-[15px] leading-6 text-white/58">
          {isRewarded
            ? t("player.adCloseToUnlock")
            : t("player.adRemaining", { seconds: remainingSeconds ?? "--" })}
        </p>
        <p className="mt-4 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/38">
          {t("player.adDemoPlacement", { placement: session.adPlacementId })}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        <div className="rounded-full bg-black/55 px-3.5 py-2 text-[15px] font-semibold text-white backdrop-blur-sm">
          {isRewarded ? t("player.adRewardEarned") : `${remainingSeconds ?? "--"}s`}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm disabled:opacity-50"
          aria-label={t("common.close")}
        >
          {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <X size={22} />}
        </button>
      </div>

      {showCloseConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1d1a18] p-5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
            <h2 className="text-[18px] font-semibold text-white">{t("player.adIncompleteTitle")}</h2>
            <p className="mt-2 text-[14px] leading-6 text-white/55">{t("player.adIncompleteDescription")}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onContinue}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-white/10 py-3 text-[15px] text-white/75 disabled:opacity-50"
              >
                {t("player.adContinue")}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-white/10 py-3 text-[15px] text-white disabled:opacity-50"
              >
                {isSubmitting ? t("player.adExiting") : t("player.adExit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
