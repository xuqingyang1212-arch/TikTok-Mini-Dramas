import { useState, useCallback, useMemo } from "react"
import type { PageSizeOption } from "@/components/list-pagination"

export function usePagination(initialPageSize: PageSizeOption = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeRaw] = useState<PageSizeOption>(initialPageSize)

  const setPageSize = useCallback((size: PageSizeOption) => {
    setPageSizeRaw(size)
    setPage(1)
  }, [])

  const resetPage = useCallback(() => setPage(1), [])

  const paginationProps = useMemo(() => ({
    currentPage: page,
    pageSize,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
  }), [page, pageSize, setPageSize])

  return { page, pageSize, setPage, setPageSize, resetPage, paginationProps } as const
}
