"use client"

import { cn } from "@/lib/utils"

// ─── ListPagination ────────────────────────────────────────────────────────────
// 统一后台列表分页器组件
// 布局：左侧 总条数  右侧 上一页 / 页码 / 下一页 / 每页条数选择器
// ──────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

interface ListPaginationProps {
  /** 数据总条数 */
  total: number
  /** 当前页码（1-based） */
  currentPage: number
  /** 每页显示条数 */
  pageSize: PageSizeOption
  /** 页码变更回调 */
  onPageChange: (page: number) => void
  /** 每页条数变更回调（同时重置页码为 1） */
  onPageSizeChange: (size: PageSizeOption) => void
  /** 总条数展示文案，默认 "共 N 条记录" */
  totalLabel?: (total: number) => string
}

export function ListPagination({
  total,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalLabel,
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  // safePage: 防止切换 pageSize 后 currentPage 超出范围
  const safePage = Math.min(currentPage, totalPages)

  // 页码列表（含省略）：首尾 + 当前页前后各 1 页
  const allPages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const pageNums = allPages.filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1
  )

  const btnBase =
    "flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#d1d5db] bg-white text-[12px] text-[#374151] transition-colors hover:border-[#38c08f] hover:text-[#38c08f] disabled:cursor-not-allowed disabled:opacity-40"

  const defaultTotalLabel = (n: number) => `共 ${n} 条记录`

  return (
    <div className="flex items-center justify-between border-t border-[#e5e7eb] px-5 py-3">
      {/* 左：总条数 */}
      <span className="text-[12.5px] text-[#6b7280]">
        {(totalLabel ?? defaultTotalLabel)(total)}
      </span>

      {/* 右：翻页 + 页码 + 每页条数 */}
      <div className="flex items-center gap-1.5">
        {/* 上一页 */}
        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className={btnBase}
          aria-label="上一页"
        >
          ‹
        </button>

        {/* 页码列表 */}
        {pageNums.map((p, idx) => {
          const prev = pageNums[idx - 1]
          const showEllipsis = prev !== undefined && p - prev > 1
          return (
            <span key={`page-${p}`} className="flex items-center gap-1.5">
              {showEllipsis && (
                <span className="flex h-7 w-5 items-center justify-center text-[12px] text-[#9ca3af]">
                  …
                </span>
              )}
              <button
                onClick={() => onPageChange(p)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-[4px] text-[12px] transition-colors",
                  p === safePage
                    ? "bg-[#38c08f] font-medium text-white"
                    : "border border-[#d1d5db] bg-white text-[#374151] hover:border-[#38c08f] hover:text-[#38c08f]"
                )}
              >
                {p}
              </button>
            </span>
          )
        })}

        {/* 下一页 */}
        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === totalPages}
          className={btnBase}
          aria-label="下一页"
        >
          ›
        </button>

        {/* 每页显示条数选择器 */}
        <div className="relative ml-1.5">
          <select
            value={pageSize}
            onChange={(e) => {
              const next = Number(e.target.value) as PageSizeOption
              onPageSizeChange(next)
            }}
            className="h-7 appearance-none rounded-[4px] border border-[#d1d5db] bg-white pl-2.5 pr-6 text-[12px] text-[#374151] outline-none transition-colors hover:border-[#38c08f] focus:border-[#38c08f] cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} 条/页
              </option>
            ))}
          </select>
          {/* 自定义下拉箭头 */}
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#9ca3af]">
            ▾
          </span>
        </div>
      </div>
    </div>
  )
}
