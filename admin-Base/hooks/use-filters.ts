import { useState, useCallback, useMemo } from "react"

function emptyValue<T>(value: T): T {
  if (Array.isArray(value)) return [] as T
  if (value !== null && typeof value === "object") {
    const next: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>)) {
      next[key] = emptyValue((value as Record<string, unknown>)[key])
    }
    return next as T
  }
  if (typeof value === "number") return 0 as T
  if (typeof value === "boolean") return false as T
  if (typeof value === "string") return "" as T
  return value
}

export function useFilters<T extends object>(initialFilters: T) {
  const emptyState = useMemo(() => emptyValue(initialFilters), [initialFilters])
  const [draft, setDraft] = useState<T>(initialFilters)
  const [active, setActive] = useState<T>(initialFilters)

  const update = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const apply = useCallback(() => {
    setActive({ ...draft })
  }, [draft])

  const reset = useCallback(() => {
    setDraft(emptyState)
    setActive(emptyState)
  }, [emptyState])

  return { draft, active, update, apply, reset } as const
}
