import { useCallback, useEffect, useRef } from "react"

interface UsePlaybackControlsOptions {
  showControls: boolean
  isPlaying: boolean
  isDragging: boolean
  showPaywall: boolean
  showEpisodeList: boolean
  onAutoHide: () => void
}

export function usePlaybackControls({
  showControls,
  isPlaying,
  isDragging,
  showPaywall,
  showEpisodeList,
  onAutoHide,
}: UsePlaybackControlsOptions) {
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearControlsTimer = useCallback(() => {
    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current)
      controlsTimer.current = null
    }
  }, [])

  const hideControlsLater = useCallback(() => {
    clearControlsTimer()
    controlsTimer.current = setTimeout(() => {
      if (isPlaying && !showEpisodeList && !isDragging && !showPaywall) {
        onAutoHide()
      }
    }, 3000)
  }, [clearControlsTimer, isDragging, isPlaying, onAutoHide, showEpisodeList, showPaywall])

  useEffect(() => {
    if (showControls && isPlaying && !isDragging && !showPaywall) {
      hideControlsLater()
    }
    return () => {
      clearControlsTimer()
    }
  }, [clearControlsTimer, hideControlsLater, isDragging, isPlaying, showControls, showPaywall])

  return {
    controlsTimer,
    clearControlsTimer,
    hideControlsLater,
  }
}
