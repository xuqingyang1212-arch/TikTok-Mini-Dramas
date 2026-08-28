"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown, X, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, SelectFilter, FilterBar, FilterActions, StatusBadge, RightDrawer, FixedHeaderTable, thClass } from "@/components/shared"
import { userApi, roleApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { formatDateTime } from "@/lib/format"
import { usePerm } from "@/components/admin-layout"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"

// ─────────────── Types ───────────────
type UserStatus = "启用" | "禁用"

interface User {
  id: string
  name: string
  email: string
  roles: string[]
  status: UserStatus
  createdAt: string
}

interface FilterForm {
  name: string
  email: string
  role: string
  status: string
}

interface UserForm {
  name: string
  email: string
  password: string
  roles: string[]
  status: UserStatus
}

interface UserFormErrors {
  name?: string
  email?: string
  password?: string
  roles?: string
  status?: string
}

const defaultFilters: FilterForm = { name: "", email: "", role: "", status: "" }

const roleOptionsFallback: { label: string; value: string }[] = []

const statusOptions: { label: string; value: UserStatus }[] = [
  { label: "启用", value: "启用" },
  { label: "禁用", value: "禁用" },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RE = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]{6,24}$/

function mapApiUser(u: Record<string, unknown>): User {
  const rawRoles = u.roles
  const roles: string[] = Array.isArray(rawRoles)
    ? rawRoles.map((r) => (typeof r === "string" ? r : String((r as { name?: string }).name ?? "")))
    : []
  const createdAt = formatDateTime(u.createdAt as string | undefined)
  const st = u.status === "禁用" ? "禁用" : "启用"
  return {
    id: String(u.id ?? ""),
    name: String(u.name ?? ""),
    email: String(u.email ?? ""),
    roles: roles.filter(Boolean),
    status: st as UserStatus,
    createdAt,
  }
}

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

// ─────────────── MultiRoleSelect ───────────────
function MultiRoleSelect({
  value, onChange, error, required, options: roleOptions = [],
}: {
  value: string[]; onChange: (v: string[]) => void; error?: string; required?: boolean; options?: { label: string; value: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((r) => r !== v) : [...value, v])
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        角色{required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((o) => !o)}
          className={cn("flex min-h-[34px] w-full flex-wrap items-center gap-1 rounded-[6px] border bg-white px-2.5 py-1.5 text-left text-[13px] transition-colors",
            open ? "border-[#38c08f]" : "border-[#d1d5db] hover:border-[#38c08f]",
            error ? "!border-[#f04438]" : "")}>
          {value.length === 0 ? (
            <span className="text-[#9ca3af]">请选择角色</span>
          ) : (
            value.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-[4px] border border-[#e5e7eb] bg-[#f3f4f6] px-1.5 py-0.5 text-[12px] text-[#374151]">
                {r}
                <X size={10} className="cursor-pointer text-[#9ca3af] hover:text-[#374151]"
                  onClick={(e) => { e.stopPropagation(); toggle(r) }} />
              </span>
            ))
          )}
          <ChevronDown size={13} className="ml-auto shrink-0 text-[#9ca3af]" />
        </button>
        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
            {roleOptions.length === 0 ? (
              <p className="px-3 py-2 text-[12.5px] text-[#9ca3af]">暂无可选角色</p>
            ) : roleOptions.map((opt) => {
              const checked = value.includes(opt.value)
              return (
                <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-[#f0fdf4]">
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
                    checked ? "border-[#38c08f] bg-[#38c08f]" : "border-[#d1d5db] bg-white")}>
                    {checked && (
                      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-[1.8]">
                        <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className={checked ? "text-[#38c08f] font-medium" : "text-[#374151]"}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}

// ─────────────── FormSelectSingle ───────────────
function FormSelectSingle({
  label, value, onChange, options, placeholder, error, required,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { label: string; value: string }[]; placeholder: string; error?: string; required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}{required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((o) => !o)}
          className={cn("flex h-[34px] w-full items-center gap-1.5 rounded-[6px] border bg-white px-3 text-[13px] transition-colors",
            open ? "border-[#38c08f]" : "border-[#d1d5db] hover:border-[#38c08f]",
            error ? "!border-[#f04438]" : "",
            selected ? "text-[#374151]" : "text-[#9ca3af]")}>
          <span className="flex-1 truncate text-left">{selected ? selected.label : placeholder}</span>
          <ChevronDown size={13} className="shrink-0 text-[#9ca3af]" />
        </button>
        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-[240px] w-full overflow-y-auto rounded-[6px] border border-[#e5e7eb] bg-white py-1 shadow-lg">
            {options.map((opt) => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn("flex w-full items-center px-3 py-2 text-[13px] transition-colors hover:bg-[#f0fdf4] whitespace-nowrap",
                  value === opt.value ? "text-[#38c08f] font-medium" : "text-[#374151]")}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}

// ─────────────── UserDrawer ───────────────
function UserDrawer({
  mode, user, onClose, onSubmit, roleOptions,
}: {
  mode: "add" | "edit"
  user?: User
  onClose: () => void
  onSubmit: (form: UserForm) => Promise<void>
  roleOptions: { label: string; value: string }[]
}) {
  const isEdit = mode === "edit"
  const [form, setForm] = useState<UserForm>(() => (
    isEdit && user
      ? { name: user.name, email: user.email, password: "", roles: user.roles, status: user.status }
      : { name: "", email: "", password: "", roles: [], status: "启用" }
  ))
  const [errors, setErrors] = useState<UserFormErrors>({})
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function setField<K extends keyof UserForm>(key: K, val: UserForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: UserFormErrors = {}
    if (!isEdit) {
      const trimmedName = form.name.trim()
      const trimmedEmail = form.email.trim()
      if (!trimmedName) errs.name = "请输入用户名"
      if (!trimmedEmail) errs.email = "请输入邮箱"
      else if (!EMAIL_RE.test(trimmedEmail)) errs.email = "邮箱格式不正确"
      if (!form.password) errs.password = "请输入初始密码"
      else if (!PASSWORD_RE.test(form.password)) errs.password = "密码需 6~24 位，数字/字母/符号任意组合"
    }
    if (!form.status) errs.status = "请选择状态"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RightDrawer width={480} zIndex={50} overlayOpacity={0.2} onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
        <span className="text-[15px] font-semibold text-[#111827]">{isEdit ? "编辑用户" : "新增用户"}</span>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-5">
          <FormInput label="用户名" placeholder="请输入用户名" value={form.name}
            onChange={(v) => setField("name", v)} error={errors.name} required readOnly={isEdit} />
          <FormInput label="邮箱" placeholder="请输入邮箱" value={form.email}
            onChange={(v) => setField("email", v)} error={errors.email} required readOnly={isEdit} />
          {!isEdit && (
            <FormInput
              label="初始密码"
              placeholder="6~24 位，数字/字母/符号任意组合"
              type={showPwd ? "text" : "password"}
              value={form.password}
              onChange={(v) => setField("password", v)}
              error={errors.password}
              required
              rightAddon={
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="text-[#9ca3af] transition-colors hover:text-[#6b7280]">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
          )}
          <MultiRoleSelect value={form.roles} onChange={(v) => setField("roles", v)} error={errors.roles} options={roleOptions} />
          <FormSelectSingle label="状态" value={form.status} onChange={(v) => setField("status", v as UserStatus)}
            options={statusOptions} placeholder="请选择状态" error={errors.status} required />
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
export default function UserManagement() {
  const [data, setData] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [roleIdByName, setRoleIdByName] = useState<Map<string, number>>(new Map())
  const [roleOptions, setRoleOptions] = useState<{ label: string; value: string }[]>(roleOptionsFallback)
  const { draft: draftFilters, active: activeFilters, update: updateDraft, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page: currentPage, pageSize, resetPage, paginationProps } = usePagination()
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const canEdit = usePerm("system.user.edit")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await roleApi.list({ page: 1, pageSize: 100 })
        const m = new Map<string, number>()
        for (const r of res.list ?? []) {
          const row = r as { id?: number; name?: string }
          if (row.name != null && row.id != null) m.set(row.name, Number(row.id))
        }
        if (!cancelled) {
          setRoleIdByName(m)
          setRoleOptions(Array.from(m.keys()).map((n) => ({ label: n, value: n })))
        }
      } catch {
        if (!cancelled) {
          setRoleIdByName(new Map())
          setRoleOptions(roleOptionsFallback)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await userApi.list({
        page: currentPage,
        pageSize,
        name: activeFilters.name.trim() || undefined,
        email: activeFilters.email.trim() || undefined,
        role: activeFilters.role || undefined,
        status: activeFilters.status || undefined,
      })
      const list = (res.list ?? []).map((row) => mapApiUser(row as Record<string, unknown>))
      setTotal(res.total ?? 0)
      setData(list)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [activeFilters, currentPage, pageSize])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  function openEdit(user: User) { setEditingUser(user); setDrawerMode("edit") }
  function closeDrawer() { setDrawerMode(null); setEditingUser(null) }

  async function handleAdd(form: UserForm) {
    try {
      const roleIds = form.roles
        .map((name) => roleIdByName.get(name))
        .filter((id): id is number => id !== undefined)
      await userApi.create({
        name: form.name,
        email: form.email,
        password: form.password,
        roleIds,
      })
      toast.success("用户创建成功")
      closeDrawer()
      resetPage()
      await fetchUsers()
    } catch (e) {
      toast.errorFrom(e, "创建失败")
      throw e
    }
  }

  async function handleEdit(form: UserForm) {
    if (!editingUser) return
    try {
      const roleIds = form.roles
        .map((name) => roleIdByName.get(name))
        .filter((id): id is number => id !== undefined)
      await userApi.update(Number(editingUser.id), {
        roleIds,
        status: form.status,
      })
      toast.success("用户更新成功")
      closeDrawer()
      await fetchUsers()
    } catch (e) {
      toast.errorFrom(e, "更新失败")
      throw e
    }
  }

  const pageData = data

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">

      {drawerMode && (
        <UserDrawer
          mode={drawerMode}
          user={editingUser ?? undefined}
          onClose={closeDrawer}
          onSubmit={drawerMode === "add" ? handleAdd : handleEdit}
          roleOptions={roleOptions}
        />
      )}

      {/* 筛选区 */}
      <FilterBar
        actions={<FilterActions onQuery={handleQuery} onReset={handleReset} />}
      >
        <FilterInput block label="用户名" placeholder="请输入用户名" value={draftFilters.name} onChange={(v) => updateDraft("name", v)} />
        <FilterInput block label="邮箱" placeholder="请输入邮箱" value={draftFilters.email} onChange={(v) => updateDraft("email", v)} />
        <SelectFilter block label="角色" value={draftFilters.role} onChange={(v) => updateDraft("role", v)} options={roleOptions} />
        <SelectFilter block label="状态" value={draftFilters.status} onChange={(v) => updateDraft("status", v)} options={statusOptions} />
      </FilterBar>

      {/* 表格区：统一固定表头组件 */}
      <FixedHeaderTable
        minWidth={720}
        columns={["w-[140px]", "w-[220px]", "", "w-[180px]", "w-[90px]", "w-[90px]"]}
        loading={loading && pageData.length === 0}
        empty={pageData.length === 0}
        header={["用户名", "邮箱", "角色", "注册时间", "状态", "操作"].map((label) => (
          <th key={label} className={thClass}>{label}</th>
        ))}
      >
              {pageData.map((row, i) => (
                  <tr key={row.id}
                    className={cn("transition-colors hover:bg-[#f9fafb]", i < pageData.length - 1 && "border-b border-[#f3f4f6]")}>
                    <td className="px-4 py-3 text-[12.5px] font-medium text-[#111827] whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.roles.length === 0 ? (
                        <span className="text-[12.5px] text-[#9ca3af]">—</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          {row.roles.map((r) => (
                            <span key={r} className="inline-flex items-center rounded-[4px] border border-[#e5e7eb] bg-[#f9fafb] px-2 py-0.5 text-[11.5px] text-[#374151]">{r}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">{row.createdAt}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={row.status} config={{
                        "启用": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
                        "禁用": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
                      }} />
                    </td>
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
