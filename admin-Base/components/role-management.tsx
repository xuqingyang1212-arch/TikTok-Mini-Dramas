"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { X, ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { roleApi } from "@/lib/api"
import { toast } from "@/lib/toast"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, RightDrawer, FilterBar, FilterActions, FixedHeaderTable, thClass } from "@/components/shared"
import { usePerm } from "@/components/admin-layout"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"

// ─────────────── Permission Tree ───────────────
interface PermNode {
  key: string
  label: string
  children?: PermNode[]
}

function normalizePermTree(raw: unknown): PermNode[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: Record<string, unknown>) => {
      const key = String(item.key ?? item.id ?? item.permissionKey ?? "")
      const label = String(item.label ?? item.name ?? item.title ?? key)
      const children = item.children
      const node: PermNode = { key, label }
      if (Array.isArray(children) && children.length > 0) {
        node.children = normalizePermTree(children)
      }
      return node
    })
    .filter((n) => n.key)
}

function getAllLeafKeys(nodes: PermNode[]): string[] {
  const keys: string[] = []
  function walk(n: PermNode) {
    if (!n.children || n.children.length === 0) { keys.push(n.key); return }
    n.children.forEach(walk)
  }
  nodes.forEach(walk)
  return keys
}

function getDescendantLeafKeys(node: PermNode): string[] {
  if (!node.children || node.children.length === 0) return [node.key]
  return node.children.flatMap(getDescendantLeafKeys)
}

// ─────────────── Types ───────────────
interface Role {
  id: string
  name: string
  remark: string
  permissions: string[]
  users: string[]
}

interface FilterForm { name: string }
interface RoleForm { name: string; remark: string; permissions: string[] }

function mapApiRole(r: Record<string, unknown>): Role {
  const usersRaw = r.users
  let users: string[] = []
  if (Array.isArray(usersRaw)) {
    users = usersRaw.map((u) =>
      typeof u === "string" ? u : String((u as { name?: string }).name ?? u)
    )
  }
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    remark: String(r.remark ?? ""),
    permissions: Array.isArray(r.permissions)
      ? r.permissions.map((p: any) => typeof p === "string" ? p : String(p.permissionKey ?? p.key ?? p))
      : [],
    users,
  }
}

const DEFAULT_FILTERS: FilterForm = { name: "" }
const DEFAULT_FORM: RoleForm = { name: "", remark: "", permissions: [] }

// ─────────────── Checkbox ───────────────
type CheckState = "checked" | "unchecked" | "indeterminate"

function getNodeState(node: PermNode, selected: Set<string>): CheckState {
  if (!node.children || node.children.length === 0) {
    return selected.has(node.key) ? "checked" : "unchecked"
  }
  const leafKeys = getDescendantLeafKeys(node)
  const checkedCount = leafKeys.filter((k) => selected.has(k)).length
  if (checkedCount === 0) return "unchecked"
  if (checkedCount === leafKeys.length) return "checked"
  return "indeterminate"
}

function Checkbox({ state, onChange }: { state: CheckState; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={cn(
        "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-colors",
        state === "checked"       ? "border-[#38c08f] bg-[#38c08f]" :
        state === "indeterminate" ? "border-[#38c08f] bg-white"     :
                                    "border-[#d1d5db] bg-white"
      )}
    >
      {state === "checked" && (
        <svg viewBox="0 0 10 8" className="h-[9px] w-[9px] fill-none stroke-white stroke-[1.8]">
          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {state === "indeterminate" && (
        <span className="block h-[2px] w-[8px] rounded bg-[#38c08f]" />
      )}
    </button>
  )
}

// ─────────────── PermTreeNode ───────────────
function PermTreeNode({
  node, selected, onChange, depth = 0,
}: {
  node: PermNode
  selected: Set<string>
  onChange: (next: Set<string>) => void
  depth?: number
}) {
  const [open, setOpen] = useState(depth < 1)
  const isLeaf = !node.children || node.children.length === 0
  const state = getNodeState(node, selected)

  function handleCheck() {
    const leafKeys = getDescendantLeafKeys(node)
    const next = new Set(selected)
    if (state === "checked") {
      leafKeys.forEach((k) => next.delete(k))
    } else {
      leafKeys.forEach((k) => next.add(k))
    }
    onChange(next)
  }

  return (
    <div className="select-none">
      <div
        className="flex cursor-pointer items-center gap-1.5 rounded-[4px] py-1.5 pr-2 transition-colors hover:bg-[#f9fafb]"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => !isLeaf && setOpen((o) => !o)}
      >
        {!isLeaf ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#9ca3af]">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Checkbox state={state} onChange={handleCheck} />
        <span className={cn("text-[12.5px]", isLeaf ? "text-[#6b7280]" : "font-medium text-[#374151]")}>
          {node.label}
        </span>
      </div>
      {!isLeaf && open && node.children!.map((child) => (
        <PermTreeNode key={child.key} node={child} selected={selected} onChange={onChange} depth={depth + 1} />
      ))}
    </div>
  )
}

// ─────────────── RoleDrawer (新增 & 编辑共用) ───────────────
function RoleDrawer({
  mode, role, onClose, onAdd, onEdit, permTree,
}: {
  mode: "add" | "edit"
  role?: Role
  onClose: () => void
  onAdd: (form: RoleForm) => void | Promise<void>
  onEdit: (id: string, form: RoleForm) => void | Promise<void>
  permTree: PermNode[]
}) {
  const [form, setForm] = useState<RoleForm>(
    mode === "edit" && role
      ? { name: role.name, remark: role.remark, permissions: role.permissions }
      : DEFAULT_FORM
  )
  const [errors, setErrors] = useState<{ name?: string }>({})
  const selectedSet = new Set(form.permissions)
  const allLeafKeys = useMemo(() => getAllLeafKeys(permTree), [permTree])

  function handlePermChange(next: Set<string>) {
    setForm((p) => ({ ...p, permissions: Array.from(next) }))
  }

  function validate() {
    const errs: { name?: string } = {}
    if (!form.name.trim()) errs.name = "请输入角色名称"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    try {
      if (mode === "add") await Promise.resolve(onAdd(form))
      else if (role) await Promise.resolve(onEdit(role.id, form))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <RightDrawer width={520} zIndex={50} overlayOpacity={0.2} onClose={onClose}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <span className="text-[15px] font-semibold text-[#111827]">
            {mode === "add" ? "新增角色" : "编辑角色"}
          </span>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#374151]">
                角色名称<span className="ml-0.5 text-[#f04438]">*</span>
              </label>
              <input
                type="text" placeholder="请输入角色名称" value={form.name}
                onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setErrors({}) }}
                className={cn(
                  "h-[34px] rounded-[6px] border bg-white px-3 text-[13px] outline-none transition-colors focus:border-[#38c08f]",
                  errors.name ? "border-[#f04438]" : "border-[#d1d5db]"
                )}
              />
              {errors.name && <p className="text-[12px] text-[#f04438]">{errors.name}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#374151]">备注</label>
              <textarea
                placeholder="请输入角色说明" value={form.remark} rows={3}
                onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))}
                className="resize-none rounded-[6px] border border-[#d1d5db] bg-white px-3 py-2 text-[13px] text-[#374151] outline-none transition-colors focus:border-[#38c08f]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#374151]">权限</label>
              <div className="max-h-[420px] overflow-y-auto rounded-[6px] border border-[#e5e7eb] bg-[#fafafa] py-1">
                {permTree.map((node) => (
                  <PermTreeNode key={node.key} node={node} selected={selectedSet} onChange={handlePermChange} depth={0} />
                ))}
              </div>
              <p className="text-[11.5px] text-[#9ca3af]">
                已选 {form.permissions.length} / {allLeafKeys.length} 项
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#e5e7eb] px-6 py-4">
          <button onClick={onClose}
            className="flex h-[32px] items-center rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]">
            取消
          </button>
          <button onClick={handleSubmit}
            className="flex h-[32px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]">
            确认
          </button>
        </div>
    </RightDrawer>
  )
}

// ─────────────── Main Component ───────────────
export default function RoleManagement() {
  const [data, setData] = useState<Role[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [permTree, setPermTree] = useState<PermNode[]>([])
  const { draft: draftFilters, active: activeFilters, update: updateDraft, apply: applyFilters, reset: resetFilters } = useFilters(DEFAULT_FILTERS)
  const { page, pageSize, resetPage, paginationProps } = usePagination()
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [listTick, setListTick] = useState(0)

  const canAdd = usePerm("system.role.add")
  const canEdit = usePerm("system.role.edit")

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await roleApi.list({
        page,
        pageSize,
        name: activeFilters.name.trim() || undefined,
      })
      const list = (res.list ?? []).map((row) => mapApiRole(row as Record<string, unknown>))
      setData(list)
      setTotal(res.total ?? 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, activeFilters.name, listTick])

  useEffect(() => {
    void fetchRoles()
  }, [fetchRoles])

  useEffect(() => {
    roleApi
      .permissionTree()
      .then((raw) => setPermTree(normalizePermTree(raw)))
      .catch(() => setPermTree([]))
  }, [])

  function handleQuery() {
    applyFilters()
    resetPage()
    setListTick((t) => t + 1)
  }
  function handleReset() {
    resetFilters()
    resetPage()
    setListTick((t) => t + 1)
  }

  function openAdd() { setEditingRole(null); setDrawerMode("add") }
  function openEdit(role: Role) { setEditingRole(role); setDrawerMode("edit") }
  function closeDrawer() { setDrawerMode(null); setEditingRole(null) }

  async function handleAdd(form: RoleForm) {
    try {
      await roleApi.create({
        name: form.name.trim(),
        remark: form.remark.trim(),
        permissions: form.permissions,
      })
      closeDrawer()
      toast.success("角色创建成功")
      await fetchRoles()
    } catch (e: any) {
      toast.errorFrom(e, "创建失败")
      throw e
    }
  }

  async function handleEdit(id: string, form: RoleForm) {
    try {
      await roleApi.update(Number(id), {
        name: form.name.trim(),
        remark: form.remark.trim(),
        permissions: form.permissions,
      })
      closeDrawer()
      toast.success("角色更新成功")
      await fetchRoles()
    } catch (e: any) {
      toast.errorFrom(e, "更新失败")
      throw e
    }
  }

  const pageData = data

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">

      {drawerMode && (
        <RoleDrawer
          mode={drawerMode}
          role={editingRole ?? undefined}
          onClose={closeDrawer}
          onAdd={handleAdd}
          onEdit={handleEdit}
          permTree={permTree}
        />
      )}

      {/* 筛选区 */}
      <FilterBar
        actions={<FilterActions onQuery={handleQuery} onReset={handleReset} />}
      >
        <FilterInput
          block
          label="角色名称"
          placeholder="请输入角色名称"
          value={draftFilters.name}
          onChange={(v) => updateDraft("name", v)}
          onKeyDown={(e) => e.key === "Enter" && handleQuery()}
        />
      </FilterBar>

      {/* 工具栏（新增按钮） */}
      {canAdd && (
        <div className="flex shrink-0 items-center px-5 py-3">
          <button onClick={openAdd}
            className="flex h-[30px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]">
            + 新增
          </button>
        </div>
      )}

      {/* 表格区 */}
      <FixedHeaderTable
        minWidth={600}
        columns={["w-[140px]", "w-[260px]", "", "w-[180px]"]}
        loading={loading && pageData.length === 0}
        empty={pageData.length === 0}
        header={["角色名称", "备注", "用户", "操作"].map((label) => (
          <th key={label} className={thClass}>{label}</th>
        ))}
      >
              {pageData.map((row, i) => {
                const userDisplay = row.users.length === 0
                  ? <span className="text-[#9ca3af]">暂无用户</span>
                  : row.users.length <= 4
                  ? <span className="text-[12.5px] text-[#4b5563]">{row.users.join("、")}</span>
                  : (
                    <span className="text-[12.5px] text-[#4b5563]">
                      {row.users.slice(0, 3).join("、")}
                      <span className="ml-1 text-[#9ca3af]">等共 {row.users.length} 人</span>
                    </span>
                  )
                return (
                  <tr key={row.id}
                    className={cn("transition-colors hover:bg-[#f9fafb]", i < pageData.length - 1 && "border-b border-[#f3f4f6]")}>
                    <td className="px-4 py-3 text-[12.5px] font-medium text-[#111827] whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">
                      {row.remark || <span className="text-[#d1d5db]">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{userDisplay}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <button
                            onClick={() => openEdit(row)}
                            className="flex h-[26px] items-center rounded-[4px] border border-[#38c08f] bg-white px-2.5 text-[12px] text-[#38c08f] transition-colors hover:bg-[#edfaf4]"
                          >
                            编辑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
      </FixedHeaderTable>

      {/* 分页区 */}
      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>
    </div>
  )
}
