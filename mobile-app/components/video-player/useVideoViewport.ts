import { useEffect, useRef, useState } from "react"

export function useVideoViewport(playerRef: React.RefObject<HTMLDivElement | null>) {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const [isAndroid, setIsAndroid] = useState(false)
  const containerHeight = useRef(0)

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
          currentHeight === nextHeight ? currentHeight : nextHeight,
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
  }, [isAndroid, viewportHeight, playerRef])

  return { isAndroid, viewportHeight, containerHeight }
}
