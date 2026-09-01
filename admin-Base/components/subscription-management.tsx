"use client"

import { useState, useEffect, useCallback } from "react"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, SelectFilter, RightDrawer, Popconfirm, FormInput, FormSelect, FilterBar, FilterActions, FixedHeaderTable, thClass } from "@/components/shared"
import { subscriptionApi, type SubscriptionPlanItem } from "@/lib/api"
import { toast } from "@/lib/toast"
import { usePerm } from "@/components/admin-layout"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"
import { useAppOptions } from "@/hooks/use-app-options"

// ─────────────── Types ───────────────
interface AppOption {
  id: number
  name: string
}

interface FilterForm {
  appId: string
  period: string
  tierId: string
}

interface PlanForm {
  appId: string
  period: string
  applePrice: string
  googlePrice: string
  webDiscount: string
  tierId: string
}

interface PlanFormErrors {
  appId?: string
  period?: string
  applePrice?: string
  googlePrice?: string
  webDiscount?: string
  tierId?: string
}

const defaultFilters: FilterForm = { appId: "", period: "", tierId: "" }

const periodOptions = [
  { label: "周", value: "weekly" },
  { label: "月", value: "monthly" },
  { label: "季度", value: "quarterly" },
  { label: "半年", value: "half_yearly" },
  { label: "年", value: "yearly" },
]

const periodLabels: Record<string, string> = {
  weekly: "周",
  monthly: "月",
  quarterly: "季度",
  half_yearly: "半年",
  yearly: "年",
}

// ─────────────── PlanDrawer ───────────────
function PlanDrawer({
  open, mode, plan, appOptions, onClose, onSubmit,
}: {
  open: boolean
  mode: "add" | "edit"
  plan?: SubscriptionPlanItem
  appOptions: AppOption[]
  onClose: () => void
  onSubmit: (form: PlanForm) => Promise<void>
}) {
  const initForm: PlanForm = {
    appId: plan?.appId || "",
    period: plan?.period || "",
    applePrice: plan ? String(plan.applePrice) : "",
    googlePrice: plan ? String(plan.googlePrice) : "",
    webDiscount: plan ? String(plan.webDiscount) : "0",
    tierId: plan?.tierId || "",
  }

  const [form, setForm] = useState<PlanForm>(initForm)
  const [errors, setErrors] = useState<PlanFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initForm)
      setErrors({})
    }
  }, [open])

  function validate(): boolean {
    const errs: PlanFormErrors = {}
    if (!form.appId) errs.appId = "请选择小程序"
    if (!form.period) errs.period = "请选择订阅周期"
    const apple = parseFloat(form.applePrice)
    if (form.applePrice.trim() === "") errs.applePrice = "请输入Apple价格"
    else if (isNaN(apple) || apple < 0) errs.applePrice = "价格不能为负数"
    const google = parseFloat(form.googlePrice)
    if (form.googlePrice.trim() === "") errs.googlePrice = "请输入Google价格"
    else if (isNaN(google) || google < 0) errs.googlePrice = "价格不能为负数"
    const discount = parseInt(form.webDiscount, 10)
    if (form.webDiscount.trim() === "") errs.webDiscount = "请输入网页端折扣"
    else if (isNaN(discount) || discount < 0 || discount > 100) errs.webDiscount = "折扣须为0-100的整数"
    if (!form.tierId.trim()) errs.tierId = "请输入tier_id"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      await onSubmit(form)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RightDrawer open={open} title={mode === "add" ? "新建订阅配置" : "编辑订阅配置"} width={520} onClose={onClose}>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <FormSelect
          label="小程序"
          required
          value={form.appId}
          onChange={(v) => setForm((p) => ({ ...p, appId: v }))}
          options={appOptions.map((a) => ({ label: a.name, value: String(a.id) }))}
          error={errors.appId}
        />
        <FormSelect
          label="订阅周期"
          required
          value={form.period}
          onChange={(v) => setForm((p) => ({ ...p, period: v }))}
          options={periodOptions}
          error={errors.period}
        />
        <FormInput
          label="Apple价格（USD）"
          required
          type="number"
          min={0}
          placeholder="请输入Apple价格"
          value={form.applePrice}
          onChange={(v) => setForm((p) => ({ ...p, applePrice: v }))}
          error={errors.applePrice}
        />
        <FormInput
          label="Google价格（USD）"
          required
          type="number"
          min={0}
          placeholder="请输入Google价格"
          value={form.googlePrice}
          onChange={(v) => setForm((p) => ({ ...p, googlePrice: v }))}
          error={errors.googlePrice}
        />
        <FormInput
          label="网页端折扣（%）"
          required
          type="number"
          min={0}
          max={100}
          placeholder="请输入0-100整数"
          value={form.webDiscount}
          onChange={(v) => setForm((p) => ({ ...p, webDiscount: v }))}
          error={errors.webDiscount}
        />
        <FormInput
          label="tier_id"
          required
          placeholder="请输入tier_id"
          value={form.tierId}
          onChange={(v) => setForm((p) => ({ ...p, tierId: v }))}
          error={errors.tierId}
        />
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#e5e7eb] px-6 py-4">
        <button
          onClick={onClose}
          className="flex h-[32px] items-center rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex h-[32px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a] disabled:opacity-60"
        >
          {submitting ? "提交中..." : "确认"}
        </button>
      </div>
    </RightDrawer>
  )
}

// ─────────────── Main Component ───────────────
export default function SubscriptionManagement() {

  const canAdd = usePerm("operation.subs.add")
  const canEdit = usePerm("operation.subs.edit")
  const canDelete = usePerm("operation.subs.delete")

  const { draft: draftFilters, active: appliedFilters, update: setDraftField, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page, pageSize, resetPage, paginationProps } = usePagination()

  const [list, setList] = useState<SubscriptionPlanItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const { options: appOptionsRaw } = useAppOptions()
  const appOptions: AppOption[] = appOptionsRaw.map((app) => ({ id: Number(app.id), name: app.name }))

  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | null>(null)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanItem | undefined>()

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await subscriptionApi.list({
        page,
        pageSize,
        appId: appliedFilters.appId || undefined,
        period: appliedFilters.period || undefined,
        tierId: appliedFilters.tierId || undefined,
      })
      setList(res.list)
      setTotal(res.total)
    } catch {
      toast.error("加载失败")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, appliedFilters])

  useEffect(() => { void fetchList() }, [fetchList])

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  function handleCreate() {
    if (!canAdd) {
      toast.error("暂无新建权限")
      return
    }
    setEditingPlan(undefined)
    setDrawerMode("add")
  }

  function handleEdit(row: SubscriptionPlanItem) {
    if (!canEdit) {
      toast.error("暂无编辑权限")
      return
    }
    setEditingPlan(row)
    setDrawerMode("edit")
  }

  async function handleDelete(row: SubscriptionPlanItem) {
    if (!canDelete) {
      toast.error("暂无删除权限")
      return
    }
    try {
      await subscriptionApi.delete(row.id)
      toast.success("删除成功")
      fetchList()
    } catch (err: any) {
      toast.error(err.message || "删除失败")
    }
  }

  async function handleSubmit(form: PlanForm) {
    if (drawerMode === "add" && !canAdd) {
      toast.error("暂无新建权限")
      return
    }
    if (drawerMode === "edit" && !canEdit) {
      toast.error("暂无编辑权限")
      return
    }
    const body = {
      appId: parseInt(form.appId, 10),
      period: form.period,
      applePrice: parseFloat(form.applePrice) || 0,
      googlePrice: parseFloat(form.googlePrice) || 0,
      webDiscount: parseInt(form.webDiscount, 10) || 0,
      tierId: form.tierId,
    }
    try {
      if (drawerMode === "add") {
        await subscriptionApi.create(body)
        toast.success("创建成功")
      } else if (editingPlan) {
        await subscriptionApi.update(editingPlan.id, body)
        toast.success("更新成功")
      }
      setDrawerMode(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message || "保存失败")
    }
  }

  const tableHeaders = [
    { label: "小程序", w: "w-[160px]" },
    { label: "订阅周期", w: "w-[100px]" },
    { label: "Apple价格", w: "w-[120px]" },
    { label: "Google价格", w: "w-[120px]" },
    { label: "网页端折扣", w: "w-[110px]" },
    { label: "tier_id", w: "w-[180px]" },
    { label: "操作", w: "w-[140px]" },
  ]

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">
      {/* 筛选区 */}
      <FilterBar
        actions={<FilterActions onQuery={handleQuery} onReset={handleReset} />}
      >
        <SelectFilter
          block
          label="小程序"
          placeholder="全部"
          value={draftFilters.appId}
          onChange={(v) => setDraftField("appId", v)}
          options={appOptions.map(a => ({ label: a.name, value: String(a.id) }))}
        />
        <SelectFilter
          block
          label="订阅周期"
          placeholder="全部"
          value={draftFilters.period}
          onChange={(v) => setDraftField("period", v)}
          options={periodOptions}
        />
        <FilterInput
          block
          label="tier_id"
          placeholder="请输入tier_id"
          value={draftFilters.tierId}
          onChange={(v) => setDraftField("tierId", v)}
        />
      </FilterBar>

      {/* 工具栏（新建按钮） */}
      {canAdd && (
        <div className="flex shrink-0 items-center px-5 py-3">
          <button
            onClick={handleCreate}
            className="flex h-[30px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]"
          >
            + 新建订阅配置
          </button>
        </div>
      )}

      {/* 表格：统一固定表头组件 */}
      <FixedHeaderTable
        minWidth={900}
        columns={tableHeaders.map((h) => h.w)}
        loading={loading}
        empty={list.length === 0}
        stateCellClassName="py-12"
        header={tableHeaders.map((h) => (
          <th key={h.label} className={thClass}>{h.label}</th>
        ))}
      >
            {list.map((row) => (
              <tr key={row.id} className="border-b border-[#f3f4f6] hover:bg-[#f9fafb]/60">
                <td className="px-4 py-3 text-[#374151]">{row.appName || "-"}</td>
                <td className="px-4 py-3 text-[#374151]">{periodLabels[row.period] || row.period}</td>
                <td className="px-4 py-3 text-[#374151]">${row.applePrice?.toFixed(2) ?? "0.00"}</td>
                <td className="px-4 py-3 text-[#374151]">${row.googlePrice?.toFixed(2) ?? "0.00"}</td>
                <td className="px-4 py-3 text-[#374151]">{row.webDiscount}%</td>
                <td className="px-4 py-3 text-[#374151] font-mono text-[12px]">{row.tierId || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button onClick={() => handleEdit(row)} className="text-[#38c08f] hover:underline">编辑</button>
                    )}
                    {canDelete && (
                      <Popconfirm
                        title="确认删除该订阅配置？"
                        onConfirm={() => handleDelete(row)}
                      >
                        <button className="text-[#dc2626] hover:underline">删除</button>
                      </Popconfirm>
                    )}
                  </div>
                </td>
              </tr>
            ))}
      </FixedHeaderTable>

      {/* 分页 */}
      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>

      {/* 抽屉 */}
      <PlanDrawer
        open={drawerMode !== null}
        mode={drawerMode || "add"}
        plan={editingPlan}
        appOptions={appOptions}
        onClose={() => setDrawerMode(null)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
