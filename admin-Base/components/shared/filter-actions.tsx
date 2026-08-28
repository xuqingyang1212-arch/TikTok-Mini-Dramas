"use client"

import type { ReactNode } from "react"
import { RotateCcw, Search } from "lucide-react"

export interface FilterActionsProps {
  /** 查询按钮点击回调 */
  onQuery: () => void
  /** 重置按钮点击回调 */
  onReset: () => void
  /** 追加在重置按钮之后的额外操作（如列设置、导出等） */
  children?: ReactNode
}

// 统一的筛选栏操作按钮组：查询 + 重置（+ 可选额外操作）。
// 作为 FilterBar 的 actions 传入，保持全站按钮样式与顺序一致。
export function FilterActions({ onQuery, onReset, children }: FilterActionsProps) {
  return (
    <>
      <button
        onClick={onQuery}
        className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]"
      >
        <Search size={13} />查询
      </button>
      <button
        onClick={onReset}
        className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]"
      >
        <RotateCcw size={12} />重置
      </button>
      {children}
    </>
  )
}
