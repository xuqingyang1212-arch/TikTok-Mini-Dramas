"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, SelectFilter, DateRangePicker, FilterBar, FilterActions, type DateRangeValue, StatusBadge, type StatusStyleConfig, FixedHeaderTable, thClass, ColumnSettings } from "@/components/shared"
import { useColumnSettings, type ColumnDef } from "@/hooks/use-column-settings"
import { rechargeOrderApi, appApi, type RechargeOrderItem } from "@/lib/api"
import { toast } from "@/lib/toast"
import { formatDateTime } from "@/lib/format"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"

interface FilterForm {
  appId: string
  userId: string
  orderNo: string
  thirdPartyOrderNo: string
  dramaId: string
  orderType: string
  payStatus: string
  deviceOs: string
  createdAtRange: DateRangeValue
}

const defaultFilters: FilterForm = {
  appId: "",
  userId: "",
  orderNo: "",
  thirdPartyOrderNo: "",
  dramaId: "",
  orderType: "",
  payStatus: "",
  deviceOs: "",
  createdAtRange: [],
}

const orderTypeOptions = [
  { label: "Beans解锁", value: "unlock" },
  { label: "会员订阅", value: "subscription" },
]

const payStatusOptions = [
  { label: "待支付", value: "pending" },
  { label: "支付成功", value: "paid" },
  { label: "支付失败", value: "failed" },
  { label: "已取消", value: "cancelled" },
]

const deviceOsOptions = [
  { label: "Apple", value: "Apple" },
  { label: "Google", value: "Google" },
]

const payStatusLabel: Record<string, string> = {
  pending: "待支付",
  paid: "支付成功",
  failed: "支付失败",
  cancelled: "已取消",
}

const payStatusConfig: Record<string, StatusStyleConfig> = {
  待支付: { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  支付成功: { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  支付失败: { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
  已取消: { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
}

const orderTypeLabel: Record<string, string> = {
  unlock: "Beans解锁",
  subscription: "订阅",
}

const periodLabel: Record<string, string> = {
  weekly: "周",
  monthly: "月",
  quarterly: "季度",
  half_yearly: "半年",
  yearly: "年",
  week: "周",
  month: "月",
  quarter: "季度",
  half_year: "半年",
  year: "年",
}

// 将 "2,3,4,5,6" 收拢为连续区间文案，如 "第2-6集"；非连续如 "第2,4-6集"
function formatEpisodes(list?: string): string {
  if (!list) return ""
  const nums = list.split(",").map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)).sort((a, b) => a - b)
  if (nums.length === 0) return ""
  const parts: string[] = []
  let start = nums[0]
  let prev = nums[0]
  for (let i = 1; i <= nums.length; i++) {
    const cur = nums[i]
    if (cur === prev + 1) { prev = cur; continue }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = cur
    prev = cur
  }
  return `第${parts.join(",")}集`
}

// 单元格通用 class：字段内容一律 whitespace-nowrap（autoWidth 表格靠它撑开列宽）。
const tdBase = "px-4 py-3 text-[12.5px] whitespace-nowrap"
const mutedDash = <span className="text-[#9ca3af]">-</span>

// 充值订单全部可展示列。列表渲染、列设置、导出都以此为唯一数据源。
// key 会同步作为后端导出的列标识；defaultVisible=false 的列默认隐藏，用户可在「列设置」里勾选。
interface OrderColumn extends ColumnDef {
  render: (row: RechargeOrderItem) => ReactNode
}

const ALL_COLUMNS: OrderColumn[] = [
  {
    key: "userId", label: "用户ID",
    render: (r) => <span className="font-mono text-[#4b5563]">{r.userId}</span>,
  },
  {
    key: "appName", label: "小程序",
    render: (r) => <span className="text-[#111827]">{r.appName}</span>,
  },
  {
    key: "orderType", label: "订单类型",
    render: (r) => <span className="text-[#374151]">{orderTypeLabel[r.orderType] || r.orderType}</span>,
  },
  {
    key: "drama", label: "充值剧集",
    render: (r) =>
      r.dramaName || r.dramaId ? (
        <span className="text-[#111827]">{r.dramaName || r.dramaId}</span>
      ) : mutedDash,
  },
  {
    key: "episodeList", label: "解锁集数",
    render: (r) =>
      r.orderType === "unlock" && r.episodeList ? (
        <span className="text-[#374151]">{formatEpisodes(r.episodeList)}</span>
      ) : mutedDash,
  },
  {
    key: "beansCost", label: "消耗Beans",
    render: (r) => (r.orderType === "unlock" ? <span className="text-[#111827]">{r.beansCost}</span> : mutedDash),
  },
  {
    key: "period", label: "订阅周期", defaultVisible: false,
    render: (r) => (r.orderType === "subscription" && r.period ? <span className="text-[#374151]">{periodLabel[r.period] || r.period}</span> : mutedDash),
  },
  {
    key: "subscribeAmount", label: "订阅金额",
    render: (r) => <span className="text-[#111827]">{r.orderType === "subscription" ? `$${r.subscribeAmount.toFixed(2)}` : "-"}</span>,
  },
  {
    key: "deviceOs", label: "设备系统",
    render: (r) => <span className="text-[#6b7280]">{r.deviceOs || "-"}</span>,
  },
  {
    key: "payStatus", label: "支付状态",
    render: (r) => <StatusBadge status={payStatusLabel[r.payStatus] || r.payStatus} config={payStatusConfig} />,
  },
  {
    key: "createdAt", label: "创建时间",
    render: (r) => <span className="text-[#6b7280]">{formatDateTime(r.createdAt)}</span>,
  },
  {
    key: "paidAt", label: "支付时间", defaultVisible: false,
    render: (r) => (r.paidAt ? <span className="text-[#6b7280]">{formatDateTime(r.paidAt)}</span> : mutedDash),
  },
  {
    key: "orderNo", label: "订单号",
    render: (r) => <span className="font-mono text-[#4b5563]">{r.orderNo}</span>,
  },
  {
    key: "thirdPartyOrderNo", label: "第三方订单号",
    render: (r) => <span className="font-mono text-[#6b7280]">{r.thirdPartyOrderNo || "-"}</span>,
  },
]

export default function RechargeOrderManagement() {
  const { draft: draftFilters, active: activeFilters, update: updateDraft, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page: currentPage, pageSize, resetPage, paginationProps } = usePagination()

  const [data, setData] = useState<RechargeOrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [appOptions, setAppOptions] = useState<{ label: string; value: string }[]>([])
  const [exporting, setExporting] = useState(false)

  // 自定义列展示：勾选结果持久化到 localStorage（按登录用户隔离）。
  const colSettings = useColumnSettings("recharge-order", ALL_COLUMNS)
  // 按用户自定义顺序 + 可见性取列（visibleKeys 已是用户排好的顺序），
  // 映射回带 render 的 OrderColumn。
  const columnByKey = new Map(ALL_COLUMNS.map((c) => [c.key, c]))
  const visibleColumns = colSettings.visibleKeys
    .map((k) => columnByKey.get(k))
    .filter((c): c is OrderColumn => !!c)

  useEffect(() => {
    appApi.list({ page: 1, pageSize: 100 }).then((res) => {
      setAppOptions((res.list || []).map((app: any) => ({ label: app.name, value: String(app.id) })))
    }).catch(() => {})
  }, [])

  // 列表/导出共用的筛选参数（不含分页）
  const buildFilterParams = useCallback(() => ({
    appId: activeFilters.appId || undefined,
    userId: activeFilters.userId.trim() || undefined,
    orderNo: activeFilters.orderNo.trim() || undefined,
    thirdPartyOrderNo: activeFilters.thirdPartyOrderNo.trim() || undefined,
    dramaId: activeFilters.dramaId.trim() || undefined,
    orderType: activeFilters.orderType || undefined,
    payStatus: activeFilters.payStatus || undefined,
    deviceOs: activeFilters.deviceOs || undefined,
    createdAtFrom: activeFilters.createdAtRange[0] || undefined,
    createdAtTo: activeFilters.createdAtRange[1] || undefined,
  }), [activeFilters])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await rechargeOrderApi.list<RechargeOrderItem>({
        page: currentPage,
        pageSize,
        ...buildFilterParams(),
      })
      setData(res.list || [])
      setTotal(res.total ?? 0)
    } catch {
      setData([])
      setTotal(0)
      toast.error("加载失败")
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, buildFilterParams])

  useEffect(() => { void fetchList() }, [fetchList])

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  async function handleExport() {
    setExporting(true)
    try {
      // 按当前可见列导出：把列 key 顺序传给后端，后端据此生成 xlsx 表头与列。
      await rechargeOrderApi.export({ ...buildFilterParams(), columns: visibleColumns.map((c) => c.key).join(",") })
    } catch {
      toast.error("导出失败")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">
      <FilterBar
        actions={
          <FilterActions onQuery={handleQuery} onReset={handleReset}>
            <ColumnSettings settings={colSettings} />
            <button onClick={handleExport} disabled={exporting} className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7] disabled:cursor-not-allowed disabled:opacity-60">
              <Download size={12} />{exporting ? "导出中..." : "导出"}
            </button>
          </FilterActions>
        }
      >
        <FilterInput block label="用户ID" placeholder="请输入" value={draftFilters.userId} onChange={(v) => updateDraft("userId", v)} />
        <SelectFilter block label="小程序" value={draftFilters.appId} onChange={(v) => updateDraft("appId", v)} options={appOptions} placeholder="全部" />
        <SelectFilter block label="订单类型" value={draftFilters.orderType} onChange={(v) => updateDraft("orderType", v)} options={orderTypeOptions} placeholder="全部" />
        <FilterInput block label="充值剧集" placeholder="请输入剧集ID或名称" value={draftFilters.dramaId} onChange={(v) => updateDraft("dramaId", v)} />
        <SelectFilter block label="设备系统" value={draftFilters.deviceOs} onChange={(v) => updateDraft("deviceOs", v)} options={deviceOsOptions} placeholder="全部" />
        <SelectFilter block label="支付状态" value={draftFilters.payStatus} onChange={(v) => updateDraft("payStatus", v)} options={payStatusOptions} placeholder="全部" />
        <DateRangePicker block label="创建时间" value={draftFilters.createdAtRange} onChange={(v) => updateDraft("createdAtRange", v)} />
        <FilterInput block label="订单号" placeholder="请输入" value={draftFilters.orderNo} onChange={(v) => updateDraft("orderNo", v)} />
        <FilterInput block label="第三方订单号" placeholder="请输入" value={draftFilters.thirdPartyOrderNo} onChange={(v) => updateDraft("thirdPartyOrderNo", v)} />
      </FilterBar>

      <FixedHeaderTable
        autoWidth
        minWidth={1200}
        columns={visibleColumns.map(() => "")}
        loading={loading && data.length === 0}
        empty={data.length === 0}
        header={visibleColumns.map((col) => (
          <th key={col.key} className={thClass}>{col.label}</th>
        ))}
      >
            {data.map((row, i) => (
                <tr key={row.id} className={cn("transition-colors hover:bg-[#f9fafb]", i < data.length - 1 && "border-b border-[#f3f4f6]")}>
                  {visibleColumns.map((col) => (
                    <td key={col.key} className={tdBase}>{col.render(row)}</td>
                  ))}
                </tr>
              ))}
      </FixedHeaderTable>

      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>
    </div>
  )
}
