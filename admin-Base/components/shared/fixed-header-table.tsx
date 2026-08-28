"use client"

import { useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * FixedHeaderTable —— 全站统一的「固定表头 + 独立滚动区」表格容器。
 *
 * 解决的问题：
 * 1. 纵向滚动时表头保持固定（表头独立成层，不参与纵向滚动）。
 * 2. 触控板快速横向滚动时表头与表体不错位（两层 table 共享列宽，
 *    通过 onScroll 帧级同步 scrollLeft）。
 * 3. macOS 触控板到达滚动边界时的橡皮筋回弹（elastic overscroll）由
 *    [overscroll-behavior:none] 就地关闭，配合 app/globals.css 中 html/body
 *    的全局兜底。
 *
 * 两种列宽模式（禁止再在页面里各自手写 sticky thead 结构）：
 *
 * 1) 默认（定宽）：columns 传每列宽度 class（"w-[Npx]" / "w-auto"），走双表
 *    table-fixed。适合列宽可预估、内容不长的表（用户/应用/角色/订阅等）。
 *    <FixedHeaderTable minWidth={720} columns={["w-[140px]", "", "w-[90px]"]}
 *      header={labels.map(l => <th key={l} className={thClass}>{l}</th>)}>
 *      {rows}
 *    </FixedHeaderTable>
 *
 * 2) autoWidth（内容自适应，推荐用于含长文本的列）：传 autoWidth，columns 仅作
 *    占位（new Array(列数).fill("")）。改用「单表 + sticky 表头 + table-auto」，
 *    每列按内容（含表头文字）自动撑开、内容全展示不截断，表头与数据天然对齐，
 *    放不下时整表横向滚动。含剧集名、"剧集+集数"等不定长文本的列必须用它。
 *    <FixedHeaderTable autoWidth minWidth={900} columns={new Array(9).fill("")}
 *      header={labels.map(l => <th key={l} className={thClass}>{l}</th>)}>
 *      {rows}
 *    </FixedHeaderTable>
 *
 * 两种模式下 td 内容都要加 whitespace-nowrap（autoWidth 下靠它撑开列宽）。
 */
export interface FixedHeaderTableProps {
  /** 每一列的宽度 class（如 "w-[140px]"、"w-auto" 或 ""），表头与表体共享。 */
  columns: string[]
  /** 表头行内容，通常是一组 <th>。不要在 th 上再写 sticky/列宽。 */
  header: ReactNode
  /** 表体内容，通常是一组 <tr>（含加载中/空态行）。 */
  children: ReactNode
  /** 表格最小宽度（px），列放不下时出现横向滚动。默认 720。 */
  minWidth?: number
  /** 是否使用 table-fixed（列宽严格按 colgroup）。默认 true。 */
  tableFixed?: boolean
  /**
   * 数据加载中。传入后组件自动渲染一行加载占位（colSpan=列数），无需页面手写 colSpan。
   * 与 empty 同为真时优先显示 loading。
   */
  loading?: boolean
  /** 数据为空。传入后组件自动渲染一行空态占位（colSpan=列数）。 */
  empty?: boolean
  /** 加载中文案，默认「加载中...」。 */
  loadingText?: ReactNode
  /** 空态文案，默认「暂无数据」。 */
  emptyText?: ReactNode
  /** 状态占位单元格的额外 class（覆盖默认 padding 等），默认 "py-16"。 */
  stateCellClassName?: string
  /**
   * 列宽按内容自适应（不截断、内容全展示）。开启后：
   * - 采用「单表 + sticky 表头」结构，table-auto 让每列被最长内容（含表头文字）撑开；
   * - 表头与数据天然共享同一套列宽，不会错位；放不下时整表横向滚动；
   * - columns 仅作占位（可传空字符串数组，长度需与实际列数一致）。
   *   适合含长文本（剧集名、剧集+集数等）且要求内容全展示的列表。
   */
  autoWidth?: boolean
  className?: string
}

export function FixedHeaderTable({
  columns,
  header,
  children,
  minWidth = 720,
  tableFixed = true,
  loading,
  empty,
  loadingText = "加载中...",
  emptyText = "暂无数据",
  stateCellClassName = "py-16",
  autoWidth = false,
  className,
}: FixedHeaderTableProps) {
  const headScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)

  const tableStyle = { minWidth }

  // 统一的加载/空态占位行：colSpan 取列数，避免页面各自硬编码数字。
  // 仅当显式传入 loading / empty 时启用；否则沿用页面自带的 children。
  const stateRow =
    loading || empty ? (
      <tr>
        <td
          colSpan={columns.length}
          className={cn(
            "text-center text-[13px] text-[#9ca3af]",
            stateCellClassName
          )}
        >
          {loading ? loadingText : emptyText}
        </td>
      </tr>
    ) : null
  const body = stateRow ?? children

  // ── auto 模式：单表 + sticky 表头，table-auto 按内容（含表头）自适应列宽 ──
  if (autoWidth) {
    return (
      <div
        ref={bodyScrollRef}
        className={cn(
          "flex-1 min-h-0 overflow-auto [overscroll-behavior:none]",
          className
        )}
      >
        <table
          className={cn(
            "w-full table-auto border-separate border-spacing-0 text-[13px]",
            // sticky 表头：把定位施加到每个 th（border 已在 thClass 中），
            // 保证纵向滚动时表头固定、且列宽与数据天然对齐。
            "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10"
          )}
          style={tableStyle}
        >
          <thead>
            {/* sticky 表头：定位与 border 都放在每个 th（thClass 已含）。 */}
            <tr className="bg-[#f9fafb]">{header}</tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
    )
  }

  // ── 默认模式：双表结构（table-fixed），固定表头 + 横向 scrollLeft 同步 ──
  const tableClass = cn(
    "w-full border-separate border-spacing-0 text-[13px]",
    tableFixed && "table-fixed"
  )
  const colgroup = (
    <colgroup>
      {columns.map((w, i) => (
        <col key={i} className={w || undefined} />
      ))}
    </colgroup>
  )

  return (
    <div className={cn("flex-1 min-h-0 flex flex-col [overscroll-behavior:none]", className)}>
      {/* 固定表头：横向 overflow-hidden，scrollLeft 由 JS 同步 */}
      <div ref={headScrollRef} className="shrink-0 overflow-hidden">
        <table className={tableClass} style={tableStyle}>
          {colgroup}
          <thead>
            <tr className="bg-[#f9fafb]">{header}</tr>
          </thead>
        </table>
      </div>
      {/* 数据行：纵向 + 横向滚动区，onScroll 同步表头横向偏移 */}
      <div
        ref={bodyScrollRef}
        className="flex-1 min-h-0 overflow-auto [overscroll-behavior:none]"
        onScroll={() => {
          if (headScrollRef.current && bodyScrollRef.current) {
            headScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft
          }
        }}
      >
        <table className={tableClass} style={tableStyle}>
          {colgroup}
          <tbody>{body}</tbody>
        </table>
      </div>
    </div>
  )
}

/** 全站统一的表头单元格 class（配合 FixedHeaderTable.header 使用）。 */
export const thClass =
  "border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-left text-[12.5px] font-medium text-[#6b7280] whitespace-nowrap"
