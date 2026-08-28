"use client"

import type { KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

export interface FilterInputProps {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  width?: string
  // true 时组件铺满父容器宽度（用于 FilterBar 网格自动对齐场景）
  block?: boolean
}

export function FilterInput({
  label,
  placeholder,
  value,
  onChange,
  onKeyDown,
  width = "w-[148px]",
  block = false,
}: FilterInputProps) {
  return (
    <div className={cn("flex items-center gap-2", block && "w-full")}>
      <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-[30px] rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none transition-colors focus:border-[#38c08f]",
          block ? "min-w-0 flex-1" : width
        )}
      />
    </div>
  )
}
