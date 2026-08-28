"use client"

import { cn } from "@/lib/utils"

export interface BeansOption {
  /** Tier key from API (next5 / next10 / next20 / all). */
  key: string
  /** Beans amount, e.g. 500. */
  amount: number
  /** Unlock description, e.g. "解锁5集". */
  description: string
}

interface BeansOptionCardProps {
  option: BeansOption
  onSelect: (option: BeansOption) => void
}

/**
 * A single Beans unlock tier card.
 * Content is a vertically + horizontally centered group:
 * beans icon, "{amount} Beans" title, unlock description subtitle.
 * Uses the fixed brand beans.png (never recolored / filtered / redrawn).
 */
export function BeansOptionCard({ option, onSelect }: BeansOptionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={cn(
        "beans-card group relative flex h-full min-h-[92px] w-full flex-col items-center justify-center",
        "rounded-[18px] px-3 py-4 text-center transition-transform active:scale-[0.97]",
      )}
    >
      {/* soft top highlight */}
      <span className="beans-card__sheen" aria-hidden="true" />
      {/* faint star sparkles */}
      <span className="beans-card__stars" aria-hidden="true" />

      <span className="relative flex items-center justify-center gap-1.5">
        <img
          src="/beans.png"
          alt="Beans"
          className="h-6 w-6 object-contain"
          draggable={false}
        />
        <span className="text-[20px] font-bold leading-none text-white">
          {option.amount} Beans
        </span>
      </span>
      <span className="relative mt-2 text-[13px] font-medium text-white/55">
        {option.description}
      </span>
    </button>
  )
}
