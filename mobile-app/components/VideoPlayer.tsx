"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Play, ChevronLeft, ChevronUp, Layers, Loader2, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getAdjacentEpisodes,
  getMediaUrl,
  miniApi,
  normalizeEpisodeList,
  type Drama,
  type Episode,
  type MonetizationType,
} from "@/lib/api"
import { useI18n } from "@/lib/i18n/I18nProvider"
import { PaywallPanel } from "./PaywallPanel"
import { VideoPlayerEpisodeList } from "./video-player/VideoPlayerEpisodeList"
import {
  buildGridSlots,
  computeEpisodeTabs,
  formatTime,
  getVisibleEpisodes,
  resolveEpisodeSelection,
} from "./video-player/helpers"
import { RewardedAdOverlay } from "./video-player/RewardedAdOverlay"
import { usePlaybackControls } from "./video-player/usePlaybackControls"
import { useRewardedAdUnlock } from "./video-player/useRewardedAdUnlock"
import { useVideoViewport } from "./video-player/useVideoViewport"

interface VideoPlayerProps {
  drama: Drama
  episodes: Episode[]
  initialEpisode?: number
  userId: string
  monetizationType?: MonetizationType
  adPlacementId?: string
  onBack: () => void
  onEpisodesRefresh?: (episodes: Episode[]) => void
}

export function VideoPlayer({
  drama,
  episodes: initialEpisodes,
  initialEpisode = 1,
  userId,
  monetizationType,
  adPlacementId,
  onBack,
  onEpisodesRefresh,
}: VideoPlayerProps) {
  const { t } = useI18n()
  const normalizedInitialEpisodes = useMemo(() => normalizeEpisodeList(initialEpisodes), [initialEpisodes])
  const [episodes, setEpisodes] = useState(normalizedInitialEpisodes)
  const [currentEpisode, setCurrentEpisode] = useState(() => resolveEpisodeSelection(normalizedInitialEpisodes, initialEpisode))

  useEffect(() => {
    const nextEpisodes = normalizeEpisodeList(initialEpisodes)
    setEpisodes(nextEpisodes)
    if (!nextEpisodes.length) return

    setCurrentEpisode((prevCurrentEpisode) => {
      if (nextEpisodes.some((episode) => episode.episodeNo === prevCurrentEpisode)) {
        return prevCurrentEpisode
      }
      return resolveEpisodeSelection(nextEpisodes, initialEpisode)
    })
  }, [initialEpisode, initialEpisodes])

  const [isPlaying, setIsPlaying] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [showEpisodeList, setShowEpisodeList] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [adErrorMessage, setAdErrorMessage] = useState("")

  const [translateY, setTranslateY] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const nextVideoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const swipeDistance = useRef(0)
  const adErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const swipeResetTimerRef = useRef<number | null>(null)
  const refreshEpisodeAbortRef = useRef<AbortController | null>(null)
  const paySuccessTimerRef = useRef<number | null>(null)
  const isSwiping = useRef(false)
  const reportedVideoRef = useRef<HTMLVideoElement | null>(null)
  const { isAndroid, viewportHeight, containerHeight } = useVideoViewport(playerRef)

  const sortedEpisodes = useMemo(() => normalizeEpisodeList(episodes), [episodes])
  const { prevEpisode, currentEpisodeData: episode, nextEpisodeData } = getAdjacentEpisodes(sortedEpisodes, currentEpisode)

  const isCurrentEpisodeLocked = Boolean(episode && episode.isUnlocked === false)
  const isIaa = monetizationType === "IAA"
  const canUnlockCurrentEpisodeByAd = Boolean(
    isIaa && episode?.canUnlockByAd && adPlacementId?.trim(),
  )

  const refreshEpisodesAfterUnlock = useCallback(async () => {
    refreshEpisodeAbortRef.current?.abort()
    const controller = new AbortController()
    refreshEpisodeAbortRef.current = controller

    const res = await miniApi.getEpisodes(drama.id, userId, { signal: controller.signal })
    if (controller.signal.aborted) return

    const nextEpisodes = res.list || []
    setEpisodes(nextEpisodes)
    onEpisodesRefresh?.(nextEpisodes)
    setShowPaywall(false)
    setIsPlaying(false)

    if (paySuccessTimerRef.current) clearTimeout(paySuccessTimerRef.current)
    paySuccessTimerRef.current = window.setTimeout(() => {
      if (controller.signal.aborted) return
      void videoRef.current?.play().catch(() => undefined)
      setIsPlaying(true)
    }, 100)
  }, [drama.id, onEpisodesRefresh, userId])

  const rewardedAd = useRewardedAdUnlock({
    userId,
    dramaId: drama.id,
    episodeNo: currentEpisode,
    enabled: canUnlockCurrentEpisodeByAd,
    onUnlocked: refreshEpisodesAfterUnlock,
  })
  const isAdOpen = rewardedAd.session !== null
  const { clearControlsTimer, hideControlsLater } = usePlaybackControls({
    showControls,
    isPlaying,
    isDragging,
    showPaywall: showPaywall || isAdOpen,
    showEpisodeList,
    onAutoHide: () => setShowControls(false),
  })

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
      if (swipeResetTimerRef.current) clearTimeout(swipeResetTimerRef.current)
      if (paySuccessTimerRef.current) clearTimeout(paySuccessTimerRef.current)
      if (adErrorTimerRef.current) clearTimeout(adErrorTimerRef.current)
      refreshEpisodeAbortRef.current?.abort()
      clearControlsTimer()
    }
  }, [clearControlsTimer])

  useEffect(() => {
    if (!isCurrentEpisodeLocked) return
    setShowPaywall(!isIaa)
    setIsPlaying(false)
    videoRef.current?.pause()
  }, [isCurrentEpisodeLocked, isIaa])

  const handlePaySuccess = async () => {
    try {
      await refreshEpisodesAfterUnlock()
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      console.error("Failed to refresh episodes:", err)
      setShowPaywall(false)
    }
  }

  const handleLockedAction = async () => {
    if (!canUnlockCurrentEpisodeByAd) {
      if (!isIaa) setShowPaywall(true)
      return
    }

    setIsPlaying(false)
    setShowControls(false)
    setShowEpisodeList(false)
    videoRef.current?.pause()
    const result = await rewardedAd.start()
    if (result !== "failed") return

    setAdErrorMessage(t("player.adStartFailed"))
    if (adErrorTimerRef.current) clearTimeout(adErrorTimerRef.current)
    adErrorTimerRef.current = setTimeout(() => setAdErrorMessage(""), 2400)
  }

  const handleAdPlaybackError = async () => {
    await rewardedAd.cancel()
    setAdErrorMessage(t("player.adStartFailed"))
    if (adErrorTimerRef.current) clearTimeout(adErrorTimerRef.current)
    adErrorTimerRef.current = setTimeout(() => setAdErrorMessage(""), 2400)
  }

  const episodeTabs = useMemo(() => computeEpisodeTabs(episodes), [episodes])

  useEffect(() => {
    if (!episodeTabs.length) return
    const nextTabIndex = Math.floor((currentEpisode - 1) / 30)
    setActiveTab((previousTab) => (previousTab === nextTabIndex ? previousTab : nextTabIndex))
  }, [currentEpisode, episodeTabs])

  const visibleEpisodes = useMemo(() => getVisibleEpisodes(episodes, episodeTabs, activeTab), [episodes, episodeTabs, activeTab])
  const gridSlots = useMemo(() => buildGridSlots(visibleEpisodes), [visibleEpisodes])

  // Handle screen tap
  const handleScreenTap = () => {
    if (isSwiping.current || isDragging || showPaywall || isAdOpen) return
    
    if (showControls) {
      togglePlay()
    } else {
      setShowControls(true)
      hideControlsLater()
    }
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    // Don't play if locked
    if (isCurrentEpisodeLocked) {
      void handleLockedAction()
      return
    }

    if (video.paused) {
      void video.play().catch(() => undefined)
      setIsPlaying(true)
      hideControlsLater()
    } else {
      video.pause()
      setIsPlaying(false)
      clearControlsTimer()
    }
  }

  // Video events
  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video || !video.duration || isDragging) return
    setProgress((video.currentTime / video.duration) * 100)
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (video) setDuration(video.duration)
  }

  const handleVideoPlay = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsPlaying(true)

    // A keyed video element represents one episode entry. Pause/resume and
    // seeking keep the same node, while switching episodes creates a new one.
    if (isCurrentEpisodeLocked || reportedVideoRef.current === event.currentTarget) return

    reportedVideoRef.current = event.currentTarget
    miniApi.reportWatch(userId, drama.id, currentEpisode).catch((error) => {
      console.error("Failed to report episode watch:", error)
    })
  }

  const handleEnded = () => {
    if (nextEpisodeData) {
      animateToEpisode(nextEpisodeData.episodeNo)
    } else {
      setIsPlaying(false)
      setShowControls(true)
    }
  }

  // Progress bar
  const handleProgressTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    setIsDragging(true)
    clearControlsTimer()
    updateProgressFromTouch(e.touches[0].clientX)
  }

  const handleProgressTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    e.stopPropagation()
    updateProgressFromTouch(e.touches[0].clientX)
  }

  const handleProgressTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return
    e.stopPropagation()
    setIsDragging(false)
    seekToProgress()
    hideControlsLater()
  }

  const updateProgressFromTouch = (clientX: number) => {
    if (!progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setProgress(percentage)
  }

  const seekToProgress = () => {
    const video = videoRef.current
    if (!video || !video.duration) return
    video.currentTime = (progress / 100) * video.duration
  }

  const handleProgressClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!progressBarRef.current || !videoRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setProgress(percentage)
    videoRef.current.currentTime = (percentage / 100) * videoRef.current.duration
  }

  // Swipe to change episode
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDragging || isAnimating || showPaywall || isAdOpen) return
    touchStartY.current = e.touches[0].clientY
    swipeDistance.current = 0
    isSwiping.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging || isAnimating || showPaywall || isAdOpen) return
    
    const deltaY = touchStartY.current - e.touches[0].clientY
    swipeDistance.current = deltaY
    
    // Check if we can swipe in this direction
    const canSwipeUp = Boolean(nextEpisodeData)
    const canSwipeDown = Boolean(prevEpisode)
    
    if (deltaY > 0 && !canSwipeUp) return
    if (deltaY < 0 && !canSwipeDown) return
    
    if (Math.abs(deltaY) > 5) {
      isSwiping.current = true
      // Keep a little resistance while making the video follow the finger.
      const resistance = 0.72
      const adjustedDelta = deltaY * resistance
      setTranslateY(adjustedDelta)
    }
  }

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
  }

  const handleTouchEnd = () => {
    if (isDragging || isAnimating || showPaywall || isAdOpen) return

    const threshold = Math.min(96, Math.max(64, containerHeight.current * 0.1))
    const distance = swipeDistance.current

    if (Math.abs(distance) >= threshold) {
      if (distance > 0 && nextEpisodeData) {
        animateToEpisode(nextEpisodeData.episodeNo)
      } else if (distance < 0 && prevEpisode) {
        animateToEpisode(prevEpisode.episodeNo)
      } else {
        animateBack()
      }
    } else {
      animateBack()
    }

    if (swipeResetTimerRef.current) clearTimeout(swipeResetTimerRef.current)
    swipeResetTimerRef.current = window.setTimeout(() => {
      isSwiping.current = false
      swipeDistance.current = 0
    }, 50)
  }

  const animateToEpisode = (newEpisode: number) => {
    const direction = newEpisode > currentEpisode ? 1 : -1
    const targetY = direction * containerHeight.current

    clearTransitionTimer()
    setIsAnimating(true)
    setTranslateY(targetY)

    transitionTimerRef.current = window.setTimeout(() => {
      setCurrentEpisode(newEpisode)
      setTranslateY(0)
      setProgress(0)
      setIsAnimating(false)
      transitionTimerRef.current = null
    }, 300)
  }

  const animateBack = () => {
    clearTransitionTimer()
    setIsAnimating(true)
    setTranslateY(0)
    transitionTimerRef.current = window.setTimeout(() => {
      setIsAnimating(false)
      transitionTimerRef.current = null
    }, 300)
  }

  // Select episode from list
  const selectEpisode = (ep: Episode) => {
    setShowEpisodeList(false)
    if (ep.episodeNo !== currentEpisode) {
      setCurrentEpisode(ep.episodeNo)
      setProgress(0)
    }
  }

  // Auto-play on episode change
  useEffect(() => {
    const video = videoRef.current
    const ep = episodes.find(e => e.episodeNo === currentEpisode)
    if (video && !isAnimating && ep?.isUnlocked !== false) {
      video.currentTime = 0
      video.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [currentEpisode, episodes])

  if (!episode) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  const currentTime = videoRef.current?.currentTime || 0

  return (
    <div
      ref={playerRef}
      className={cn(
        "fixed left-0 right-0 top-0 z-50 overflow-hidden bg-black",
        isAndroid && "android-player-viewport"
      )}
      style={isAndroid ? undefined : { height: viewportHeight ? `${viewportHeight}px` : "100dvh" }}
    >
      {/* Videos container - handles swipe */}
      <div
        className="absolute inset-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleScreenTap}
      >
        {/* Previous episode (above) */}
        {prevEpisode?.videoUrl && translateY < 0 && (
          <div 
            className="absolute inset-0"
            style={{
              transform: `translateY(${-containerHeight.current + (-translateY)}px)`,
              transition: isAnimating ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
            }}
          >
            <video
              src={getMediaUrl(prevEpisode.videoUrl)}
              className="h-full w-full object-contain"
              playsInline
              muted
              preload="metadata"
            />
          </div>
        )}

        {/* Current episode */}
        <div 
          className="absolute inset-0"
          style={{
            transform: `translateY(${-translateY}px)`,
            transition: isAnimating ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
          }}
        >
          {episode.videoUrl && (
            <video
              ref={videoRef}
            key={currentEpisode}
            src={getMediaUrl(episode.videoUrl)}
            className="h-full w-full object-contain"
            playsInline
            autoPlay={!isCurrentEpisodeLocked}
            loop={false}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
              onPlay={handleVideoPlay}
              onPause={() => setIsPlaying(false)}
            />
          )}
          
          {/* Locked overlay */}
          {isCurrentEpisodeLocked && !showPaywall && !isAdOpen && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <Lock size={48} className="mb-3 text-white/50" />
              <p className="mb-4 text-[15px] text-white/70">
                {t("player.lockedEpisode", { episode: currentEpisode })}
              </p>
              {isIaa && !canUnlockCurrentEpisodeByAd ? (
                <p className="max-w-xs px-6 text-center text-[14px] leading-6 text-white/50">
                  {t("player.adUnavailable")}
                </p>
              ) : (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleLockedAction()
                  }}
                  disabled={rewardedAd.isStarting}
                  className={cn(
                    "flex min-h-11 items-center justify-center font-semibold text-white shadow-[0_6px_20px_rgba(255,138,52,0.28)] active:bg-[#f47c24] disabled:opacity-60",
                    isIaa
                      ? "mx-6 w-[calc(100%-3rem)] max-w-sm gap-2.5 rounded-xl bg-[#ff8a34] px-4 py-3 text-[15px]"
                      : "rounded-full bg-[#ff8a34] px-6 py-2.5 text-[14px]",
                  )}
                >
                  {rewardedAd.isStarting ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : isIaa ? (
                    <img
                      src="/assets/ad-watch-icon.png"
                      alt=""
                      aria-hidden="true"
                      className="h-7 w-7 object-contain"
                      draggable={false}
                    />
                  ) : null}
                  <span>{t(isIaa ? "player.watchAdToUnlock" : "player.unlockToWatch")}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Next episode (below) */}
        {nextEpisodeData?.videoUrl && translateY > 0 && (
          <div 
            className="absolute inset-0"
            style={{
              transform: `translateY(${containerHeight.current - translateY}px)`,
              transition: isAnimating ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
            }}
          >
            <video
              ref={nextVideoRef}
              src={getMediaUrl(nextEpisodeData.videoUrl)}
              className="h-full w-full object-contain"
              playsInline
              muted
              preload="metadata"
            />
          </div>
        )}
      </div>

      {/* Top bar - 只显示返回按钮，不显示剧名 */}
      <div className={cn(
        "absolute top-0 left-0 right-0 safe-area-top z-20 transition-opacity duration-300",
        showControls && !showPaywall && !isAdOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="flex items-center px-4 pt-2 pb-4">
          <button
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            aria-label={t("common.back")}
            className="flex h-10 w-10 items-center justify-center"
          >
            <ChevronLeft size={28} className="text-white" />
          </button>
        </div>
      </div>

      {/* Center play button when paused */}
      {!isPlaying && !isAnimating && !isCurrentEpisodeLocked && !showPaywall && !isAdOpen && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <Play size={36} className="text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className={cn(
        "absolute left-0 right-0 z-20 transition-all duration-300",
        showControls && !showPaywall && !isAdOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )} style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
        {/* Progress bar */}
        <div className="px-4 mb-2">
          <div className="flex items-center gap-2 text-[11px] text-white/60 mb-1.5">
            <span>{formatTime(currentTime)}</span>
            <span className="flex-1" />
            <span>{formatTime(duration)}</span>
          </div>
          <div
            ref={progressBarRef}
            className="relative h-6 flex items-center cursor-pointer"
            onClick={handleProgressClick}
            onTouchStart={handleProgressTouchStart}
            onTouchMove={handleProgressTouchMove}
            onTouchEnd={handleProgressTouchEnd}
          >
            <div className="absolute inset-x-0 h-[3px] bg-white/30 rounded-full">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div
              className={cn(
                "absolute w-3 h-3 bg-white rounded-full -translate-x-1/2 transition-transform",
                isDragging && "scale-150"
              )}
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        {/* Episode selector button */}
        <div className="px-4 pb-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowEpisodeList(true); }}
            className="flex w-full items-center justify-between rounded-xl border border-[#ff9a3d]/10 bg-[#211d19]/95 px-4 py-3 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-white/70" />
              <span className="text-[14px] text-white">
                {t("player.episodeProgress", {
                  current: currentEpisode,
                  total: episodes.length,
                })}
              </span>
            </div>
            <ChevronUp size={20} className="text-white/50" />
          </button>
        </div>
      </div>

      {showEpisodeList && !isAdOpen && (
        <VideoPlayerEpisodeList
          dramaName={drama.name}
          currentEpisode={currentEpisode}
          episodes={episodes}
          activeTab={activeTab}
          episodeTabs={episodeTabs}
          visibleEpisodes={visibleEpisodes}
          gridSlots={gridSlots}
          onClose={() => setShowEpisodeList(false)}
          onSelectEpisode={selectEpisode}
          onTabChange={setActiveTab}
          t={t}
        />
      )}

      {/* Paywall panel */}
      {showPaywall && !isIaa && (
        <PaywallPanel
          dramaId={drama.id}
          userId={userId}
          currentEpisode={currentEpisode}
          onClose={() => setShowPaywall(false)}
          onPaySuccess={handlePaySuccess}
        />
      )}
      {adErrorMessage && (
        <div className="pointer-events-none absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+20px)] z-40 flex justify-center animate-fade-in">
          <div className="rounded-full border border-white/10 bg-[#25211d]/95 px-4 py-2.5 text-center text-[14px] font-medium text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md">
            {adErrorMessage}
          </div>
        </div>
      )}

      {rewardedAd.session && (
        <RewardedAdOverlay
          remainingSeconds={rewardedAd.remainingSeconds}
          isRewarded={rewardedAd.isRewarded}
          isSubmitting={rewardedAd.isSubmitting}
          showCloseConfirm={rewardedAd.showCloseConfirm}
          onClose={rewardedAd.close}
          onCancel={() => void rewardedAd.cancel()}
          onContinue={rewardedAd.continueWatching}
          onPlaybackStart={rewardedAd.startPlayback}
          onPlaybackPause={rewardedAd.pausePlayback}
          onPlaybackError={() => void handleAdPlaybackError()}
        />
      )}
    </div>
  )
}
