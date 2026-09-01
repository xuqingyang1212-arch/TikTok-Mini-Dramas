"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, SelectFilter, DateRangePicker, FilterBar, FilterActions, RightDrawer, type DateRangeValue, FixedHeaderTable, thClass } from "@/components/shared"
import { appUserApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { formatDateTime } from "@/lib/format"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"
import { useAppOptions } from "@/hooks/use-app-options"
import { usePagedQuery } from "@/hooks/use-paged-query"

// ─────────────── Types ───────────────
interface AppUserItem {
  id: number
  userId: string
  appId: number
  appName: string
  openId: string
  unionId: string
  createdAt: string
  subscriptionStatus?: string
  subscriptionExpireAt?: string | null
}

const PERIOD_LABEL: Record<string, string> = {
  weekly: "周",
  monthly: "月",
  quarterly: "季度",
  half_yearly: "半年",
  yearly: "年",
}

// 订阅状态文案（对齐 TikTok Minis 订阅生命周期枚举）
const SUB_STATUS_LABEL: Record<string, string> = {
  active: "生效中",
  expired: "已过期",
  canceled: "已取消",
  paused: "已暂停",
  grace: "宽限期",
  on_hold: "账单挂起",
  revoked: "已撤销",
}
function subStatusText(status?: string): string {
  if (!status) return "未订阅"
  return SUB_STATUS_LABEL[status] || status
}

// 订阅状态筛选下拉选项（含“未订阅”none）
const SUB_STATUS_OPTIONS = [
  { label: "生效中", value: "active" },
  { label: "已过期", value: "expired" },
  { label: "已取消", value: "canceled" },
  { label: "已暂停", value: "paused" },
  { label: "宽限期", value: "grace" },
  { label: "账单挂起", value: "on_hold" },
  { label: "已撤销", value: "revoked" },
  { label: "未订阅", value: "none" },
]

const UNLOCK_TYPE_LABEL: Record<string, string> = {
  free: "免费集",
  subscription: "会员解锁",
  beans: "Beans解锁",
  ad: "广告解锁",
  locked: "未解锁",
}

interface SubscriptionRecord {
  period: string
  paidAt: string
  orderNo: string
}

interface UnlockRecord {
  dramaName: string
  unlockType: string
  unlockCount: number
  episodes: number[]
  beansCost: number
  unlockedAt: string
  orderNo: string
  adSessionNo: string
}

interface WatchRecord {
  dramaName: string
  episodeNo: number
  unlockType: string
  watchedAt: string
}

interface UserDetail {
  id: string
  userId: string
  appId: number
  appName: string
  openId: string
  unionId: string
  createdAt: string
  subscriptionStatus?: string
  subscriptionExpireAt?: string | null
  subscriptions: SubscriptionRecord[]
  unlocks: UnlockRecord[]
  watchLogs: WatchRecord[]
}

// 将集数数组格式化为 “N集 (第a~b集)” / 断续时展示逗号
function formatEpisodes(count: number, eps: number[]): string {
  if (!eps || eps.length === 0) return `${count}集`
  const sorted = [...eps].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const continuous = sorted.length === max - min + 1
  if (continuous) {
    const range = min === max ? `第${min}集` : `第${min}~${max}集`
    return `${sorted.length}集 (${range})`
  }
  return `${sorted.length}集 (第${sorted.join("、")}集)`
}

interface FilterForm {
  appId: string
  userId: string
  openId: string
  unionId: string
  subscriptionStatus: string
  createdAtRange: DateRangeValue
}

const defaultFilters: FilterForm = {
  appId: "",
  userId: "",
  openId: "",
  unionId: "",
  subscriptionStatus: "",
  createdAtRange: [],
}

// ─────────────── Main Component ───────────────
export default function AppUserManagement() {
  // ─── Filter & Pagination ───
  const { draft: draftFilters, active: activeFilters, update: updateDraft, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page: currentPage, pageSize, resetPage, paginationProps } = usePagination()
  const { options: rawAppOptions } = useAppOptions(100)
  const appOptions = rawAppOptions.map((app) => ({ label: app.name, value: String(app.id) }))

  const fetchList = useCallback(({ page, pageSize, filters }: { page: number; pageSize: number; filters?: FilterForm }) => (
    appUserApi.list<AppUserItem>({
      page,
      pageSize,
      appId: filters?.appId || undefined,
      userId: filters?.userId.trim() || undefined,
      openId: filters?.openId.trim() || undefined,
      unionId: filters?.unionId.trim() || undefined,
      subscriptionStatus: filters?.subscriptionStatus || undefined,
      createdAtFrom: filters?.createdAtRange[0] || undefined,
      createdAtTo: filters?.createdAtRange[1] || undefined,
    })
  ), [])
  const { data, total, loading, error: listError } = usePagedQuery({
    page: currentPage,
    pageSize,
    filters: activeFilters,
    fetcher: fetchList,
  })

  useEffect(() => {
    if (listError) toast.error(listError)
  }, [listError])

  // ─── Detail modal ───
  const [selectedUser, setSelectedUser] = useState<AppUserItem | null>(null)

  function openDetail(row: AppUserItem) {
    setSelectedUser(row)
  }

  // ─── Handlers ───
  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">
      {/* 筛选区 */}
      <FilterBar
        actions={<FilterActions onQuery={handleQuery} onReset={handleReset} />}
      >
        <SelectFilter block label="小程序" value={draftFilters.appId} onChange={(v) => updateDraft("appId", v)} options={appOptions} placeholder="全部" />
        <FilterInput block label="用户ID" placeholder="请输入" value={draftFilters.userId} onChange={(v) => updateDraft("userId", v)} />
        <FilterInput block label="openid" placeholder="请输入" value={draftFilters.openId} onChange={(v) => updateDraft("openId", v)} />
        <FilterInput block label="unionid" placeholder="请输入" value={draftFilters.unionId} onChange={(v) => updateDraft("unionId", v)} />
        <SelectFilter block label="订阅状态" value={draftFilters.subscriptionStatus} onChange={(v) => updateDraft("subscriptionStatus", v)} options={SUB_STATUS_OPTIONS} placeholder="全部" />
        <DateRangePicker block label="注册时间" value={draftFilters.createdAtRange} onChange={(v) => updateDraft("createdAtRange", v)} />
      </FilterBar>

      {/* 表格区 */}
      <FixedHeaderTable
        autoWidth
        minWidth={900}
        columns={new Array(8).fill("")}
        loading={loading && data.length === 0}
        empty={data.length === 0}
        header={["小程序", "用户ID", "openid", "unionid", "注册时间", "订阅状态", "订阅到期时间", "操作"].map((label) => (
          <th key={label} className={thClass}>{label}</th>
        ))}
      >
            {data.map((row, i) => (
                <tr key={row.id}
                  className={cn("transition-colors hover:bg-[#f9fafb]", i < data.length - 1 && "border-b border-[#f3f4f6]")}>
                  <td className="px-4 py-3 text-[12.5px] text-[#111827] whitespace-nowrap">{row.appName}</td>
                  <td className="px-4 py-3 text-[12.5px] font-mono text-[#4b5563] whitespace-nowrap">{row.userId}</td>
                  <td className="px-4 py-3 text-[12.5px] font-mono text-[#4b5563] whitespace-nowrap">{row.openId}</td>
                  <td className="px-4 py-3 text-[12.5px] font-mono text-[#4b5563] whitespace-nowrap">{row.unionId}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium",
                        row.subscriptionStatus === "active"
                          ? "bg-[#e8f7f0] text-[#2da87a]"
                          : row.subscriptionStatus === "expired"
                            ? "bg-[#fef2f2] text-[#dc2626]"
                            : "bg-[#f3f4f6] text-[#6b7280]",
                      )}
                    >
                      {subStatusText(row.subscriptionStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">
                    {row.subscriptionExpireAt ? formatDateTime(row.subscriptionExpireAt) : "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => openDetail(row)}
                      className="text-[12.5px] font-medium text-[#38c08f] transition-colors hover:text-[#2da87a]"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
      </FixedHeaderTable>

      {/* 分页区 */}
      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>

      {selectedUser && (
        <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}

// ─────────────── User Detail Drawer ───────────────
type DetailTab = "subscription" | "unlock" | "watch"

function UserDetailDrawer({
  user,
  onClose,
}: {
  user: AppUserItem
  onClose: () => void
}) {
  const [tab, setTab] = useState<DetailTab>("watch")

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "watch", label: "观看记录" },
    { key: "subscription", label: "会员订阅" },
    { key: "unlock", label: "Beans解锁" },
  ]

  const infoItems = [
    { label: "用户ID", value: user.userId, mono: true },
    { label: "小程序", value: user.appName },
    { label: "openid", value: user.openId, mono: true },
    { label: "unionid", value: user.unionId, mono: true },
    { label: "注册时间", value: formatDateTime(user.createdAt) },
    { label: "当前订阅状态", value: subStatusText(user.subscriptionStatus) },
    { label: "订阅到期时间", value: user.subscriptionExpireAt ? formatDateTime(user.subscriptionExpireAt) : "-" },
  ]

  return (
    <RightDrawer open title="用户详情" width={900} onClose={onClose}>
      {/* User info */}
      <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 border-b border-[#e5e7eb] bg-[#f9fafb] px-6 py-5">
        {infoItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[13px]">
            <span className="shrink-0 text-[#6b7280]">{item.label}：</span>
            <span className={cn("truncate text-[#111827]", item.mono && "font-mono text-[#4b5563]")}>
              {item.value || "-"}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-2 flex shrink-0 gap-1 border-b border-[#e5e7eb] px-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
              tab === t.key
                ? "border-[#38c08f] text-[#38c08f]"
                : "border-transparent text-[#6b7280] hover:text-[#374151]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content：每个 tab 独立分页加载 */}
      {tab === "subscription" && (
        <DetailTab
          userId={user.id}
          columns={["订阅周期", "订阅金额", "时间", "关联订单号"]}
          monoCols={[3]}
          fetcher={(params) => appUserApi.subscriptions(user.id, params)}
          mapRow={(s: any) => [
            PERIOD_LABEL[s.period] || s.period,
            s.amount != null ? String(s.amount) : "-",
            formatDateTime(s.paidAt),
            s.orderNo,
          ]}
        />
      )}
      {tab === "unlock" && (
        <DetailTab
          userId={user.id}
          columns={["剧集名称", "解锁方式", "集数", "消耗Beans", "时间", "关联凭证"]}
          monoCols={[5]}
          fetcher={(params) => appUserApi.unlocks(user.id, params)}
          mapRow={(u: UnlockRecord) => [
            u.dramaName || "-",
            UNLOCK_TYPE_LABEL[u.unlockType] || u.unlockType || "-",
            formatEpisodes(u.unlockCount, u.episodes),
            u.unlockType === "beans" ? String(u.beansCost) : "-",
            formatDateTime(u.unlockedAt),
            u.orderNo || u.adSessionNo || "-",
          ]}
        />
      )}
      {tab === "watch" && (
        <DetailTab
          userId={user.id}
          columns={["剧集名称", "集数", "解锁方式", "时间"]}
          fetcher={(params) => appUserApi.watchLogs(user.id, params)}
          mapRow={(w: any) => [
            w.dramaName || "-",
            `第${w.episodeNo}集`,
            UNLOCK_TYPE_LABEL[w.unlockType] || w.unlockType || "-",
            formatDateTime(w.watchedAt),
          ]}
        />
      )}
    </RightDrawer>
  )
}

// ─────────────── Detail Tab（自带分页的记录列表）───────────────
function DetailTab({
  userId,
  columns,
  monoCols = [],
  fetcher,
  mapRow,
}: {
  userId: number
  columns: string[]
  monoCols?: number[]
  fetcher: (params: any) => Promise<{ list?: any[]; total?: number }>
  mapRow: (item: any) => string[]
}) {
  const { pageSize, resetPage, paginationProps } = usePagination()
  const { currentPage } = paginationProps
  const [rows, setRows] = useState<string[][]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 用户切换时重置到第一页
  useEffect(() => { resetPage() }, [userId, resetPage])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetcher({ page: currentPage, pageSize })
      setRows((res.list || []).map(mapRow))
      setTotal(res.total ?? 0)
    } catch {
      setRows([])
      setTotal(0)
      toast.error("加载失败")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentPage, pageSize])

  useEffect(() => { void load() }, [load])

  return (
    <>
      {loading ? (
        <div className="flex-1 min-h-0 overflow-auto py-12 text-center text-[13px] text-[#9ca3af]">加载中...</div>
      ) : (
        <DetailTable columns={columns} rows={rows} monoCols={monoCols} />
      )}
      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>
    </>
  )
}

function DetailTable({
  columns,
  rows,
  monoCols = [],
}: {
  columns: string[]
  rows: string[][]
  monoCols?: number[]
}) {
  if (rows.length === 0) {
    return <div className="flex-1 min-h-0 overflow-auto py-12 text-center text-[13px] text-[#9ca3af]">暂无记录</div>
  }
  return (
    <FixedHeaderTable
      minWidth={0}
      autoWidth
      columns={columns.map(() => "")}
      header={columns.map((c) => (
        <th key={c} className={thClass}>{c}</th>
      ))}
    >
        {rows.map((row, ri) => (
          <tr
            key={ri}
            className={cn("transition-colors hover:bg-[#f9fafb]", ri < rows.length - 1 && "border-b border-[#f3f4f6]")}
          >
            {row.map((cell, ci) => (
              <td
                key={ci}
                className={cn(
                  "px-4 py-3 text-[12.5px] text-[#374151] whitespace-nowrap",
                  monoCols.includes(ci) && "font-mono text-[#4b5563]",
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
    </FixedHeaderTable>
  )
}
