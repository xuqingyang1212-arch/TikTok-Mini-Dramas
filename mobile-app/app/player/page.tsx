"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AppLoading } from "@/components/AppLoading"
import { VideoPlayer } from "@/components/VideoPlayer"
import { useAuth } from "@/components/AuthProvider"
import { miniApi, type Drama, type Episode } from "@/lib/api"

function parseEpisode(value: string | null) {
  const episode = Number(value)
  return Number.isInteger(episode) && episode > 0 ? episode : 1
}

function PlayerRouteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userData, currentApp, checkingAuth } = useAuth()
  const dramaId = searchParams.get("dramaId")?.trim() || ""
  const requestedEpisode = parseEpisode(searchParams.get("episode"))
  const [drama, setDrama] = useState<Drama | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [paywallEpisode, setPaywallEpisode] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const loadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (checkingAuth || !userData) return
    if (!dramaId) {
      router.replace("/")
      return
    }

    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller
    setLoading(true)
    setLoadFailed(false)

    Promise.all([
      miniApi.getDrama(dramaId, { signal: controller.signal }),
      miniApi.getEpisodes(dramaId, userData.userId, { signal: controller.signal }),
    ])
      .then(([dramaResult, episodeResult]) => {
        if (controller.signal.aborted) return
        setDrama(dramaResult)
        setEpisodes(episodeResult.list || [])
        setPaywallEpisode(episodeResult.paywallEpisode)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error("Failed to load player route:", error)
        setLoadFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [checkingAuth, dramaId, router, userData?.userId])

  const availableEpisode = useMemo(() => {
    if (!episodes.length) return requestedEpisode
    return episodes.some((episode) => episode.episodeNo === requestedEpisode)
      ? requestedEpisode
      : episodes[0].episodeNo
  }, [episodes, requestedEpisode])

  const updateEpisodeUrl = useCallback((episodeNo: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get("episode") === String(episodeNo)) return
    params.set("dramaId", dramaId)
    params.set("episode", String(episodeNo))
    router.replace(`/player?${params.toString()}`, { scroll: false })
  }, [dramaId, router, searchParams])

  if (checkingAuth || !userData || loading) return <AppLoading />

  if (loadFailed || !drama || !episodes.length) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <p className="text-white/65">无法加载播放页面</p>
        <button type="button" onClick={() => router.replace("/")} className="rounded-xl bg-[#ff8a34] px-6 py-3 font-medium text-white">
          返回首页
        </button>
      </div>
    )
  }

  return (
    <VideoPlayer
      drama={drama}
      episodes={episodes}
      initialEpisode={availableEpisode}
      userId={userData.userId}
      monetizationType={currentApp?.monetizationType || userData.monetizationType}
      adPlacementId={currentApp?.adPlacementId ?? userData.adPlacementId}
      appName={currentApp?.name || userData.appName}
      clientKey={currentApp?.clientKey || userData.clientKey || ""}
      openId={userData.openId || ""}
      paywallEpisode={paywallEpisode}
      onBack={() => router.back()}
      onEpisodeChange={updateEpisodeUrl}
      onEpisodesRefresh={setEpisodes}
    />
  )
}

export default function PlayerRoute() {
  return (
    <Suspense fallback={<AppLoading />}>
      <PlayerRouteContent />
    </Suspense>
  )
}
