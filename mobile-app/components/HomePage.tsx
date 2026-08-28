"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DramaCard } from "./DramaCard"
import { miniApi, type Drama } from "@/lib/api"
import { useI18n } from "@/lib/i18n/I18nProvider"

interface HomePageProps {
  appName: string
  initialScrollTop: number
  onScrollPositionChange: (scrollTop: number) => void
  onDramaSelect: (drama: Drama) => void
}

export function HomePage({
  appName,
  initialScrollTop,
  onScrollPositionChange,
  onDramaSelect,
}: HomePageProps) {
  const { t } = useI18n()
  const [dramas, setDramas] = useState<Drama[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const scrollContainerRef = useRef<HTMLElement>(null)
  const hasRestoredScrollRef = useRef(false)

  const fetchDramas = useCallback(async () => {
    try {
      const res = await miniApi.getDramas(1, 50)
      setDramas(res.list || [])
    } catch (err) {
      console.error("Failed to fetch dramas:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDramas()
  }, [fetchDramas])

  // The list is remounted after leaving the full-screen player. Restore only
  // after the cards exist, otherwise the empty loading view clamps scrollTop to 0.
  useEffect(() => {
    if (loading || hasRestoredScrollRef.current) return

    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const container = scrollContainerRef.current
        if (!container) return
        hasRestoredScrollRef.current = true
        container.scrollTop = initialScrollTop
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
    }
  }, [initialScrollTop, loading])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDramas()
  }

  const handleDramaSelect = (drama: Drama) => {
    onScrollPositionChange(scrollContainerRef.current?.scrollTop ?? 0)
    onDramaSelect(drama)
  }

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Header */}
      <header className="sticky top-0 z-20 safe-area-top">
        <div className="flex items-center justify-center px-4 py-3 bg-black/90 backdrop-blur-lg border-b border-white/5">
          <h1 className="text-xl font-bold text-white">{appName}</h1>
        </div>
      </header>

      {/* Content */}
      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto hide-scrollbar pb-20"
        onScroll={(event) => onScrollPositionChange(event.currentTarget.scrollTop)}
      >
        {loading ? (
          <div className="grid grid-cols-2 gap-4 p-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] rounded-xl bg-white/10" />
                <div className="mt-2 h-4 w-3/4 rounded bg-white/10" />
                <div className="mt-1 h-3 w-1/2 rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : dramas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-white/50">{t("home.empty")}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 rounded-full bg-[#ff8a34] px-6 py-2 text-[14px] font-medium text-white active:bg-[#f47c24]"
            >
              {t("home.refresh")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-4">
            {dramas.map((drama) => (
              <DramaCard
                key={drama.id}
                drama={drama}
                onClick={() => handleDramaSelect(drama)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
