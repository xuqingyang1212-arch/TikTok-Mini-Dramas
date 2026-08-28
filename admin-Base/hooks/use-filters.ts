import { useState, useCallback, useMemo } from "react"

function emptyOf<T extends object>(shape: T): T {
  const empty: Record<string, unknown> = {}
  const src = shape as unknown as Record<string, unknown>
  for (const key in src) {
    const val = src[key]
    empty[key] = Array.isArray(val) ? [] : typeof val === "number" ? 0 : ""
  }
  return empty as T
}

export function useFilters<T extends object>(initialFilters: T) {
  const [draft, setDraft] = useState<T>(initialFilters)
  const [active, setActive] = useState<T>(initialFilters)

  const emptyState = useMemo(() => emptyOf(initialFilters), [initialFilters])

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
