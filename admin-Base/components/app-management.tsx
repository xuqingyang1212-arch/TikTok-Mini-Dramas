"use client"

import { useState, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, SelectFilter, FormSelect, FilterBar, FilterActions, RightDrawer, FixedHeaderTable, thClass } from "@/components/shared"
import { appApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { usePerm } from "@/components/admin-layout"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"

// ─────────────── Types ───────────────
interface AppItem {
  id: number
  name: string
  appId: string
  clientKey: string
  company: string
  monetizationType: string
  adPlacementId: string
  status: string
  createdAt: string
}

interface AppForm {
  name: string
  appId: string
  clientKey: string
  clientSecret: string
  company: string
  monetizationType: string
  adPlacementId: string
}

interface AppFormErrors {
  name?: string
  appId?: string
  clientKey?: string
  clientSecret?: string
  company?: string
  monetizationType?: string
}

interface FilterForm {
  name: string
  appId: string
  clientKey: string
  company: string
  monetizationType: string
}

const defaultFilters: FilterForm = { name: "", appId: "", clientKey: "", company: "", monetizationType: "" }
const monetizationTypeOptions = [
  { label: "IAA", value: "IAA" },
  { label: "IAP", value: "IAP" },
]

// ─────────────── FormInput ───────────────
function FormInput({
  label, placeholder, value, onChange, error, required, readOnly, type = "text", rightAddon,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  error?: string
  required?: boolean
  readOnly?: boolean
  type?: string
  rightAddon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}{required && !readOnly && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          readOnly={readOnly}
          className={cn(
            "h-[34px] w-full rounded-[6px] border px-3 text-[13px] outline-none transition-colors",
            rightAddon ? "pr-9" : "",
            readOnly
              ? "cursor-default border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af] select-none"
              : cn("bg-white text-[#374151] placeholder-[#9ca3af] focus:border-[#38c08f]",
                  error ? "border-[#f04438]" : "border-[#d1d5db]")
          )}
        />
        {rightAddon && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{rightAddon}</div>
        )}
      </div>
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}

// ─────────────── AppDrawer ───────────────
function AppDrawer({
  mode, app, onClose, onSubmit,
}: {
  mode: "add" | "edit"
  app?: AppItem
  onClose: () => void
  onSubmit: (form: AppForm) => Promise<void>
}) {
  const isEdit = mode === "edit"
  const [form, setForm] = useState<AppForm>(() => (
    isEdit && app
      ? { name: app.name, appId: app.appId, clientKey: app.clientKey, clientSecret: "", company: app.company, monetizationType: app.monetizationType, adPlacementId: app.adPlacementId || "" }
      : { name: "", appId: "", clientKey: "", clientSecret: "", company: "", monetizationType: "", adPlacementId: "" }
  ))
  const [errors, setErrors] = useState<AppFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function setField<K extends keyof AppForm>(key: K, val: AppForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: AppFormErrors = {}
    if (!form.name.trim()) errs.name = "请输入小程序名称"
    if (!form.appId.trim()) errs.appId = "请输入 App ID"
    if (!form.clientKey.trim()) errs.clientKey = "请输入 Client Key"
    // 安全考虑：编辑时 Client Secret 不回显，留空表示不修改；仅新建时必填
    if (!isEdit && !form.clientSecret.trim()) errs.clientSecret = "请输入 Client Secret"
    if (!form.company.trim()) errs.company = "请输入主体信息"
    if (!form.monetizationType) errs.monetizationType = "请选择变现类型"
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
    <RightDrawer width={480} zIndex={50} overlayOpacity={0.2} onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
        <span className="text-[15px] font-semibold text-[#111827]">{isEdit ? "编辑应用" : "新建应用"}</span>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-5">
          <FormInput
            label="小程序名称"
            placeholder="请输入小程序名称"
            value={form.name}
            onChange={(v) => setField("name", v)}
            error={errors.name}
            required
          />
          <FormInput
            label="App ID"
            placeholder="请输入 App ID"
            value={form.appId}
            onChange={(v) => setField("appId", v)}
            error={errors.appId}
            required
          />
          <FormInput
            label="Client Key"
            placeholder="请输入 Client Key"
            value={form.clientKey}
            onChange={(v) => setField("clientKey", v)}
            error={errors.clientKey}
            required
          />
          <FormInput
            label="Client Secret"
            placeholder={isEdit ? "不修改请留空" : "请输入 Client Secret"}
            value={form.clientSecret}
            onChange={(v) => setField("clientSecret", v)}
            error={errors.clientSecret}
            required={!isEdit}
          />
          <FormInput
            label="主体信息"
            placeholder="请输入主体信息"
            value={form.company}
            onChange={(v) => setField("company", v)}
            error={errors.company}
            required
          />
          <FormSelect
            label="变现类型"
            value={form.monetizationType}
            onChange={(v) => {
              setField("monetizationType", v)
              if (v !== "IAA") setField("adPlacementId", "")
            }}
            options={monetizationTypeOptions}
            error={errors.monetizationType}
            required
          />
          {form.monetizationType === "IAA" && (
            <FormInput
              label="广告位 ID"
              placeholder="请输入激励广告位 ID"
              value={form.adPlacementId}
              onChange={(v) => setField("adPlacementId", v)}
            />
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#e5e7eb] px-6 py-4">
        <button onClick={onClose}
          className="flex h-[32px] items-center rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]">
          取消
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex h-[32px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a] disabled:opacity-60">
          {submitting ? "提交中..." : "确认"}
        </button>
      </div>
    </RightDrawer>
  )
}

// ─────────────── Main Component ───────────────
export default function AppManagement() {
  const canAdd = usePerm("operation.app.add")
  const canEdit = usePerm("operation.app.edit")

  // ─── Filter & Pagination ───
  const { draft: draftFilters, active: activeFilters, update: updateDraft, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page: currentPage, pageSize, resetPage, paginationProps } = usePagination()

  // ─── Data ───
  const [data, setData] = useState<AppItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // ─── Drawer ───
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | null>(null)
  const [editingApp, setEditingApp] = useState<AppItem | null>(null)

  // ─── Fetch list ───
  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await appApi.list<AppItem>({
        page: currentPage,
        pageSize,
        name: activeFilters.name.trim() || undefined,
        appId: activeFilters.appId.trim() || undefined,
        company: activeFilters.company.trim() || undefined,
        monetizationType: activeFilters.monetizationType || undefined,
      })
      setData(res.list || [])
      setTotal(res.total ?? 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, activeFilters])

  useEffect(() => { void fetchList() }, [fetchList])

  // ─── Handlers ───
  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  function openAdd() { setEditingApp(null); setDrawerMode("add") }
  function openEdit(app: AppItem) { setEditingApp(app); setDrawerMode("edit") }
  function closeDrawer() { setDrawerMode(null); setEditingApp(null) }

  async function handleAdd(form: AppForm) {
    try {
      await appApi.create(form)
      toast.success("创建成功")
      closeDrawer()
      resetPage()
      await fetchList()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败")
      throw e
    }
  }

  async function handleEdit(form: AppForm) {
    if (!editingApp) return
    try {
      await appApi.update(editingApp.id, form)
      toast.success("更新成功")
      closeDrawer()
      await fetchList()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败")
      throw e
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">

      {drawerMode && (
        <AppDrawer
          mode={drawerMode}
          app={editingApp ?? undefined}
          onClose={closeDrawer}
          onSubmit={drawerMode === "add" ? handleAdd : handleEdit}
        />
      )}

      {/* 筛选区 */}
      <FilterBar
        actions={<FilterActions onQuery={handleQuery} onReset={handleReset} />}
      >
        <FilterInput block label="小程序名称" placeholder="请输入" value={draftFilters.name} onChange={(v) => updateDraft("name", v)} />
        <FilterInput block label="App ID" placeholder="请输入" value={draftFilters.appId} onChange={(v) => updateDraft("appId", v)} />
        <FilterInput block label="主体信息" placeholder="请输入" value={draftFilters.company} onChange={(v) => updateDraft("company", v)} />
        <SelectFilter block label="变现类型" value={draftFilters.monetizationType} onChange={(v) => updateDraft("monetizationType", v)} options={monetizationTypeOptions} placeholder="全部" />
      </FilterBar>

      {/* 工具栏（新建按钮） */}
      {canAdd && (
        <div className="flex shrink-0 items-center px-5 py-3">
          <button onClick={openAdd}
            className="flex h-[30px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]">
            + 新建应用
          </button>
        </div>
      )}

      {/* 表格区 */}
      <FixedHeaderTable
        minWidth={820}
        columns={["w-[180px]", "w-[220px]", "w-[280px]", "", "w-[90px]"]}
        loading={loading && data.length === 0}
        empty={data.length === 0}
        header={["小程序名称", "App ID", "主体信息", "变现类型", "操作"].map((label) => (
          <th key={label} className={thClass}>{label}</th>
        ))}
      >
            {data.map((row, i) => (
                <tr key={row.id}
                  className={cn("transition-colors hover:bg-[#f9fafb]", i < data.length - 1 && "border-b border-[#f3f4f6]")}>
                  <td className="px-4 py-3 text-[12.5px] font-medium text-[#111827] whitespace-nowrap">{row.name}</td>
                  <td className="px-4 py-3 text-[12.5px] font-mono text-[#4b5563] whitespace-nowrap">{row.appId}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.company}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.monetizationType}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {canEdit && (
                      <button onClick={() => openEdit(row)}
                        className="flex h-[26px] items-center rounded-[4px] border border-[#38c08f] bg-white px-2.5 text-[12px] text-[#38c08f] transition-colors hover:bg-[#edfaf4]">
                        编辑
                      </button>
                    )}
                  </td>
                </tr>
                ))}
      </FixedHeaderTable>

      {/* 分页区 */}
      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>
    </div>
  )
}
