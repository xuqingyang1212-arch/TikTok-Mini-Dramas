"use client"

import { cn } from "@/lib/utils"
import { VipDiamondIcon, type VipTheme } from "./VipDiamondIcon"

export interface VipOption {
  /** Subscription planId from API. */
  planId: string
  period: "weekly" | "monthly" | "quarterly" | "half_yearly" | "yearly"
  title: string
  description: string
  /** Display price already in dollars (e.g. 19.99). */
  price: number
  theme: VipTheme
  /** Whether to use the emphasized card treatment. */
  recommended?: boolean
}

interface VipOptionCardProps {
  option: VipOption
  onSelect: (option: VipOption) => void
}

/** Split a price into integer "$19" and fractional ".99" parts for display. */
function splitPrice(price: number) {
  const fixed = price.toFixed(2)
  const [intPart, decPart] = fixed.split(".")
  return { intPart, decPart }
}

/**
 * A single VIP subscription card.
 * Layout: [diamond icon] [title + description] .......... [price right-aligned]
 * All three regions are vertically centered; price never overlaps the description.
 */
export function VipOptionCard({ option, onSelect }: VipOptionCardProps) {
  const { intPart, decPart } = splitPrice(option.price)

  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={cn(
        "vip-card relative flex w-full items-center gap-3 overflow-hidden rounded-[18px] px-4 py-3.5",
        "text-left transition-transform active:scale-[0.98]",
        `vip-card--${option.theme}`,
        option.recommended && "vip-card--recommended",
      )}
    >
      {/* Left: diamond icon */}
      <span className="relative flex-shrink-0">
        <VipDiamondIcon
          theme={option.theme}
          crown
          className="h-12 w-12 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
        />
      </span>

      {/* Middle: title + description */}
      <span className="relative flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-[18px] font-bold text-white">{option.title}</span>
        <span
          className={cn(
            "mt-0.5 truncate text-[14px]",
            option.recommended ? "text-white/85" : "text-white/55",
          )}
        >
          {option.description}
        </span>
      </span>

      {/* Right: price */}
      <span className="relative flex flex-shrink-0 items-baseline whitespace-nowrap font-bold text-white">
        <span className="text-[26px] leading-none">${intPart}</span>
        <span className="text-[16px] leading-none">.{decPart}</span>
      </span>
    </button>
  )
}
