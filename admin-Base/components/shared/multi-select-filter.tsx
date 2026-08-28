"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SelectOption } from "./select-filter"

export interface MultiSelectFilterProps {
  label?: string
  options: SelectOption[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  width?: string | number
  maxTagCount?: number
}

export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  placeholder = "请选择",
  width = "w-[180px]",
  maxTagCount = 2,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const widthStyle = typeof width === "number" ? { width } : undefined
  const widthClass = typeof width === "string" ? width : undefined

  const selected = options.filter((o) => value.includes(o.value))
  const hasValue = selected.length > 0

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v))
    else onChange([...value, v])
  }

  function displaySummary() {
    if (!hasValue) return placeholder
    if (selected.length <= maxTagCount) return selected.map((o) => o.label).join("、")
    return `${selected.slice(0, maxTagCount).map((o) => o.label).join("、")} +${selected.length - maxTagCount}`
  }

  const dropdown = (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={widthStyle}
        className={cn(
          "flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
          open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
          hasValue ? "text-[#374151]" : "text-[#9ca3af]",
          widthClass
        )}
      >
        <span className="flex-1 truncate text-left">{displaySummary()}</span>
        {hasValue ? (
          <X
            size={11}
            className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
            onClick={(e) => { e.stopPropagation(); onChange([]); setOpen(false) }}
          />
        ) : (
          <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-[34px] z-50 min-w-full rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
          {options.map((opt) => {
            const checked = value.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors whitespace-nowrap hover:bg-[#f0fdf4]",
                  checked ? "text-[#38c08f] font-medium" : "text-[#374151]"
                )}
              >
                <span
                  className={cn(
                    "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border",
                    checked
                      ? "border-[#38c08f] bg-[#38c08f] text-white"
                      : "border-[#d1d5db] bg-white"
                  )}
                >
                  {checked && <Check size={10} strokeWidth={3} />}
                </span>
                <span className="flex-1 text-left">{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  if (!label) return dropdown

  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>
      {dropdown}
    </div>
  )
}
