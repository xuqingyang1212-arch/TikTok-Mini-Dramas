"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { dramaApi, promotionLinkApi, type PromotionLinkListItem } from "@/lib/api"
import { toast } from "@/lib/toast"
import { useAppOptions } from "@/hooks/use-app-options"
import { usePerm } from "@/components/admin-layout"
import { PromotionOptionSelect } from "@/components/promotion-option-select"
import { useFilters } from "@/hooks/use-filters"
import { usePagedQuery } from "@/hooks/use-paged-query"
import { usePagination } from "@/hooks/use-pagination"
import { ListPagination } from "@/components/list-pagination"
import { ActionButton, CopyButton, ExportButton, FilterActions, FilterBar, FilterInput, FixedHeaderTable, FormInput, MonetizationBadge, RightDrawer, SelectFilter, thClass } from "@/components/shared"

interface FilterForm {
  name: string
  appId: string
  drama: string
  linkId: string
}

const defaultFilters: FilterForm = { name: "", appId: "", drama: "", linkId: "" }

type DramaOption = { id: string; name: string; episodeCount: number; paywallEpisode: number }

const DRAMA_SEARCH_DEBOUNCE_MS = 300

function buildPromotionLinkFilterParams(filters: FilterForm) {
  return {
    name: filters.name.trim() || undefined,
    appId: filters.appId || undefined,
    drama: filters.drama.trim() || undefined,
    linkId: filters.linkId.trim() || undefined,
  }
}

function PromotionInfoRow({ label, value, children, onCopy }: {
  label: string
  value: string
  children?: ReactNode
  onCopy: (value: string, label: string) => void
}) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)_70px] items-center gap-3 py-3">
      <div className="text-[13px] text-[#6b7280]">{label}</div>
      <div className="min-w-0 text-[13px] text-[#111827]">
        {children ?? <span className="block break-all">{value || "-"}</span>}
      </div>
      <CopyButton
        disabled={!value}
        onClick={() => onCopy(value, label)}
      />
    </div>
  )
}

export default function CampaignLinkManagement() {
  const canAdd = usePerm("campaign.link.add")
  const canExport = usePerm("campaign.link.export")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [promotionInfo, setPromotionInfo] = useState<PromotionLinkListItem | null>(null)
  const [form, setForm] = useState({ name: "", appId: "", dramaId: "", paywallEpisode: "", beansPerEp: "100" })
  const [dramas, setDramas] = useState<DramaOption[]>([])
  const [selectedDrama, setSelectedDrama] = useState<DramaOption | null>(null)
  const [dramaLoading, setDramaLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const dramaRequestRef = useRef(0)
  const { draft, active, update, apply, reset } = useFilters(defaultFilters)
  const { page, pageSize, resetPage, paginationProps } = usePagination()
  const { options: apps, error: appError } = useAppOptions(1000)
  const appOptions = apps.filter((app) => app.status !== "禁用").map((app) => ({
    label: app.name,
    value: String(app.id),
    extra: <MonetizationBadge type={app.monetizationType} />,
  }))
  const selectedApp = apps.find((app) => String(app.id) === form.appId) ?? null
  const requiresBeansPrice = selectedApp?.monetizationType === "IAP"

  const fetchList = useCallback(({ page, pageSize, filters }: {
    page: number
    pageSize: number
    filters?: FilterForm
  }) => promotionLinkApi.list({
    page,
    pageSize,
    ...buildPromotionLinkFilterParams(filters ?? defaultFilters),
  }), [])

  const { data, total, loading, error, refresh } = usePagedQuery<PromotionLinkListItem, FilterForm>({
    page,
    pageSize,
    filters: active,
    fetcher: fetchList,
  })

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
      await promotionLinkApi.export(buildPromotionLinkFilterParams(active))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导出失败")
    } finally {
      setExporting(false)
    }
  }

  const searchDramas = useCallback(async (keyword = "") => {
    const requestId = ++dramaRequestRef.current
    setDramaLoading(true)
    try {
      const trimmed = keyword.trim()
      const result = await dramaApi.list<DramaOption>({
        page: 1,
        pageSize: 50,
        status: "上架",
        dramaId: /^\d+$/.test(trimmed) ? trimmed : undefined,
        name: trimmed && !/^\d+$/.test(trimmed) ? trimmed : undefined,
      })
      if (requestId === dramaRequestRef.current) setDramas(result.list ?? [])
    } catch (err) {
      if (requestId === dramaRequestRef.current) toast.error(err instanceof Error ? err.message : "剧集加载失败")
    } finally {
      if (requestId === dramaRequestRef.current) setDramaLoading(false)
    }
  }, [])

  function openDrawer() {
    setForm({ name: "", appId: "", dramaId: "", paywallEpisode: "", beansPerEp: "100" })
    setSelectedDrama(null)
    setDrawerOpen(true)
    void searchDramas()
  }

  async function copyInfo(value: string, label: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = value
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand("copy")
        textarea.remove()
        if (!copied) throw new Error("copy failed")
      }
      toast.success(`${label}已复制`)
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限")
    }
  }

  async function handleCreate() {
    if (!form.appId || !selectedApp || !form.dramaId || !selectedDrama) {
      toast.error("请选择小程序和剧集")
      return
    }
    const paywallEpisode = Number(form.paywallEpisode)
    const beansPerEp = Number(form.beansPerEp)
    if (!Number.isInteger(paywallEpisode) || paywallEpisode < 1 || paywallEpisode > selectedDrama.episodeCount) {
      toast.error(`卡点集数必须是 1 到 ${selectedDrama.episodeCount} 之间的整数`)
      return
    }
    if (requiresBeansPrice && (!Number.isInteger(beansPerEp) || beansPerEp < 10 || beansPerEp > 500)) {
      toast.error("单集 Beans 价格必须是 10 到 500 之间的整数")
      return
    }
    setSubmitting(true)
    try {
      const result = await promotionLinkApi.create({
        name: form.name.trim() || undefined,
        appId: form.appId,
        dramaId: form.dramaId,
        paywallEpisode,
        ...(requiresBeansPrice ? { beansPerEp } : {}),
      })
      toast.success(`推广链接创建成功，Linkid：${result.linkId}`)
      setDrawerOpen(false)
      setPromotionInfo(result)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">
      <FilterBar actions={
        <FilterActions onQuery={handleQuery} onReset={handleReset}>
          {canExport && (
            <ExportButton exporting={exporting} onClick={() => void handleExport()} />
          )}
        </FilterActions>
      }>
        <FilterInput block label="链接名称" placeholder="请输入" value={draft.name} onChange={(value) => update("name", value)} />
        <SelectFilter block label="小程序" placeholder="全部" value={draft.appId} onChange={(value) => update("appId", value)} options={appOptions} />
        <FilterInput block label="剧集" placeholder="请输入剧集ID或名称" value={draft.drama} onChange={(value) => update("drama", value)} />
        <FilterInput block label="Linkid" placeholder="请输入" value={draft.linkId} onChange={(value) => update("linkId", value)} />
      </FilterBar>

      {canAdd && (
        <div className="flex shrink-0 items-center border-b border-[#e5e7eb] px-5 py-3">
          <button
            type="button"
            onClick={openDrawer}
            className="flex h-[30px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]"
          >
            新建推广链接
          </button>
        </div>
      )}

      <FixedHeaderTable
        autoWidth
        minWidth={1120}
        columns={new Array(8).fill("")}
        loading={loading && data.length === 0}
        empty={data.length === 0}
        emptyText="暂无推广链接"
        header={["链接名称", "小程序", "剧集", "卡点集数", "单集 Beans 价格", "Linkid", "创建人", "操作"].map((label) => (
          <th key={label} className={thClass}>{label}</th>
        ))}
      >
        {data.map((row, index) => (
          <tr key={row.linkId} className={cn("transition-colors hover:bg-[#f9fafb]", index < data.length - 1 && "border-b border-[#f3f4f6]")}>
            <td className="px-4 py-3 text-[12.5px] font-medium text-[#111827] whitespace-nowrap">{row.name}</td>
            <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span>{row.appName}</span>
                <MonetizationBadge type={row.monetizationType} />
              </div>
            </td>
            <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span>{row.dramaName}</span>
                <span className="font-mono text-[11.5px] text-[#9ca3af]">ID: {row.dramaId}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.paywallEpisode}</td>
            <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.beansPerEp ?? "-"}</td>
            <td className="px-4 py-3 font-mono text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.linkId}</td>
            <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.creatorName}</td>
            <td className="px-4 py-3 whitespace-nowrap">
              <ActionButton onClick={() => setPromotionInfo(row)}>
                推广信息
              </ActionButton>
            </td>
          </tr>
        ))}
      </FixedHeaderTable>

      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>

      <RightDrawer open={Boolean(promotionInfo)} title="推广信息" onClose={() => setPromotionInfo(null)}>
        {promotionInfo && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <section>
              <h3 className="mb-1 text-[14px] font-semibold text-[#111827]">小程序信息</h3>
              <PromotionInfoRow
                label="小程序名称"
                value={promotionInfo.appName}
                onCopy={copyInfo}
              >
                <div className="flex items-center gap-2">
                  <span>{promotionInfo.appName}</span>
                  <MonetizationBadge type={promotionInfo.monetizationType} />
                </div>
              </PromotionInfoRow>
              <PromotionInfoRow label="Appid" value={promotionInfo.tiktokAppId} onCopy={copyInfo} />
            </section>

            <section className="mt-6">
              <h3 className="mb-3 text-[14px] font-semibold text-[#111827]">推广链接</h3>
              <div className="grid grid-cols-[minmax(0,1fr)_70px] items-center gap-3">
                <span className="min-w-0 truncate text-[13px] text-[#111827]" title={promotionInfo.promotionUrl || undefined}>
                  {promotionInfo.promotionUrl || "-"}
                </span>
                <CopyButton
                  disabled={!promotionInfo.promotionUrl}
                  onClick={() => copyInfo(promotionInfo.promotionUrl, "推广链接")}
                />
              </div>
            </section>
          </div>
        )}
      </RightDrawer>

      <RightDrawer open={drawerOpen} title="新建推广链接" onClose={() => !submitting && setDrawerOpen(false)}>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <FormInput label="链接名称" placeholder="为空时使用剧集名称-创建人" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
            <PromotionOptionSelect label="小程序" required value={form.appId} placeholder="请选择小程序" options={appOptions} onChange={(appId) => setForm((current) => ({ ...current, appId, beansPerEp: "100" }))} />
            <PromotionOptionSelect
              label="剧集"
              required
              searchable
              loading={dramaLoading}
              searchPlaceholder="输入剧集名称（模糊）或完整剧集ID"
              searchDebounceMs={DRAMA_SEARCH_DEBOUNCE_MS}
              value={form.dramaId}
              placeholder="请选择已上架剧集"
              options={dramas.map((drama) => ({ value: String(drama.id), label: drama.name, extra: <span className="font-mono text-[11px] text-[#9ca3af]">ID: {drama.id}</span> }))}
              onSearch={(keyword) => void searchDramas(keyword)}
              onChange={(dramaId) => {
                const drama = dramas.find((item) => String(item.id) === dramaId) ?? null
                setSelectedDrama(drama)
                setForm((current) => ({
                  ...current,
                  dramaId,
                  paywallEpisode: drama ? String(drama.paywallEpisode) : "",
                }))
              }}
            />
            <FormInput
              label={selectedDrama ? `卡点集数（1~${selectedDrama.episodeCount}）` : "卡点集数"}
              required
              type="number"
              min={1}
              max={selectedDrama?.episodeCount}
              step={1}
              disabled={!selectedDrama}
              placeholder={selectedDrama ? "请输入卡点集数" : "请先选择剧集"}
              value={form.paywallEpisode}
              onChange={(paywallEpisode) => setForm((current) => ({ ...current, paywallEpisode }))}
            />
            {requiresBeansPrice && (
              <FormInput
                label="单集 Beans 价格（10~500）"
                required
                type="number"
                min={10}
                max={500}
                step={1}
                placeholder="请输入单集 Beans 价格"
                value={form.beansPerEp}
                onChange={(beansPerEp) => setForm((current) => ({ ...current, beansPerEp }))}
              />
            )}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-[#e5e7eb] px-6 py-4">
            <button type="button" disabled={submitting} onClick={() => setDrawerOpen(false)} className="h-[34px] rounded-[6px] border border-[#d1d5db] px-4 text-[13px] text-[#374151] disabled:opacity-50">取消</button>
            <button type="button" disabled={submitting} onClick={() => void handleCreate()} className="h-[34px] rounded-[6px] bg-[#13a673] px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "提交中..." : "提交"}</button>
          </div>
        </div>
      </RightDrawer>
    </div>
  )
}
