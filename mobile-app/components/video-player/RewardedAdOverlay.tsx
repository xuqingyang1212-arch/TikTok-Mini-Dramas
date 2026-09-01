"use client"

import { useRef } from "react"
import { Loader2, X } from "lucide-react"
import { useI18n } from "@/lib/i18n/I18nProvider"
import { getMediaUrl } from "@/lib/api"

const DEMO_AD_VIDEO_PATH = "/media/videos/20260827-番茄-fjr-fjr-婚礼上的规矩-漫剧-原片-横-3.mp4"

interface RewardedAdOverlayProps {
  remainingSeconds: number | null
  isRewarded: boolean
  isSubmitting: boolean
  showCloseConfirm: boolean
  onClose: () => void
  onCancel: () => void
  onContinue: () => void
  onPlaybackStart: () => void
  onPlaybackPause: () => void
  onPlaybackError: () => void
}

export function RewardedAdOverlay({
  remainingSeconds,
  isRewarded,
  isSubmitting,
  showCloseConfirm,
  onClose,
  onCancel,
  onContinue,
  onPlaybackStart,
  onPlaybackPause,
  onPlaybackError,
}: RewardedAdOverlayProps) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)

  const requestClose = () => {
    videoRef.current?.pause()
    onClose()
  }

  const continueWatching = () => {
    onContinue()
    void videoRef.current?.play().catch(onPlaybackError)
  }

  return (
    <div className="absolute inset-0 z-[60] overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        data-ad-video="true"
        src={getMediaUrl(DEMO_AD_VIDEO_PATH)}
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        onPlaying={onPlaybackStart}
        onPause={onPlaybackPause}
        onWaiting={onPlaybackPause}
        onError={onPlaybackError}
        onContextMenu={(event) => event.preventDefault()}
        style={{ pointerEvents: "none" }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        <div className="rounded-full bg-black/55 px-3.5 py-2 text-[15px] font-semibold text-white backdrop-blur-sm">
          {isRewarded ? t("player.adRewardEarned") : `${remainingSeconds ?? "--"}s`}
        </div>
        <button
          type="button"
          onClick={requestClose}
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
                onClick={continueWatching}
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
