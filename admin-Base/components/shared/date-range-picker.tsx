"use client"

import { useState, useRef, useEffect } from "react"
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"]
const MONTHS_CN = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfWeek(year: number, month: number) { return new Date(year, month, 1).getDay() }
function padDate(n: number) { return String(n).padStart(2, "0") }
function toDateStr(year: number, month: number, day: number) { return `${year}-${padDate(month + 1)}-${padDate(day)}` }

interface MonthPanelProps {
  year: number
  month: number
  hoverDate: string
  startDate: string
  endDate: string
  onDayClick: (d: string) => void
  onDayHover: (d: string) => void
}

function MonthPanel({ year, month, hoverDate, startDate, endDate, onDayClick, onDayHover }: MonthPanelProps) {
  const days = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const cells: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({ length: days }, (_, i) => i + 1))
  while (cells.length % 7 !== 0) cells.push(null)
  return (
    <div className="w-[216px]">
      <div className="mb-2 flex items-center justify-center">
        <span className="text-[13px] font-medium text-[#111827]">{year}年 {MONTHS_CN[month]}</span>
      </div>
      <div className="grid grid-cols-7">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="flex h-7 items-center justify-center text-[11px] text-[#9ca3af]">{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-7" />
          const d = toDateStr(year, month, day)
          const isStart = d === startDate
          const isEnd = d === endDate
          const rangeEnd = endDate || (startDate && hoverDate > startDate ? hoverDate : "")
          const inRange = !!(startDate && rangeEnd && d > startDate && d < rangeEnd && !isStart && !isEnd)
          return (
            <div
              key={idx}
              className={cn(
                "flex h-7 cursor-pointer items-center justify-center text-[12.5px] rounded-[3px] transition-colors",
                isStart || isEnd ? "bg-[#38c08f] text-white font-semibold"
                  : inRange ? "bg-[#d1f5e9] text-[#059669]"
                    : "text-[#374151] hover:bg-[#f0fdf4] hover:text-[#38c08f]"
              )}
              onClick={() => onDayClick(d)}
              onMouseEnter={() => onDayHover(d)}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type DateRangeValue = [string, string] | []

export interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (v: DateRangeValue) => void
  label?: string
  placeholder?: string
  triggerWidth?: string
  // true 时组件铺满父容器宽度（用于 FilterBar 网格自动对齐场景）
  block?: boolean
}

export function DateRangePicker({
  value,
  onChange,
  label,
  placeholder = "请选择日期范围",
  triggerWidth = "w-[236px]",
  block = false,
}: DateRangePickerProps) {
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [leftYear, setLeftYear] = useState(today.getFullYear())
  const [leftMonth, setLeftMonth] = useState(today.getMonth() === 0 ? 0 : today.getMonth() - 1)
  const [hoverDate, setHoverDate] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1
  const startDate = (value as string[])[0] ?? ""
  const endDate = (value as string[])[1] ?? ""

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleDayClick(d: string) {
    if (!startDate || (startDate && endDate)) {
      onChange([d, ""] as unknown as [string, string])
    } else {
      onChange(d < startDate ? [d, startDate] : [startDate, d])
      setOpen(false)
    }
  }

  function prevMonth() {
    if (leftMonth === 0) { setLeftYear((y) => y - 1); setLeftMonth(11) }
    else setLeftMonth((m) => m - 1)
  }

  function nextMonth() {
    if (leftMonth === 11) { setLeftYear((y) => y + 1); setLeftMonth(0) }
    else setLeftMonth((m) => m + 1)
  }

  const displayText = startDate && endDate
    ? `${startDate} 至 ${endDate}`
    : startDate ? `${startDate} 至 ...` : ""

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={cn(
        "flex h-[30px] items-center gap-2 rounded-[6px] border border-[#d1d5db] bg-white px-3 text-[13px] transition-colors",
        open ? "border-[#38c08f]" : "hover:border-[#38c08f]",
        displayText ? "text-[#374151]" : "text-[#9ca3af]",
        block ? "w-full" : triggerWidth
      )}
    >
      <Calendar size={13} className="shrink-0 text-[#9ca3af]" />
      <span className="flex-1 truncate text-left">{displayText || placeholder}</span>
      {displayText ? (
        <X
          size={12}
          className="shrink-0 text-[#9ca3af] hover:text-[#374151]"
          onClick={(e) => { e.stopPropagation(); onChange([]); setOpen(false) }}
        />
      ) : (
        <ChevronDown size={12} className="shrink-0 text-[#9ca3af]" />
      )}
    </button>
  )

  return (
    <div className={cn("flex items-center gap-2", block && "w-full")}>
      {label && <span className="whitespace-nowrap text-[13px] text-[#374151]">{label}</span>}
      <div className={cn("relative", block && "min-w-0 flex-1")} ref={ref}>
        {trigger}
        {open && (
          <div className="absolute left-0 top-[36px] z-50 flex gap-4 rounded-[8px] border border-[#e5e7eb] bg-white px-5 py-4 shadow-lg">
            <div className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <button onClick={prevMonth} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f3f4f6] text-[#6b7280]">
                  <ChevronLeft size={14} />
                </button>
                <span />
              </div>
              <MonthPanel year={leftYear} month={leftMonth} hoverDate={hoverDate} startDate={startDate} endDate={endDate} onDayClick={handleDayClick} onDayHover={setHoverDate} />
            </div>
            <div className="w-px bg-[#f3f4f6]" />
            <div className="flex flex-col">
              <div className="mb-2 flex items-center justify-end">
                <span />
                <button onClick={nextMonth} className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#f3f4f6] text-[#6b7280]">
                  <ChevronRight size={14} />
                </button>
              </div>
              <MonthPanel year={rightYear} month={rightMonth} hoverDate={hoverDate} startDate={startDate} endDate={endDate} onDayClick={handleDayClick} onDayHover={setHoverDate} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
