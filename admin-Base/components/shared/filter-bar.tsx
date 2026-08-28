"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface FilterBarProps {
  /** 筛选字段，建议使用 FilterInput / SelectFilter / DateRangePicker，并传 block */
  children: ReactNode
  /** 右侧操作按钮区（查询/重置/导出等） */
  actions?: ReactNode
  /** 每列最小宽度（px），列会在此基础上自动拉伸对齐，默认 300 */
  minColWidth?: number
  className?: string
}

// 统一的筛选栏布局：
// 筛选字段进入一个等宽自适应网格（auto-fill + minmax），无论多少个筛选项、
// 换到第几行，每一行每一列都会自动对齐、自动拉伸/收缩组件宽度，保持整齐。
//
// 操作按钮区（查询/重置/导出等）始终贴整行最右、且按钮本身不会被压缩。
// 通过测量最后一行右侧剩余像素宽度是否放得下按钮组，决定按钮的落位：
//   - 放得下时：按钮绝对定位到网格右下角，与最后一行筛选项同行（不占网格流，
//     因此不会在网格底部撑出多余空行，整体保持垂直居中）；
//   - 放不下时：按钮作为普通网格项独占整行的下一行，仍位于整行最右侧。
export function FilterBar({ children, actions, minColWidth = 300, className }: FilterBarProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  // 按钮是否与最后一行筛选项同行（true=绝对定位同行；false=普通流独占下一行）。
  const [sameRow, setSameRow] = useState(false)

  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid || !actions) return
    // 网格里最后一个子元素是按钮容器，其余为筛选项。
    const items = Array.from(grid.children) as HTMLElement[]
    const fieldCount = items.length - 1
    if (fieldCount <= 0) {
      setSameRow(false)
      return
    }
    // 读取实际渲染出的列宽（每列像素宽度）与列间距。
    const gridStyle = getComputedStyle(grid)
    const colWidths = gridStyle.gridTemplateColumns.split(" ").filter(Boolean)
    const cols = colWidths.length || 1
    const columnGap = parseFloat(gridStyle.columnGap) || 0
    // 最后一行已被筛选项占用的列数（0 表示正好占满整行）。
    const usedInLastRow = fieldCount % cols
    if (usedInLastRow === 0) {
      // 最后一行被筛选项占满，按钮只能独占下一行。
      setSameRow(false)
      return
    }
    const freeCols = cols - usedInLastRow
    // 计算最后一行右侧剩余的空位像素宽度：空列宽度之和 + 这些空列引入的列间距。
    let freeWidth = 0
    for (let i = usedInLastRow; i < cols; i++) {
      freeWidth += parseFloat(colWidths[i]) || 0
    }
    freeWidth += columnGap * freeCols
    // 按钮组实际所需宽度（不被压缩时的完整宽度）。
    // 用内层包裹层的 scrollWidth 得到按钮组真实所需宽度。
    const actionsWidth = actionsRef.current?.scrollWidth ?? 0
    // 空位放得下完整按钮组时才同行显示，否则独占下一行。
    setSameRow(freeWidth >= actionsWidth)
  }, [actions])

  useLayoutEffect(() => {
    measure()
  })

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(grid)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [measure])

  return (
    <div className={cn("flex shrink-0 flex-col gap-3 border-b border-[#e5e7eb] px-5 py-4", className)}>
      <div
        ref={gridRef}
        className="relative grid items-center gap-x-4 gap-y-3"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))` }}
      >
        {children}
        {actions && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-end whitespace-nowrap",
              // 同行：绝对定位到网格右下角，正好覆盖最后一行的行高（h-[30px]），
              // 不占网格流，故不会在底部撑出多余空行，整体保持垂直居中。
              sameRow && "absolute bottom-0 right-0 h-[30px]",
            )}
            // 独占下一行时作为普通网格项横跨整行；同行时脱离网格流（绝对定位）。
            style={sameRow ? undefined : { gridColumn: "1 / -1" }}
          >
            {/* 内层包裹层用于测量按钮组真实宽度（外层横跨整行不能用于测量）。 */}
            <div ref={actionsRef} className="flex items-center gap-2">
              {actions}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
