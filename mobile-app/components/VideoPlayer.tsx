"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Play, ChevronLeft, ChevronUp, Layers, Lock, LockKeyhole } from "lucide-react"
import { cn } from "@/lib/utils"
import { getMediaUrl, miniApi, type Episode, type Drama } from "@/lib/api"
import { useI18n } from "@/lib/i18n/I18nProvider"
import { PaywallPanel } from "./PaywallPanel"

interface VideoPlayerProps {
  drama: Drama
  episodes: Episode[]
  initialEpisode?: number
  userId: string
  onBack: () => void
  onEpisodesRefresh?: (episodes: Episode[]) => void
}

export function VideoPlayer({
  drama,
  episodes: initialEpisodes,
  initialEpisode = 1,
  userId,
  onBack,
  onEpisodesRefresh,
}: VideoPlayerProps) {
  const { t } = useI18n()
  const [episodes, setEpisodes] = useState(initialEpisodes)
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [showEpisodeList, setShowEpisodeList] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [showUnlockSequenceTip, setShowUnlockSequenceTip] = useState(false)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const [isAndroid, setIsAndroid] = useState(false)
  
  // Swipe state
  const [translateY, setTranslateY] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const nextVideoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const swipeDistance = useRef(0)
  const controlsTimer = useRef<NodeJS.Timeout | null>(null)
  const unlockSequenceTipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSwiping = useRef(false)
  const containerHeight = useRef(0)
  const reportedVideoRef = useRef<HTMLVideoElement | null>(null)

  const episode = episodes.find((e) => e.episodeNo === currentEpisode)
  const prevEpisode = episodes.find((e) => e.episodeNo === currentEpisode - 1)
  const nextEpisodeData = episodes.find((e) => e.episodeNo === currentEpisode + 1)

  // Only the first locked episode can be opened from the episode list.
  const firstLockedEpisodeNo = useMemo(() => {
    const lockedEpisodes = episodes.filter((ep) => ep.isUnlocked === false)
    if (lockedEpisodes.length === 0) return null
    return Math.min(...lockedEpisodes.map((ep) => ep.episodeNo))
  }, [episodes])

  // Check if current episode is locked
  const isCurrentEpisodeLocked = episode && episode.isUnlocked === false

  // Show paywall when hitting locked episode
  useEffect(() => {
    if (isCurrentEpisodeLocked) {
      setShowPaywall(true)
      setIsPlaying(false)
      videoRef.current?.pause()
    }
  }, [isCurrentEpisodeLocked, currentEpisode])

  // Refresh episodes after payment
  const handlePaySuccess = async () => {
    try {
      const res = await miniApi.getEpisodes(drama.id, userId)
      setEpisodes(res.list || [])
      onEpisodesRefresh?.(res.list || [])
      setShowPaywall(false)
      // Resume playing
      setTimeout(() => {
        videoRef.current?.play()
        setIsPlaying(true)
      }, 100)
    } catch (err) {
      console.error("Failed to refresh episodes:", err)
      setShowPaywall(false)
    }
  }

  // Calculate tabs for episode list (30 episodes per tab)
  const episodeTabs = useMemo(() => {
    const tabs: { label: string; start: number; end: number }[] = []
    const total = episodes.length
    const perTab = 30
    
    if (total <= perTab) {
      return [] // No tabs needed
    }
    
    for (let i = 0; i < total; i += perTab) {
      const start = i + 1
      const end = Math.min(i + perTab, total)
      tabs.push({ label: `${start}-${end}`, start, end })
    }
    return tabs
  }, [episodes.length])

  // Set initial active tab based on current episode
  useEffect(() => {
    if (episodeTabs.length > 0) {
      const tabIndex = Math.floor((currentEpisode - 1) / 30)
      setActiveTab(tabIndex)
    }
  }, [showEpisodeList])

  // Get episodes for current tab
  const visibleEpisodes = useMemo(() => {
    if (episodeTabs.length === 0) {
      return episodes
    }
    const tab = episodeTabs[activeTab]
    if (!tab) return episodes
    return episodes.filter(ep => ep.episodeNo >= tab.start && ep.episodeNo <= tab.end)
  }, [episodes, episodeTabs, activeTab])

  // 固定显示30个格子的占位数组（用于保持弹窗高度一致）
  const gridSlots = useMemo(() => {
    const slots: (Episode | null)[] = []
    // 始终创建30个槽位
    for (let i = 0; i < 30; i++) {
      const ep = visibleEpisodes[i]
      slots.push(ep || null)
    }
    return slots
  }, [visibleEpisodes])

  // Keep non-Android browsers inside the live visual viewport. Some Android
  // browsers report the toolbar as an overlay, so they use 100svh instead.
  useEffect(() => {
    let animationFrame: number | null = null
    const visualViewport = window.visualViewport
    const android = /Android/i.test(window.navigator.userAgent)

    setIsAndroid(android)

    const syncViewportHeight = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        if (android) {
          setViewportHeight(null)
          return
        }

        const nextHeight = Math.round(visualViewport?.height ?? window.innerHeight)
        if (nextHeight <= 0) return

        setViewportHeight((currentHeight) =>
          currentHeight === nextHeight ? currentHeight : nextHeight
        )
      })
    }

    syncViewportHeight()
    visualViewport?.addEventListener("resize", syncViewportHeight)
    visualViewport?.addEventListener("scroll", syncViewportHeight)
    window.addEventListener("resize", syncViewportHeight)
    window.addEventListener("orientationchange", syncViewportHeight)

    return () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      visualViewport?.removeEventListener("resize", syncViewportHeight)
      visualViewport?.removeEventListener("scroll", syncViewportHeight)
      window.removeEventListener("resize", syncViewportHeight)
      window.removeEventListener("orientationchange", syncViewportHeight)
    }
  }, [])

  // Swipe distance must match the rendered player height, especially when
  // Android's small viewport differs from visualViewport.height.
  useEffect(() => {
    let animationFrame: number | null = null

    const syncContainerHeight = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const nextHeight = playerRef.current?.clientHeight ?? 0
        if (nextHeight > 0) containerHeight.current = nextHeight
      })
    }

    syncContainerHeight()

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(syncContainerHeight)
      : null

    if (playerRef.current) resizeObserver?.observe(playerRef.current)
    window.visualViewport?.addEventListener("resize", syncContainerHeight)
    window.visualViewport?.addEventListener("scroll", syncContainerHeight)
    window.addEventListener("resize", syncContainerHeight)
    window.addEventListener("orientationchange", syncContainerHeight)

    return () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.visualViewport?.removeEventListener("resize", syncContainerHeight)
      window.visualViewport?.removeEventListener("scroll", syncContainerHeight)
      window.removeEventListener("resize", syncContainerHeight)
      window.removeEventListener("orientationchange", syncContainerHeight)
    }
  }, [isAndroid, viewportHeight])

  // Auto-hide controls after 3s
  const hideControlsLater = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => {
      if (isPlaying && !showEpisodeList && !isDragging && !showPaywall) {
        setShowControls(false)
      }
    }, 3000)
  }, [isPlaying, showEpisodeList, isDragging, showPaywall])

  useEffect(() => {
    if (showControls && isPlaying && !isDragging && !showPaywall) {
      hideControlsLater()
    }
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current)
    }
  }, [showControls, isPlaying, isDragging, hideControlsLater, showPaywall])

  useEffect(() => {
    return () => {
      if (unlockSequenceTipTimer.current) clearTimeout(unlockSequenceTipTimer.current)
    }
  }, [])

  // Handle screen tap
  const handleScreenTap = () => {
    if (isSwiping.current || isDragging || showPaywall) return
    
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
      setShowPaywall(true)
      return
    }

    if (video.paused) {
      video.play()
      setIsPlaying(true)
      hideControlsLater()
    } else {
      video.pause()
      setIsPlaying(false)
      if (controlsTimer.current) clearTimeout(controlsTimer.current)
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
    if (currentEpisode < episodes.length) {
      animateToEpisode(currentEpisode + 1)
    } else {
      setIsPlaying(false)
      setShowControls(true)
    }
  }

  // Progress bar
  const handleProgressTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    setIsDragging(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
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
    if (isDragging || isAnimating || showPaywall) return
    touchStartY.current = e.touches[0].clientY
    swipeDistance.current = 0
    isSwiping.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging || isAnimating || showPaywall) return
    
    const deltaY = touchStartY.current - e.touches[0].clientY
    swipeDistance.current = deltaY
    
    // Check if we can swipe in this direction
    const canSwipeUp = currentEpisode < episodes.length
    const canSwipeDown = currentEpisode > 1
    
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

  const handleTouchEnd = () => {
    if (isDragging || isAnimating || showPaywall) return

    // Use the real finger travel instead of the resisted visual distance.
    // Around 10% of the viewport feels deliberate without requiring a long drag.
    const threshold = Math.min(96, Math.max(64, containerHeight.current * 0.1))
    const distance = swipeDistance.current
    
    if (Math.abs(distance) >= threshold) {
      if (distance > 0 && currentEpisode < episodes.length) {
        // Swipe up - next episode
        animateToEpisode(currentEpisode + 1)
      } else if (distance < 0 && currentEpisode > 1) {
        // Swipe down - previous episode
        animateToEpisode(currentEpisode - 1)
      } else {
        // Snap back
        animateBack()
      }
    } else {
      // Snap back
      animateBack()
    }
    
    setTimeout(() => {
      isSwiping.current = false
      swipeDistance.current = 0
    }, 50)
  }

  const animateToEpisode = (newEpisode: number) => {
    const direction = newEpisode > currentEpisode ? 1 : -1
    const targetY = direction * containerHeight.current
    
    setIsAnimating(true)
    setTranslateY(targetY)
    
    setTimeout(() => {
      setCurrentEpisode(newEpisode)
      setTranslateY(0)
      setProgress(0)
      setIsAnimating(false)
    }, 300)
  }

  const animateBack = () => {
    setIsAnimating(true)
    setTranslateY(0)
    setTimeout(() => {
      setIsAnimating(false)
    }, 300)
  }

  // Select episode from list
  const selectEpisode = (ep: Episode) => {
    const isLockedAfterNextUnlock =
      ep.isUnlocked === false &&
      firstLockedEpisodeNo !== null &&
      ep.episodeNo > firstLockedEpisodeNo

    if (isLockedAfterNextUnlock) {
      setShowUnlockSequenceTip(true)
      if (unlockSequenceTipTimer.current) clearTimeout(unlockSequenceTipTimer.current)
      unlockSequenceTipTimer.current = setTimeout(() => {
        setShowUnlockSequenceTip(false)
      }, 2400)
      return
    }

    setShowUnlockSequenceTip(false)
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!episode) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  const currentTime = videoRef.current?.currentTime || 0
  
  // 固定容纳 30 集；最后一个不足 30 集的分页也保持相同高度。
  const hasTabs = episodeTabs.length > 0
  const headerHeight = 60
  const tabsHeight = hasTabs ? 44 : 0
  const gridHeight = 6 * 44 + 5 * 10 // 6行按钮(h-11=44px) + 5个间隙(gap-2.5=10px) = 314px
  const paddingHeight = 32
  const drawerHeight = headerHeight + tabsHeight + gridHeight + paddingHeight

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
        {prevEpisode && translateY < 0 && (
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
          
          {/* Locked overlay */}
          {isCurrentEpisodeLocked && !showPaywall && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <Lock size={48} className="text-white/50 mb-3" />
              <p className="text-white/70 text-[15px] mb-4">
                {t("player.lockedEpisode", { episode: currentEpisode })}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowPaywall(true); }}
                className="rounded-full bg-[#ff8a34] px-6 py-2.5 text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(255,138,52,0.28)] active:bg-[#f47c24]"
              >
                {t("player.unlockToWatch")}
              </button>
            </div>
          )}
        </div>

        {/* Next episode (below) */}
        {nextEpisodeData && translateY > 0 && (
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
        showControls && !showPaywall ? "opacity-100" : "opacity-0 pointer-events-none"
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
      {!isPlaying && !isAnimating && !isCurrentEpisodeLocked && !showPaywall && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <Play size={36} className="text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className={cn(
        "absolute left-0 right-0 z-20 transition-all duration-300",
        showControls && !showPaywall ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
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

      {/* Episode list drawer */}
      {showEpisodeList && (
        <div
          className="absolute inset-0 bg-black/60 z-30"
          onClick={() => setShowEpisodeList(false)}
        >
          {showUnlockSequenceTip && (
            <div
              className="pointer-events-none absolute left-4 right-4 z-40 flex justify-center animate-fade-in"
              style={{ bottom: `calc(${drawerHeight}px + env(safe-area-inset-bottom, 0px) + 14px)` }}
            >
              <div className="flex max-w-[360px] items-center gap-2 rounded-xl border border-[#ff9a3d]/25 bg-[#251e18]/95 px-4 py-3 text-[14px] leading-5 text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.42)] backdrop-blur-md">
                <LockKeyhole size={18} className="flex-shrink-0 text-[#f6a240]" />
                <span>{t("player.unlockSequenceTip")}</span>
              </div>
            </div>
          )}

          <div
            className="absolute bottom-0 left-0 right-0 animate-slide-up rounded-t-2xl border-t border-[#ff9a3d]/15 bg-[#16130f] shadow-[0_-12px_36px_rgba(0,0,0,0.45)]"
            style={{ 
              height: `calc(${drawerHeight}px + env(safe-area-inset-bottom, 0px))`,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - 剧名缩略，总集数靠右完整显示 */}
            <div className="flex items-center justify-between px-4 border-b border-white/10" style={{ height: `${headerHeight}px` }}>
              <h3 className="mr-3 min-w-0 flex-1 truncate text-[18px] font-semibold text-white">{drama.name}</h3>
              <span className="flex-shrink-0 whitespace-nowrap text-[15px] font-medium text-white/55">
                {t("player.totalEpisodes", { count: episodes.length })}
              </span>
            </div>

            {/* Tabs - only show if more than 30 episodes */}
            {hasTabs && (
              <div className="flex items-center gap-5 border-b border-white/5 px-4" style={{ height: `${tabsHeight}px` }}>
                {episodeTabs.map((tab, index) => (
                  <button
                    key={tab.label}
                    onClick={() => setActiveTab(index)}
                    className={cn(
                      "relative py-2 text-[15px] transition-colors",
                      activeTab === index
                        ? "text-white font-medium"
                        : "text-white/40"
                    )}
                  >
                    {tab.label}
                    {activeTab === index && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#ff8a34]" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Episode grid - 固定6行30格，不滚动 */}
            <div className="p-4" style={{ height: `${gridHeight + paddingHeight}px` }}>
              <div className="grid grid-cols-5 gap-2.5">
                {gridSlots.map((ep, index) => (
                  ep ? (
                    <button
                      key={ep.episodeNo}
                      onClick={() => selectEpisode(ep)}
                      className={cn(
                        "relative flex h-11 items-center justify-center rounded-lg text-[15px] font-semibold transition-all",
                        ep.episodeNo === currentEpisode
                          ? "border border-[#ff9a3d]/55 bg-[#ff8a34]/16 text-[#ff9a3d] shadow-[inset_0_0_14px_rgba(255,138,52,0.08)]"
                          : ep.isUnlocked === false
                          ? "border border-[#ff9a3d]/16 bg-gradient-to-br from-[#2a241e] to-[#211d19] text-white/55 active:border-[#ff9a3d]/35"
                          : "border border-transparent bg-[#26221e] text-white/80 active:bg-[#332c25]"
                      )}
                    >
                      {ep.isUnlocked === false ? (
                        <span className="flex flex-col items-center justify-center gap-0.5 leading-none">
                          <LockKeyhole
                            size={16}
                            strokeWidth={2.4}
                            className="text-[#f6a240] drop-shadow-[0_1px_5px_rgba(246,162,64,0.28)]"
                          />
                          <span className="text-[12px] font-semibold text-white/60">{ep.episodeNo}</span>
                        </span>
                      ) : ep.episodeNo === currentEpisode ? (
                        <div className="flex items-center gap-0.5">
                          <div className="flex gap-[2px] items-end">
                            <span className="h-3 w-[3px] animate-pulse rounded-full bg-[#ff8a34]" />
                            <span className="h-4 w-[3px] animate-pulse rounded-full bg-[#ff8a34]" style={{ animationDelay: '150ms' }} />
                            <span className="h-2.5 w-[3px] animate-pulse rounded-full bg-[#ff8a34]" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      ) : (
                        ep.episodeNo
                      )}
                    </button>
                  ) : (
                    <div key={`empty-${index}`} className="h-11 rounded-lg" />
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paywall panel */}
      {showPaywall && (
        <PaywallPanel
          dramaId={drama.id}
          userId={userId}
          currentEpisode={currentEpisode}
          onClose={() => setShowPaywall(false)}
          onPaySuccess={handlePaySuccess}
        />
      )}
    </div>
  )
}
