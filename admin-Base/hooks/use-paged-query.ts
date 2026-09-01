import { useCallback, useEffect, useRef, useState } from "react"

export interface PagedQueryResult<T> {
  list: T[]
  total: number
}

export interface UsePagedQueryOptions<T, F = void> {
  enabled?: boolean
  page: number
  pageSize: number
  filters?: F
  fetcher: (args: { page: number; pageSize: number; filters?: F }) => Promise<PagedQueryResult<T>>
}

export function usePagedQuery<T, F = void>({
  enabled = true,
  page,
  pageSize,
  filters,
  fetcher,
}: UsePagedQueryOptions<T, F>) {
  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await fetcher({ page, pageSize, filters })
      if (requestId !== requestIdRef.current) return
      setData(result.list ?? [])
      setTotal(result.total ?? 0)
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      const message = err instanceof Error ? err.message : "加载失败"
      setData([])
      setTotal(0)
      setError(message)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [page, pageSize, filters, fetcher])

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh])

  return { data, total, loading, error, refresh } as const
}
