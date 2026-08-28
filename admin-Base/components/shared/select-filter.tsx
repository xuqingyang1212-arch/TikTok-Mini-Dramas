"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  label: string
  value: string
}

export interface SelectFilterProps {
  label?: string
  options: SelectOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: string | number
  // true 时组件铺满父容器宽度（用于 FilterBar 网格自动对齐场景）
  block?: boolean
}

export function SelectFilter({
  label,
  options,
  value,
  onChange,
  placeholder = "请选择",
  width = "w-[120px]",
  block = false,
}: SelectFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const widthStyle = !block && typeof width === "number" ? { width } : undefined
  const widthClass = block ? "w-full" : typeof width === "string" ? width : undefined

  const dropdown = (
    <div className={cn("relative", block && "min-w-0 flex-1")} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={widthStyle}
        className={cn(
          "flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
          open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
          selected ? "text-[#374151]" : "text-[#9ca3af]",
          widthClass
        )}
      >
        <span className="flex-1 truncate text-left">{selected ? selected.label : placeholder}</span>
        {value ? (
          <X
            size={11}
            className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false) }}
          />
        ) : (
          <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-[34px] z-50 min-w-full rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                "flex w-full items-center px-3 py-2 text-[13px] transition-colors whitespace-nowrap hover:bg-[#f0fdf4]",
                value === opt.value ? "text-[#38c08f] font-medium" : "text-[#374151]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  if (!label) return dropdown

  return (
    <div className={cn("flex items-center gap-2", block && "w-full")}>
      <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>
      {dropdown}
    </div>
  )
}
