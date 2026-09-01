import type { Episode } from "@/lib/api"

export interface EpisodeTab {
  label: string
  start: number
  end: number
}

export function resolveEpisodeSelection(episodes: Episode[], preferredEpisode: number): number {
  if (!episodes.length) return preferredEpisode

  const boundedEpisode = Math.min(Math.max(preferredEpisode, 1), episodes.at(-1)?.episodeNo ?? preferredEpisode)
  return episodes.some((episode) => episode.episodeNo === boundedEpisode)
    ? boundedEpisode
    : episodes[0].episodeNo
}

export function computeEpisodeTabs(episodes: Episode[], perTab = 30): EpisodeTab[] {
  const total = episodes.length
  if (total <= perTab) return []

  const tabs: EpisodeTab[] = []
  for (let index = 0; index < total; index += perTab) {
    const start = index + 1
    const end = Math.min(index + perTab, total)
    tabs.push({ label: `${start}-${end}`, start, end })
  }
  return tabs
}

export function getVisibleEpisodes(episodes: Episode[], episodeTabs: EpisodeTab[], activeTab: number): Episode[] {
  if (!episodeTabs.length) return episodes

  const tab = episodeTabs[activeTab]
  if (!tab) return episodes

  return episodes.filter((episode) => episode.episodeNo >= tab.start && episode.episodeNo <= tab.end)
}

export function buildGridSlots(visibleEpisodes: Episode[], slotCount = 30): Array<Episode | null> {
  const slots: Array<Episode | null> = []
  for (let index = 0; index < slotCount; index += 1) {
    slots.push(visibleEpisodes[index] ?? null)
  }
  return slots
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"

  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}
