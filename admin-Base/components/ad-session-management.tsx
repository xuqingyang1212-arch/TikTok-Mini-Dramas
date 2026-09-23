"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import {
  DateRangePicker,
  ExportButton,
  FilterActions,
  FilterBar,
  FilterInput,
  FixedHeaderTable,
  SelectFilter,
  StatusBadge,
  thClass,
  type DateRangeValue,
  type StatusStyleConfig,
} from "@/components/shared"
import { adSessionApi } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { useAppOptions } from "@/hooks/use-app-options"
import { usePerm } from "@/components/admin-layout"
import { useFilters } from "@/hooks/use-filters"
import { usePagedQuery } from "@/hooks/use-paged-query"
import { usePagination } from "@/hooks/use-pagination"

interface FilterForm {
  userId: string
  linkId: string
  appId: string
  dramaId: string
  status: string
  createdAtRange: DateRangeValue
}

const defaultFilters: FilterForm = {
  userId: "",
  linkId: "",
  appId: "",
  dramaId: "",
  status: "",
  createdAtRange: [],
}

const statusOptions = [
  { label: "待完成", value: "pending" },
  { label: "已完成", value: "completed" },
  { label: "已取消", value: "canceled" },
  { label: "已过期", value: "expired" },
]

const statusLabels: Record<string, string> = {
  pending: "待完成",
  completed: "已完成",
  canceled: "已取消",
  expired: "已过期",
}

const statusConfig: Record<string, StatusStyleConfig> = {
  待完成: { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  已完成: { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  已取消: { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  已过期: { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
}

const exportColumns = "userId,attributionLinkId,appName,dramaId,episodeNo,status,createdAt,completedAt,sessionNo"
const cellClass = "px-4 py-3 text-[12.5px] whitespace-nowrap"
const mutedDash = <span className="text-[#9ca3af]">-</span>

export default function AdSessionManagement() {
  const canExport = usePerm("finance.ad-session.export")
  const { draft, active, update, apply, reset } = useFilters(defaultFilters)
  const { page, pageSize, resetPage, paginationProps } = usePagination()
  const { options } = useAppOptions(100)
  const appOptions = options.map((app) => ({ label: app.name, value: String(app.id) }))
  const [exporting, setExporting] = useState(false)

  const buildFilterParams = useCallback(() => ({
    userId: active.userId.trim() || undefined,
    linkId: active.linkId.trim() || undefined,
    appId: active.appId || undefined,
    dramaId: active.dramaId.trim() || undefined,
    status: active.status || undefined,
    createdAtFrom: active.createdAtRange[0] || undefined,
    createdAtTo: active.createdAtRange[1] || undefined,
  }), [active])

  const fetchList = useCallback(({ page: currentPage, pageSize: currentPageSize }: { page: number; pageSize: number }) => (
    adSessionApi.list({ page: currentPage, pageSize: currentPageSize, ...buildFilterParams() })
  ), [buildFilterParams])
  const { data, total, loading, error } = usePagedQuery({ page, pageSize, fetcher: fetchList })

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  function handleQuery() {
    apply()
    resetPage()
  }

  function handleReset() {
    reset()
    resetPage()
  }

  async function handleExport() {
    setExporting(true)
    try {
      await adSessionApi.export({ ...buildFilterParams(), columns: exportColumns })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">
      <FilterBar
        actions={
          <FilterActions onQuery={handleQuery} onReset={handleReset}>
            {canExport && <ExportButton exporting={exporting} onClick={() => void handleExport()} />}
          </FilterActions>
        }
      >
        <FilterInput block label="用户ID" placeholder="请输入用户ID" value={draft.userId} onChange={(value) => update("userId", value)} />
        <FilterInput block label="Linkid" placeholder="请输入 Linkid" value={draft.linkId} onChange={(value) => update("linkId", value)} />
        <SelectFilter block label="小程序" value={draft.appId} onChange={(value) => update("appId", value)} options={appOptions} placeholder="全部" />
        <FilterInput block label="剧集" placeholder="请输入剧集ID或名称" value={draft.dramaId} onChange={(value) => update("dramaId", value)} />
        <SelectFilter block label="会话状态" value={draft.status} onChange={(value) => update("status", value)} options={statusOptions} placeholder="全部" />
        <DateRangePicker block label="创建时间" value={draft.createdAtRange} onChange={(value) => update("createdAtRange", value)} />
      </FilterBar>

      <FixedHeaderTable
        autoWidth
        minWidth={960}
        columns={new Array(9).fill("")}
        loading={loading && data.length === 0}
        empty={data.length === 0}
        header={[
          "用户ID", "Linkid", "小程序", "剧集", "集数", "会话状态", "创建时间", "广告完成时间", "会话ID",
        ].map((label) => <th key={label} className={thClass}>{label}</th>)}
      >
        {data.map((row, index) => (
          <tr key={row.id} className={cn("transition-colors hover:bg-[#f9fafb]", index < data.length - 1 && "border-b border-[#f3f4f6]")}>
            <td className={`${cellClass} font-mono text-[#4b5563]`}>{row.userId}</td>
            <td className={`${cellClass} font-mono text-[#4b5563]`}>{row.attributionLinkId || mutedDash}</td>
            <td className={`${cellClass} text-[#111827]`}>{row.appName}</td>
            <td className={cellClass}>
              <div className="flex items-center gap-2 text-[#4b5563]">
                <span>{row.dramaName || row.dramaId}</span>
                {row.dramaName && row.dramaId && (
                  <span className="font-mono text-[11.5px] text-[#9ca3af]">ID: {row.dramaId}</span>
                )}
              </div>
            </td>
            <td className={`${cellClass} text-[#374151]`}>{row.episodeNo}</td>
            <td className={cellClass}><StatusBadge status={statusLabels[row.status] || row.status} config={statusConfig} /></td>
            <td className={`${cellClass} text-[#6b7280]`}>{formatDateTime(row.createdAt)}</td>
            <td className={`${cellClass} text-[#6b7280]`}>{row.completedAt ? formatDateTime(row.completedAt) : mutedDash}</td>
            <td className={`${cellClass} font-mono text-[#4b5563]`}>{row.sessionNo}</td>
          </tr>
        ))}
      </FixedHeaderTable>

      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>
    </div>
  )
}
