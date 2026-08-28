"use client"

import { useEffect, useRef, useState } from "react"
import { Settings2, Check, RotateCcw, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ColumnDef, UseColumnSettings } from "@/hooks/use-column-settings"

export interface ColumnSettingsProps {
  /** useColumnSettings 返回值。 */
  settings: UseColumnSettings
  /** 按钮文案，默认「列设置」。 */
  label?: string
}

/**
 * ColumnSettings —— 全站统一的「自定义列展示」按钮 + 下拉勾选面板。
 *
 * 与工具栏其它按钮同高（30px）、同风格；下拉里逐列勾选，必选列禁用。
 * 勾选结果由 useColumnSettings 负责持久化到 localStorage（按登录用户隔离）。
 * 放在列表工具栏（FilterBar 的 actions 或表格上方工具栏）里使用。
 */
export function ColumnSettings({ settings, label = "列设置" }: ColumnSettingsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // 拖拽排序状态：dragKey = 正在拖的列 key；overKey = 悬停到的列 key。
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const { columns, orderedColumns, visibleKeys, isVisible, toggle, move, reset } = settings
  const shownCount = orderedColumns.length
  // 未显示的列（保持 ALL_COLUMNS 定义顺序），放在面板下半区，不参与拖拽。
  const hiddenColumns = columns.filter((c) => !isVisible(c.key))

  function handleDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return
    const from = visibleKeys.indexOf(dragKey)
    const to = visibleKeys.indexOf(targetKey)
    if (from >= 0 && to >= 0) move(from, to)
    setDragKey(null)
    setOverKey(null)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-[30px] items-center gap-1.5 rounded-[6px] border bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]",
          open ? "border-[#38c08f]" : "border-[#d1d5db]"
        )}
      >
        <Settings2 size={13} />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-[34px] z-50 w-[240px] rounded-[6px] border border-[#e5e7eb] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#f3f4f6] px-3 py-2">
            <span className="text-[12px] text-[#6b7280]">已显示 {shownCount}/{columns.length} 列</span>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-[12px] text-[#38c08f] transition-colors hover:text-[#2da87a]"
            >
              <RotateCcw size={11} />重置
            </button>
          </div>
          <div className="max-h-[340px] overflow-y-auto py-1">
            {/* 已显示列：可拖拽排序（拖动左侧握把）。显示顺序即表格列顺序。 */}
            <div className="px-3 pt-1 pb-0.5 text-[11px] text-[#9ca3af]">拖动排序 · 已显示</div>
            {orderedColumns.map((col: ColumnDef) => {
              const disabled = !!col.required
              return (
                <div
                  key={col.key}
                  draggable
                  onDragStart={() => setDragKey(col.key)}
                  onDragEnter={() => setOverKey(col.key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(col.key)}
                  onDragEnd={() => { setDragKey(null); setOverKey(null) }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors",
                    dragKey === col.key ? "opacity-50" : "hover:bg-[#f0fdf4]",
                    overKey === col.key && dragKey && dragKey !== col.key ? "border-t-2 border-[#38c08f]" : "border-t-2 border-transparent"
                  )}
                >
                  <GripVertical size={13} className="shrink-0 cursor-grab text-[#c0c4cc] active:cursor-grabbing" />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(col.key)}
                    className={cn(
                      "flex flex-1 items-center gap-2 text-left whitespace-nowrap",
                      disabled ? "cursor-not-allowed" : ""
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border",
                        disabled ? "border-[#d1d5db] bg-[#d1d5db] text-white" : "border-[#38c08f] bg-[#38c08f] text-white"
                      )}
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className="flex-1 text-[#374151]">{col.label}</span>
                    {disabled && <span className="text-[11px] text-[#9ca3af]">固定</span>}
                  </button>
                </div>
              )
            })}

            {hiddenColumns.length > 0 && (
              <>
                <div className="mt-1 border-t border-[#f3f4f6] px-3 pt-2 pb-0.5 text-[11px] text-[#9ca3af]">未显示</div>
                {hiddenColumns.map((col: ColumnDef) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggle(col.key)}
                    className="flex w-full items-center gap-2 px-3 py-2 pl-[33px] text-[13px] text-[#374151] transition-colors whitespace-nowrap hover:bg-[#f0fdf4]"
                  >
                    <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border border-[#d1d5db] bg-white" />
                    <span className="flex-1 text-left">{col.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export type { ColumnDef } from "@/hooks/use-column-settings"
