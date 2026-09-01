import { useEffect, useState } from "react"
import { dramaApi } from "@/lib/api"

export interface DramaOptionItem {
  id: string
  name: string
}

export function useDramaOptions(pageSize = 1000) {
  const [options, setOptions] = useState<DramaOptionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await dramaApi.list<{ id: string; name: string }>({ page: 1, pageSize })
        if (cancelled) return
        setOptions((res.list ?? []).map((item) => ({ id: item.id, name: item.name })))
      } catch (err) {
        if (!cancelled) {
          setOptions([])
          setError(err instanceof Error ? err.message : "加载剧集列表失败")
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
