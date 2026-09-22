"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import {
  ActionButton,
  CopyButton,
  DateRangePicker,
  ExportButton,
  FilterActions,
  FilterBar,
  FilterInput,
  FixedHeaderTable,
  MonetizationBadge,
  RightDrawer,
  SelectFilter,
  StatusBadge,
  thClass,
  type DateRangeValue,
  type StatusStyleConfig,
} from "@/components/shared"
import { mediaEventReportApi, type MediaEventReportItem } from "@/lib/api"
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
  drama: string
  eventName: string
  status: string
  reportedAtRange: DateRangeValue
}

const defaultFilters: FilterForm = {
  userId: "",
  linkId: "",
  appId: "",
  drama: "",
  eventName: "",
  status: "",
  reportedAtRange: [],
}

const statusOptions = [
  { label: "成功", value: "success" },
  { label: "失败", value: "failed" },
  { label: "不支持", value: "unsupported" },
]

const statusLabels: Record<MediaEventReportItem["status"], string> = {
  success: "成功",
  failed: "失败",
  unsupported: "不支持",
}

const statusConfig: Record<string, StatusStyleConfig> = {
  成功: { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  失败: { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
  不支持: { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
}

const exportColumns = "userId,appName,monetizationType,attributionLinkId,dramaName,dramaId,episodeNo,eventName,status,reportedAt,params,result"
const cellClass = "px-4 py-3 text-[12.5px] whitespace-nowrap"
const mutedDash = <span className="text-[#9ca3af]">-</span>

function stringifyJSON(value: Record<string, unknown>, pretty = false) {
  try {
    return JSON.stringify(value, null, pretty ? 2 : undefined)
  } catch {
    return "{}"
  }
}

export default function MediaEventManagement() {
  const canExport = usePerm("campaign.media-event.export")
  const { draft, active, update, apply, reset } = useFilters(defaultFilters)
  const { page, pageSize, resetPage, paginationProps } = usePagination()
  const { options, error: appError } = useAppOptions(1000)
  const appOptions = options.map((app) => ({
    label: app.name,
    value: String(app.id),
    extra: <MonetizationBadge type={app.monetizationType} />,
  }))
  const [exporting, setExporting] = useState(false)
  const [selectedReport, setSelectedReport] = useState<MediaEventReportItem | null>(null)

  const buildFilterParams = useCallback(() => ({
    userId: active.userId.trim() || undefined,
    linkId: active.linkId.trim() || undefined,
    appId: active.appId || undefined,
    drama: active.drama.trim() || undefined,
    eventName: active.eventName.trim() || undefined,
    status: active.status || undefined,
    reportedAtFrom: active.reportedAtRange?.[0] || undefined,
    reportedAtTo: active.reportedAtRange?.[1] || undefined,
  }), [active])

  const fetchList = useCallback(({ page: currentPage, pageSize: currentPageSize }: { page: number; pageSize: number }) => (
    mediaEventReportApi.list({ page: currentPage, pageSize: currentPageSize, ...buildFilterParams() })
  ), [buildFilterParams])
  const { data, total, loading, error } = usePagedQuery({ page, pageSize, fetcher: fetchList })

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])
  useEffect(() => {
    if (appError) toast.error(appError)
  }, [appError])

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
      await mediaEventReportApi.export({ ...buildFilterParams(), columns: exportColumns })
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "导出失败")
    } finally {
      setExporting(false)
    }
  }

  async function handleCopyJSON(value: Record<string, unknown>, message: string) {
    try {
      const text = stringifyJSON(value, true)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand("copy")
        textarea.remove()
        if (!copied) throw new Error("copy failed")
      }
      toast.success(message)
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限")
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
        <SelectFilter block label="小程序" value={draft.appId} onChange={(value) => update("appId", value)} options={appOptions} placeholder="全部" />
        <FilterInput block label="Linkid" placeholder="请输入 Linkid" value={draft.linkId} onChange={(value) => update("linkId", value)} />
        <FilterInput block label="剧集" placeholder="请输入剧集ID或名称" value={draft.drama} onChange={(value) => update("drama", value)} />
        <FilterInput block label="事件名称" placeholder="请输入完整事件名称" value={draft.eventName} onChange={(value) => update("eventName", value)} />
        <SelectFilter block label="上报状态" value={draft.status} onChange={(value) => update("status", value)} options={statusOptions} placeholder="全部" />
        <DateRangePicker block label="上报时间" value={draft.reportedAtRange ?? []} onChange={(value) => update("reportedAtRange", value)} />
      </FilterBar>

      <FixedHeaderTable
        autoWidth
        minWidth={1260}
        columns={new Array(9).fill("")}
        loading={loading && data.length === 0}
        empty={data.length === 0}
        header={["用户ID", "小程序", "Linkid", "剧集", "集数", "事件名称", "上报状态", "上报时间", "上报详情"].map((label) => (
          <th key={label} className={thClass}>{label}</th>
        ))}
      >
        {data.map((row, index) => (
          <tr key={row.id} className={cn("transition-colors hover:bg-[#f9fafb]", index < data.length - 1 && "border-b border-[#f3f4f6]")}>
              <td className={`${cellClass} font-mono text-[#4b5563]`}>{row.userId}</td>
              <td className={cellClass}>
                <div className="flex items-center gap-2">
                  <span className="max-w-[110px] overflow-hidden text-ellipsis text-[#111827]">{row.appName}</span>
                  <MonetizationBadge type={row.monetizationType} />
                </div>
              </td>
              <td className={`${cellClass} font-mono text-[#4b5563]`}>{row.attributionLinkId || mutedDash}</td>
              <td className={`${cellClass} text-[#4b5563]`}>
                <div className="flex items-center gap-2">
                  <span>{row.dramaName}</span>
                  <span className="font-mono text-[11.5px] text-[#9ca3af]">ID: {row.dramaId}</span>
                </div>
              </td>
              <td className={`${cellClass} text-[#374151]`}>{row.episodeNo}</td>
              <td className={`${cellClass} font-mono text-[#374151]`}>{row.eventName}</td>
              <td className={cellClass}><StatusBadge status={statusLabels[row.status]} config={statusConfig} /></td>
              <td className={`${cellClass} text-[#6b7280]`}>{formatDateTime(row.reportedAt)}</td>
              <td className={cellClass}>
                <ActionButton onClick={() => setSelectedReport(row)}>
                  查看详情
                </ActionButton>
              </td>
          </tr>
        ))}
      </FixedHeaderTable>

      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>

      <RightDrawer
        open={Boolean(selectedReport)}
        width={600}
        title="SDK 上报详情"
        onClose={() => setSelectedReport(null)}
      >
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-[#111827]">事件名称</span>
            <span className="font-mono text-[13px] text-[#374151]">{selectedReport?.eventName}</span>
          </div>
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-[13px] font-medium text-[#111827]">SDK 原始参数</h3>
              <CopyButton
                className="shrink-0"
                onClick={() => selectedReport && void handleCopyJSON(selectedReport.params, "SDK 原始参数已复制")}
              />
            </div>
            <pre className="min-h-[120px] overflow-auto rounded-[6px] border border-[#e5e7eb] bg-[#f8fafc] p-4 font-mono text-[12px] leading-5 text-[#374151] whitespace-pre-wrap break-words">
              {selectedReport ? stringifyJSON(selectedReport.params, true) : ""}
            </pre>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-[13px] font-medium text-[#111827]">SDK 上报结果</h3>
              <CopyButton
                className="shrink-0"
                onClick={() => selectedReport && void handleCopyJSON(selectedReport.result, "SDK 上报结果已复制")}
              />
            </div>
            <pre className="min-h-[160px] overflow-auto rounded-[6px] border border-[#e5e7eb] bg-[#f8fafc] p-4 font-mono text-[12px] leading-5 text-[#374151] whitespace-pre-wrap break-words">
              {selectedReport ? stringifyJSON(selectedReport.result, true) : ""}
            </pre>
          </div>
        </div>
      </RightDrawer>
    </div>
  )
}
