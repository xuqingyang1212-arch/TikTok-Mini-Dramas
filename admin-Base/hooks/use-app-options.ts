import { useEffect, useState } from "react"
import { appApi } from "@/lib/api"

export interface AppOptionItem {
  id: number | string
  name: string
}

export function useAppOptions(pageSize = 1000) {
  const [options, setOptions] = useState<AppOptionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await appApi.list<{ id: number; name: string }>({ page: 1, pageSize })
        if (cancelled) return
        setOptions((res.list ?? []).map((item) => ({ id: item.id, name: item.name })))
      } catch (err) {
        if (!cancelled) {
          setOptions([])
          setError(err instanceof Error ? err.message : "加载应用列表失败")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pageSize])

  return { options, loading, error } as const
}
