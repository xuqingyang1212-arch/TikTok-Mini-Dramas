import { ChevronUp, LockKeyhole } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Episode } from "@/lib/api"
import type { TranslationKey, TranslationParams } from "@/lib/i18n/messages"

interface EpisodeTab {
  label: string
  start: number
  end: number
}

interface VideoPlayerEpisodeListProps {
  dramaName: string
  currentEpisode: number
  episodes: Episode[]
  activeTab: number
  episodeTabs: EpisodeTab[]
  visibleEpisodes: Episode[]
  gridSlots: Array<Episode | null>
  showUnlockSequenceTip: boolean
  onClose: () => void
  onSelectEpisode: (episode: Episode) => void
  onTabChange: (index: number) => void
  t: (key: TranslationKey, values?: TranslationParams) => string
}

export function VideoPlayerEpisodeList({
  dramaName,
  currentEpisode,
  episodes,
  activeTab,
  episodeTabs,
  visibleEpisodes,
  gridSlots,
  showUnlockSequenceTip,
  onClose,
  onSelectEpisode,
  onTabChange,
  t,
}: VideoPlayerEpisodeListProps) {
  const hasTabs = episodeTabs.length > 0
  const headerHeight = 60
  const tabsHeight = hasTabs ? 44 : 0
  const gridHeight = 6 * 44 + 5 * 10
  const paddingHeight = 32
  const drawerHeight = headerHeight + tabsHeight + gridHeight + paddingHeight

  return (
    <div
      className="absolute inset-0 bg-black/60 z-30"
      onClick={onClose}
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
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 border-b border-white/10" style={{ height: `${headerHeight}px` }}>
          <h3 className="mr-3 min-w-0 flex-1 truncate text-[18px] font-semibold text-white">{dramaName}</h3>
          <span className="flex-shrink-0 whitespace-nowrap text-[15px] font-medium text-white/55">
            {t("player.totalEpisodes", { count: episodes.length })}
          </span>
        </div>

        {hasTabs && (
          <div className="flex items-center gap-5 border-b border-white/5 px-4" style={{ height: `${tabsHeight}px` }}>
            {episodeTabs.map((tab, index) => (
              <button
                key={tab.label}
                onClick={() => onTabChange(index)}
                className={cn(
                  "relative py-2 text-[15px] transition-colors",
                  activeTab === index ? "text-white font-medium" : "text-white/40",
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

        <div className="p-4" style={{ height: `${gridHeight + paddingHeight}px` }}>
          <div className="grid grid-cols-5 gap-2.5">
            {gridSlots.map((episode, index) => (
              episode ? (
                <button
                  key={episode.episodeNo}
                  onClick={() => onSelectEpisode(episode)}
                  className={cn(
                    "relative flex h-11 items-center justify-center rounded-lg text-[15px] font-semibold transition-all",
                    episode.episodeNo === currentEpisode
                      ? "border border-[#ff9a3d]/55 bg-[#ff8a34]/16 text-[#ff9a3d] shadow-[inset_0_0_14px_rgba(255,138,52,0.08)]"
                      : episode.isUnlocked === false
                        ? "border border-[#ff9a3d]/16 bg-gradient-to-br from-[#2a241e] to-[#211d19] text-white/55 active:border-[#ff9a3d]/35"
                        : "border border-transparent bg-[#26221e] text-white/80 active:bg-[#332c25]",
                  )}
                >
                  {episode.isUnlocked === false ? (
                    <span className="flex flex-col items-center justify-center gap-0.5 leading-none">
                      <LockKeyhole
                        size={16}
                        strokeWidth={2.4}
                        className="text-[#f6a240] drop-shadow-[0_1px_5px_rgba(246,162,64,0.28)]"
                      />
                      <span className="text-[12px] font-semibold text-white/60">{episode.episodeNo}</span>
                    </span>
                  ) : episode.episodeNo === currentEpisode ? (
                    <div className="flex items-center gap-0.5">
                      <div className="flex gap-[2px] items-end">
                        <span className="h-3 w-[3px] animate-pulse rounded-full bg-[#ff8a34]" />
                        <span className="h-4 w-[3px] animate-pulse rounded-full bg-[#ff8a34]" style={{ animationDelay: "150ms" }} />
                        <span className="h-2.5 w-[3px] animate-pulse rounded-full bg-[#ff8a34]" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  ) : (
                    episode.episodeNo
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
  )
}
