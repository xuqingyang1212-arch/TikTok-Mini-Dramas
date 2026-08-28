"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, SelectFilter, RightDrawer, Popconfirm, FilterBar, FilterActions, FixedHeaderTable, thClass } from "@/components/shared"
import { paymentConfigApi, appApi, dramaApi, type PaymentConfigItem } from "@/lib/api"
import { toast } from "@/lib/toast"
import { formatDateTime } from "@/lib/format"
import { usePerm } from "@/components/admin-layout"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"

// ─────────────── Types ───────────────
interface AppOption {
  id: string
  name: string
}

interface DramaOption {
  id: string
  name: string
}

interface FilterForm {
  appId: string
  dramaId: string
  configType: string
}

interface ConfigForm {
  appId: string
  dramaId: string
  beansPerEp: number
  description: string
}

interface ConfigFormErrors {
  beansPerEp?: string
}

const defaultFilters: FilterForm = { appId: "", dramaId: "", configType: "" }

const configTypeOptions = [
  { label: "全局默认", value: "全局默认" },
  { label: "小程序级", value: "小程序级" },
  { label: "剧集级", value: "剧集级" },
  { label: "小程序+剧集", value: "小程序+剧集" },
]

// 配置类型颜色
const configTypeColors: Record<string, string> = {
  "全局默认": "bg-[#f3f4f6] text-[#6b7280]",
  "小程序级": "bg-[#dbeafe] text-[#2563eb]",
  "剧集级": "bg-[#fef3c7] text-[#d97706]",
  "小程序+剧集": "bg-[#d1fae5] text-[#059669]",
}

// ─────────────── FormInput ───────────────
function FormInput({
  label, placeholder, value, onChange, error, required, type = "text", min,
}: {
  label: string
  placeholder: string
  value: string | number
  onChange: (v: string) => void
  error?: string
  required?: boolean
  type?: string
  min?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}{required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-[34px] w-full rounded-[6px] border px-3 text-[13px] outline-none transition-colors",
          "bg-white text-[#374151] placeholder-[#9ca3af] focus:border-[#38c08f]",
          error ? "border-[#f04438]" : "border-[#d1d5db]"
        )}
      />
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}

// ─────────────── FormSelect ───────────────
function FormSelect({
  label, value, onChange, options, error, required, placeholder = "请选择", allowClear = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  error?: string
  required?: boolean
  placeholder?: string
  allowClear?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}{required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-[34px] w-full appearance-none rounded-[6px] border pl-3 pr-8 text-[13px] outline-none transition-colors",
            "bg-white focus:border-[#38c08f]",
            value === "" ? "text-[#9ca3af]" : "text-[#374151]",
            error ? "border-[#f04438]" : "border-[#d1d5db]"
          )}
        >
          {allowClear ? (
            <option value="" className="text-[#374151]">不限（继承上级配置）</option>
          ) : (
            <option value="" disabled hidden>{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-[#374151]">{opt.label}</option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"
        />
      </div>
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}

// ─────────────── ConfigDrawer ───────────────
function ConfigDrawer({
  mode, config, appOptions, dramaOptions, onClose, onSubmit,
}: {
  mode: "add" | "edit"
  config?: PaymentConfigItem
  appOptions: AppOption[]
  dramaOptions: DramaOption[]
  onClose: () => void
  onSubmit: (form: ConfigForm) => Promise<void>
}) {
  const isEdit = mode === "edit"
  const isGlobal = isEdit && config?.configType === "全局默认"

  const [form, setForm] = useState<ConfigForm>(() => (
    isEdit && config
      ? {
          appId: config.appId || "",
          dramaId: config.dramaId || "",
          beansPerEp: config.beansPerEp,
          description: config.description || "",
        }
      : { appId: "", dramaId: "", beansPerEp: 100, description: "" }
  ))
  const [errors, setErrors] = useState<ConfigFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function setField<K extends keyof ConfigForm>(key: K, val: ConfigForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: ConfigFormErrors = {}
    if (form.beansPerEp < 1) errs.beansPerEp = "每集消耗Beans必须大于0"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // 计算配置类型说明
  function getConfigTypeHint(): string {
    if (isGlobal) return "全局默认配置，作为所有未覆盖场景的兜底"
    if (!form.appId && !form.dramaId) return "不选择时将修改全局默认配置"
    if (form.appId && form.dramaId) return "针对特定小程序下的特定剧集生效（最高优先级）"
    if (form.appId) return "针对该小程序下所有剧集生效"
    if (form.dramaId) return "针对该剧集在所有小程序生效"
    return ""
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
    <RightDrawer title={isEdit ? "编辑支付配置" : "新建支付配置"} onClose={onClose}>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {/* 配置范围说明 */}
        <div className="rounded-[6px] bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-2.5">
          <p className="text-[12px] text-[#15803d] leading-relaxed">
            <strong>配置优先级：</strong>小程序+剧集 &gt; 剧集级 &gt; 小程序级 &gt; 全局默认
          </p>
        </div>

        {!isGlobal && (
          <>
            <FormSelect
              label="小程序"
              value={form.appId}
              onChange={(v) => setField("appId", v)}
              options={appOptions.map(a => ({ label: a.name, value: a.id }))}
              allowClear
            />

            <FormSelect
              label="剧集"
              value={form.dramaId}
              onChange={(v) => setField("dramaId", v)}
              options={dramaOptions.map(d => ({ label: d.name, value: d.id }))}
              allowClear
            />
          </>
        )}

        {/* 配置类型提示 */}
        <div className="text-[12px] text-[#6b7280]">
          {getConfigTypeHint()}
        </div>

        <FormInput
          label="每集消耗Beans"
          placeholder="如 100"
          value={form.beansPerEp}
          onChange={(v) => setField("beansPerEp", parseInt(v, 10) || 0)}
          error={errors.beansPerEp}
          required
          type="number"
          min={1}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#374151]">备注</label>
          <textarea
            placeholder="配置说明（可选）"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={3}
            className="w-full rounded-[6px] border border-[#d1d5db] bg-white px-3 py-2 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none transition-colors focus:border-[#38c08f]"
          />
        </div>
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
export default function PaymentConfigManagement() {
  
  const canAdd = usePerm("operation.payment.add")
  const canEdit = usePerm("operation.payment.edit")
  const canDelete = usePerm("operation.payment.delete")

  const { draft: draftFilters, active: appliedFilters, update: setDraftField, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page, pageSize, resetPage, paginationProps } = usePagination()

  const [list, setList] = useState<PaymentConfigItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [appOptions, setAppOptions] = useState<AppOption[]>([])
  const [dramaOptions, setDramaOptions] = useState<DramaOption[]>([])

  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | null>(null)
  const [editingConfig, setEditingConfig] = useState<PaymentConfigItem | undefined>()

  // 加载小程序和剧集列表
  useEffect(() => {
    appApi.list({ pageSize: 1000 }).then((res) => {
      setAppOptions(res.list.map((a: any) => ({ id: String(a.id), name: a.name })))
    }).catch(() => {})

    dramaApi.list({ pageSize: 1000 }).then((res) => {
      setDramaOptions(res.list.map((d: any) => ({ id: String(d.id), name: d.name })))
    }).catch(() => {})
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await paymentConfigApi.list({
        page,
        pageSize,
        appId: appliedFilters.appId || undefined,
        dramaId: appliedFilters.dramaId || undefined,
        configType: appliedFilters.configType || undefined,
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
    setEditingConfig(undefined)
    setDrawerMode("add")
  }

  function handleEdit(row: PaymentConfigItem) {
    setEditingConfig(row)
    setDrawerMode("edit")
  }

  async function handleDelete(row: PaymentConfigItem) {
    try {
      await paymentConfigApi.delete(row.id)
      toast.success("删除成功")
      fetchList()
    } catch (err: any) {
      toast.error(err.message || "删除失败")
    }
  }

  async function handleSubmit(form: ConfigForm) {
    const body = {
      appId: form.appId ? parseInt(form.appId, 10) : 0,
      dramaId: form.dramaId ? parseInt(form.dramaId, 10) : 0,
      beansPerEp: form.beansPerEp,
      description: form.description,
    }
    try {
      if (drawerMode === "add") {
        await paymentConfigApi.create(body)
        toast.success("创建成功")
      } else if (editingConfig) {
        await paymentConfigApi.update(editingConfig.id, body)
        toast.success("更新成功")
      }
      setDrawerMode(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message || "保存失败")
    }
  }

  const tableHeaders = [
    { label: "配置类型", w: "w-[100px]" },
    { label: "小程序", w: "w-[120px]" },
    { label: "剧集", w: "w-[150px]" },
    { label: "每集消耗Beans", w: "w-[110px]" },
    { label: "备注", w: "w-[180px]" },
    { label: "创建时间", w: "w-[140px]" },
    { label: "操作", w: "w-[120px]" },
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
          options={appOptions.map(a => ({ label: a.name, value: a.id }))}
        />
        <SelectFilter
          block
          label="剧集"
          placeholder="全部"
          value={draftFilters.dramaId}
          onChange={(v) => setDraftField("dramaId", v)}
          options={dramaOptions.map(d => ({ label: d.name, value: d.id }))}
        />
        <SelectFilter
          block
          label="配置类型"
          placeholder="全部"
          value={draftFilters.configType}
          onChange={(v) => setDraftField("configType", v)}
          options={configTypeOptions}
        />
      </FilterBar>

      {/* 工具栏（新建按钮） */}
      {canAdd && (
        <div className="flex shrink-0 items-center px-5 py-3">
          <button
            onClick={handleCreate}
            className="flex h-[30px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]"
          >
            + 新建支付配置
          </button>
        </div>
      )}

      {/* 表格区：统一固定表头组件 */}
      <FixedHeaderTable
        minWidth={820}
        columns={tableHeaders.map((h) => h.w)}
        loading={loading}
        empty={list.length === 0}
        stateCellClassName="py-20"
        header={tableHeaders.map((h) => (
          <th key={h.label} className={thClass}>{h.label}</th>
        ))}
      >
            {list.map((row, i) => (
                <tr key={row.id} className={cn("transition-colors hover:bg-[#f9fafb]", i < list.length - 1 && "border-b border-[#f3f4f6]")}>
                  <td className="px-4 py-3">
                    <span className={cn("inline-block rounded px-2 py-0.5 text-[11px] font-medium", configTypeColors[row.configType] || "bg-[#f3f4f6] text-[#6b7280]")}>
                      {row.configType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#374151] truncate">{row.appName || "-"}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#374151] truncate">{row.dramaName || "-"}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#f97316] font-medium">{row.beansPerEp}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#6b7280] truncate">{row.description || "-"}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(row)}
                          className="rounded border border-[#38c08f] px-2.5 py-1 text-[12px] text-[#38c08f] transition-colors hover:bg-[#f0fdf4]"
                        >
                          编辑
                        </button>
                      )}
                      {canDelete && row.configType !== "全局默认" && (
                        <Popconfirm
                          title="确定删除此配置？"
                          onConfirm={() => handleDelete(row)}
                        >
                          <button className="rounded border border-[#f87171] px-2.5 py-1 text-[12px] text-[#f87171] transition-colors hover:bg-[#fef2f2]">
                            删除
                          </button>
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

      {/* Drawer */}
      {drawerMode && (
        <ConfigDrawer
          mode={drawerMode}
          config={editingConfig}
          appOptions={appOptions}
          dramaOptions={dramaOptions}
          onClose={() => setDrawerMode(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
