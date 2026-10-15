"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { dramaSubmissionApi, type DramaSubmissionAuthorizationItem } from "@/lib/api"
import { toast } from "@/lib/toast"
import { FixedHeaderTable, MonetizationBadge, RightDrawer, StatusBadge, thClass } from "@/components/shared"

interface SubmissionAuthorizationDrawerProps {
  albumId: string
  open: boolean
  canEdit: boolean
  onClose: () => void
}

const authConfig = {
  "已授权": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "未授权": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
}

export function SubmissionAuthorizationDrawer({ albumId, open, canEdit, onClose }: SubmissionAuthorizationDrawerProps) {
  const [items, setItems] = useState<DramaSubmissionAuthorizationItem[]>([])
  const [initialIds, setInitialIds] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!open || !albumId) return
    const requestId = ++requestRef.current
    setLoading(true)
    setItems([])
    dramaSubmissionApi.authorizations(albumId).then((detail) => {
      if (requestRef.current !== requestId) return
      const editableIds = detail.apps.filter((item) => !item.isSourceApp && item.authorized).map((item) => item.appId)
      setItems(detail.apps)
      setInitialIds(editableIds)
      setSelectedIds(editableIds)
    }).catch((err) => {
      if (requestRef.current === requestId) toast.error(err instanceof Error ? err.message : "授权信息加载失败")
    }).finally(() => {
      if (requestRef.current === requestId) setLoading(false)
    })
    return () => { requestRef.current += 1 }
  }, [albumId, open])

  const editableItems = useMemo(() => items.filter((item) => !item.isSourceApp), [items])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const initialSet = useMemo(() => new Set(initialIds), [initialIds])
  const allSelected = editableItems.length > 0 && editableItems.every((item) => selectedSet.has(item.appId))
  const someSelected = editableItems.some((item) => selectedSet.has(item.appId))
  const hasChanges = selectedIds.length !== initialIds.length || selectedIds.some((appId) => !initialSet.has(appId))

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected
    }
  }, [allSelected, someSelected])

  function toggleApp(appId: string) {
    setSelectedIds((current) => current.includes(appId) ? current.filter((id) => id !== appId) : [...current, appId])
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : editableItems.map((item) => item.appId))
  }

  async function save() {
    if (!hasChanges) { onClose(); return }
    setSaving(true)
    try {
      const detail = await dramaSubmissionApi.updateAuthorizations(albumId, selectedIds)
      const editableIds = detail.apps.filter((item) => !item.isSourceApp && item.authorized).map((item) => item.appId)
      setItems(detail.apps); setInitialIds(editableIds); setSelectedIds(editableIds)
      toast.success("授权状态已更新")
      onClose()
    } catch (err) { toast.error(err instanceof Error ? err.message : "授权更新失败") } finally { setSaving(false) }
  }

  return <RightDrawer open={open} title="剧目授权" width={520} onClose={() => !saving && onClose()}>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <FixedHeaderTable
        columns={["w-[52px]", "w-auto", "w-[112px]"]}
        minWidth={500}
        loading={loading}
        empty={!loading && items.length === 0}
        loadingText="加载中..."
        emptyText="暂无可授权小程序"
        header={<>
          <th className={`${thClass} text-center`}>
            <input
              ref={selectAllRef}
              type="checkbox"
              aria-label="全选小程序"
              checked={allSelected}
              disabled={!canEdit || editableItems.length === 0 || loading || saving}
              onChange={toggleAll}
              className="h-4 w-4 align-middle accent-[#13a673]"
            />
          </th>
          <th className={thClass}>小程序</th>
          <th className={thClass}>状态</th>
        </>}
      >
        {items.map((item) => (
          <tr key={item.appId} className="border-b border-[#f3f4f6]">
            <td className="border-b border-[#f3f4f6] px-4 py-3 text-center">
              <input
                type="checkbox"
                aria-label={`${item.appName}授权`}
                checked={item.isSourceApp || selectedSet.has(item.appId)}
                disabled={item.isSourceApp || !canEdit || loading || saving}
                onChange={() => toggleApp(item.appId)}
                className="h-4 w-4 align-middle accent-[#13a673]"
              />
            </td>
            <td className="border-b border-[#f3f4f6] px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.appName}</span>
                <MonetizationBadge type={item.monetizationType} />
              </div>
              {item.authorizationError && <div className="mt-1 max-w-[260px] whitespace-normal text-[11px] text-[#dc2626]">{item.authorizationError}</div>}
            </td>
            <td className="border-b border-[#f3f4f6] px-4 py-3 whitespace-nowrap">
              <StatusBadge status={item.authorized ? "已授权" : "未授权"} config={authConfig} />
            </td>
          </tr>
        ))}
      </FixedHeaderTable>
      <div className="flex shrink-0 items-center justify-end border-t border-[#e5e7eb] px-6 py-4"><div className="flex gap-2"><button type="button" onClick={onClose} disabled={saving} className="h-[34px] rounded-[6px] border border-[#d1d5db] px-4 text-[13px] text-[#374151]">取消</button>{canEdit && <button type="button" onClick={() => void save()} disabled={loading || saving || !hasChanges} className="h-[34px] rounded-[6px] bg-[#13a673] px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "保存中..." : "保存"}</button>}</div></div>
    </div>
  </RightDrawer>
}
