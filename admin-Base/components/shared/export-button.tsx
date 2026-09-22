"use client"

import { Download } from "lucide-react"

export interface ExportButtonProps {
  exporting: boolean
  onClick: () => void
}

export function ExportButton({ exporting, onClick }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={exporting}
      className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download size={12} />{exporting ? "导出中..." : "导出"}
    </button>
  )
}
