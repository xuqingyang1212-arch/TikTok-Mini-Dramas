import type { Episode } from "./contracts"

const LOCKED_UNLOCK_TYPES = new Set(["locked"])

function parseEpisodeNo(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeEpisodeAccess(episode: Partial<Episode> | null | undefined): Episode {
  if (!episode || typeof episode !== "object") {
    return {
      episodeNo: 0,
      videoUrl: "",
      duration: 0,
      isFree: false,
      isUnlocked: false,
      unlockType: "locked",
    }
  }

  const explicitUnlocked = typeof episode.isUnlocked === "boolean" ? episode.isUnlocked : undefined
  const rawType = episode.unlockType
  const resolvedType = rawType && !LOCKED_UNLOCK_TYPES.has(rawType)
    ? rawType
    : explicitUnlocked === true
      ? "free"
      : "locked"

  const isUnlocked = explicitUnlocked ?? (resolvedType === "free" || resolvedType === "beans" || resolvedType === "subscription" || resolvedType === "ad")
  const longType = rawType && ["free", "beans", "subscription", "ad", "locked"].includes(rawType) ? rawType : resolvedType

  return {
    episodeNo: parseEpisodeNo(episode.episodeNo),
    videoUrl: typeof episode.videoUrl === "string" ? episode.videoUrl : "",
    duration: typeof episode.duration === "number" ? episode.duration : 0,
    isFree: typeof episode.isFree === "boolean" ? episode.isFree : longType === "free",
    isUnlocked: Boolean(isUnlocked) && longType !== "locked",
    unlockType: longType,
    canUnlockByAd: episode.canUnlockByAd === true,
  }
}

export function normalizeEpisodeList(episodes: Array<Partial<Episode> | null | undefined> | undefined): Episode[] {
  if (!Array.isArray(episodes) || episodes.length === 0) return []

  const byEpisodeNo = new Map<number, Episode>()

  for (const episode of episodes) {
    const normalized = normalizeEpisodeAccess(episode)
    if (!normalized || normalized.episodeNo <= 0) continue

    const existing = byEpisodeNo.get(normalized.episodeNo)
    if (!existing) {
      byEpisodeNo.set(normalized.episodeNo, normalized)
      continue
    }

    const isBetterCandidate =
      (normalized.isUnlocked === true && existing.isUnlocked !== true) ||
      (normalized.videoUrl && !existing.videoUrl) ||
      (normalized.duration > existing.duration)

    if (isBetterCandidate) {
      byEpisodeNo.set(normalized.episodeNo, normalized)
    }
  }

  return [...byEpisodeNo.values()].sort((a, b) => a.episodeNo - b.episodeNo)
}

export function getEpisodeByNumber(episodes: Episode[], episodeNo: number): Episode | undefined {
  return episodes.find((episode) => episode.episodeNo === episodeNo)
}

export function getAdjacentEpisodes(episodes: Episode[], currentEpisode: number) {
  const sortedEpisodes = normalizeEpisodeList(episodes)
  const currentIndex = sortedEpisodes.findIndex((episode) => episode.episodeNo === currentEpisode)
  const safeIndex = currentIndex >= 0 ? currentIndex : 0

  return {
    prevEpisode: sortedEpisodes[safeIndex - 1],
    currentEpisodeData: sortedEpisodes[safeIndex],
    nextEpisodeData: sortedEpisodes[safeIndex + 1],
  }
}
