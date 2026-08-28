"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getToken } from "@/lib/api-client"

/**
 * 列显示偏好的持久化 hook（存浏览器本地 localStorage，按登录用户隔离）。
 *
 * 设计：这是纯展示偏好（哪些列显示、列顺序），不落库、不加接口，
 * 换浏览器/设备需重新设置——符合演示项目「最小代价」定位。
 * key 里带上当前 token 派生的稳定短标识，保证同一浏览器多个管理员各自互不干扰。
 *
 * 用法：
 *   const cols = useColumnSettings("recharge-order", ALL_COLUMNS)
 *   cols.visibleKeys        // 当前可见列 key（按用户自定义顺序）
 *   cols.orderedColumns     // 当前可见列（ColumnDef，按用户自定义顺序）
 *   cols.isVisible(key)     // 某列是否可见
 *   cols.toggle(key)        // 勾选/取消
 *   cols.move(from, to)     // 按「可见列」下标移动列顺序（拖拽用）
 *   cols.reset()            // 恢复默认
 *   cols.set(keys)          // 批量设置（顺序即传入顺序）
 */

export interface ColumnDef {
  /** 列唯一 key，用于持久化与后端导出参数。 */
  key: string
  /** 列显示名（表头文案）。 */
  label: string
  /** 是否为必选列（不可取消，如主键列）。默认 false。 */
  required?: boolean
  /** 默认是否显示。默认 true。 */
  defaultVisible?: boolean
}

// token -> 稳定短哈希，作为用户维度隔离用（非安全用途，仅做本地 key 区分）。
function hashToken(t: string): string {
  let h = 0
  for (let i = 0; i < t.length; i++) {
    h = (h * 31 + t.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

export interface UseColumnSettings {
  columns: ColumnDef[]
  visibleKeys: string[]
  /** 当前可见列（ColumnDef），按用户自定义顺序。渲染表格直接用它。 */
  orderedColumns: ColumnDef[]
  isVisible: (key: string) => boolean
  toggle: (key: string) => void
  /** 按「可见列」下标移动列顺序，用于拖拽排序。 */
  move: (fromIndex: number, toIndex: number) => void
  set: (keys: string[]) => void
  reset: () => void
  ready: boolean
}

export function useColumnSettings(scope: string, columns: ColumnDef[]): UseColumnSettings {
  const defaultKeys = useMemo(
    () => columns.filter((c) => c.defaultVisible !== false).map((c) => c.key),
    [columns]
  )
  const columnMap = useMemo(() => {
    const m: Record<string, ColumnDef> = {}
    columns.forEach((c) => { m[c.key] = c })
    return m
  }, [columns])
  const requiredKeys = useMemo(
    () => columns.filter((c) => c.required).map((c) => c.key),
    [columns]
  )

  const [visible, setVisible] = useState<string[]>(defaultKeys)
  const [ready, setReady] = useState(false)

  const storageKey = useMemo(() => {
    const t = typeof window !== "undefined" ? getToken() : ""
    return `col-settings:${scope}:${hashToken(t)}`
  }, [scope])

  // 首次挂载后从 localStorage 回显（放在 effect 里，避免 SSR/CSR 首帧不一致）。
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved: string[] = JSON.parse(raw)
        // 保留用户保存的「顺序」：先按保存顺序取仍存在的列，再补上被漏掉的必选列，
        // 最后过滤掉已下线的列 key。
        const validSaved = saved.filter((k) => columnMap[k])
        const savedSet = new Set(validSaved)
        const merged = [...validSaved]
        // 必选列即使用户曾隐藏也强制补回（按 columns 中的相对位置插到末尾即可）。
        requiredKeys.forEach((k) => {
          if (!savedSet.has(k)) merged.push(k)
        })
        setVisible(merged.length > 0 ? merged : defaultKeys)
      }
    } catch {
      // 忽略损坏的本地数据，走默认
    }
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persist = useCallback(
    (keys: string[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(keys))
      } catch {
        // 忽略写入失败（隐私模式等）
      }
    },
    [storageKey]
  )

  const set = useCallback(
    (keys: string[]) => {
      // 顺序即传入顺序：过滤非法/下线 key，并把缺失的必选列补到末尾。
      const seen = new Set<string>()
      const next: string[] = []
      keys.forEach((k) => {
        if (columnMap[k] && !seen.has(k)) { next.push(k); seen.add(k) }
      })
      requiredKeys.forEach((k) => { if (!seen.has(k)) { next.push(k); seen.add(k) } })
      setVisible(next)
      persist(next)
    },
    [columnMap, requiredKeys, persist]
  )

  const toggle = useCallback(
    (key: string) => {
      if (requiredKeys.includes(key)) return
      setVisible((prev) => {
        const has = prev.includes(key)
        let next: string[]
        if (has) {
          // 取消显示：直接移除，保留其余列的现有顺序。
          next = prev.filter((k) => k !== key)
        } else {
          // 新增显示：追加到当前可见列末尾（保留用户已排好的顺序）。
          next = [...prev, key]
        }
        persist(next)
        return next
      })
    },
    [requiredKeys, persist]
  )

  // 按「可见列」下标移动一列（拖拽排序）。fromIndex/toIndex 均基于当前 visible 数组。
  const move = useCallback(
    (fromIndex: number, toIndex: number) => {
      setVisible((prev) => {
        if (
          fromIndex < 0 || fromIndex >= prev.length ||
          toIndex < 0 || toIndex >= prev.length ||
          fromIndex === toIndex
        ) {
          return prev
        }
        const next = [...prev]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const reset = useCallback(() => {
    setVisible(defaultKeys)
    persist(defaultKeys)
  }, [defaultKeys, persist])

  const isVisible = useCallback((key: string) => visible.includes(key), [visible])

  const orderedColumns = useMemo(
    () => visible.map((k) => columnMap[k]).filter((c): c is ColumnDef => !!c),
    [visible, columnMap]
  )

  return { columns, visibleKeys: visible, orderedColumns, isVisible, toggle, move, set, reset, ready }
}
