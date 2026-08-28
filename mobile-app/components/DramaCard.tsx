"use client"

import { Play } from "lucide-react"
import { getMediaUrl, type Drama } from "@/lib/api"

interface DramaCardProps {
  drama: Drama
  onClick: () => void
}

export function DramaCard({ drama, onClick }: DramaCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-[#1a1a1a] touch-active transition-transform cursor-pointer"
      onClick={onClick}
    >
      {/* Cover Image - 使用2:3比例匹配封面图原始比例 */}
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {drama.coverUrl ? (
          <img
            src={getMediaUrl(drama.coverUrl)}
            alt={drama.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a]">
            <Play size={32} className="text-white/30" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Info - 最多显示2行 */}
      <div className="px-3 py-2.5">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-[21px] text-white">{drama.name}</h3>
      </div>
    </div>
  )
}
