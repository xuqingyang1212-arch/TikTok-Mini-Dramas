"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PromotionSelectOption {
  value: string
  label: string
  extra?: ReactNode
}

export function PromotionOptionSelect({
  label,
  value,
  placeholder,
  options,
  required,
  searchable = false,
  searchPlaceholder = "搜索",
  searchDebounceMs = 300,
  loading = false,
  onSearch,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  options: PromotionSelectOption[]
  required?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  searchDebounceMs?: number
  loading?: boolean
  onSearch?: (keyword: string) => void
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const composingRef = useRef(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSearchRef = useRef(onSearch)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
  }, [])

  function scheduleSearch(next: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      onSearchRef.current?.(next)
    }, searchDebounceMs)
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}{required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex h-[34px] items-center justify-between rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] outline-none focus:border-[#38c08f]">
        <span className={cn("flex min-w-0 items-center gap-2 truncate", !selected && "text-[#9ca3af]")}>{selected?.label ?? placeholder}{selected?.extra}</span>
        <ChevronDown size={15} className="shrink-0 text-[#9ca3af]" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[6px] border border-[#e5e7eb] bg-white p-1.5 shadow-lg">
          {searchable && (
            <input
              autoFocus
              value={keyword}
              onChange={(event) => {
                const next = event.target.value
                setKeyword(next)
                if (!composingRef.current) scheduleSearch(next)
              }}
              onCompositionStart={() => { composingRef.current = true }}
              onCompositionEnd={(event) => {
                composingRef.current = false
                const next = event.currentTarget.value
                setKeyword(next)
                scheduleSearch(next)
              }}
              placeholder={searchPlaceholder}
              className="mb-1.5 h-8 w-full rounded-[5px] border border-[#d1d5db] px-2.5 text-[12.5px] outline-none placeholder:text-[#9ca3af] focus:border-[#38c08f]"
            />
          )}
          <div className="max-h-56 overflow-y-auto">
            {loading ? <div className="px-2 py-3 text-center text-[12px] text-[#9ca3af]">加载中...</div> : options.length === 0 ? <div className="px-2 py-3 text-center text-[12px] text-[#9ca3af]">暂无数据</div> : options.map((option) => (
              <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false) }} className="flex w-full items-center justify-between rounded-[5px] px-2 py-2 text-left text-[13px] text-[#374151] hover:bg-[#f3faf7]">
                <span className="flex min-w-0 items-center gap-2 truncate">{option.label}{option.extra}</span>
                {option.value === value && <Check size={14} className="shrink-0 text-[#13a673]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
