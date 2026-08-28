"use client"

import { ChevronRight, Home } from "lucide-react"
import { getComponentByKey } from "@/lib/menu-registry"

interface ContentAreaProps {
  breadcrumb: { parent?: string; current: string }
  selectedKey: string
}

export default function ContentArea({ breadcrumb, selectedKey }: ContentAreaProps) {
  const Comp = getComponentByKey(selectedKey)

  return (
    <main className="flex flex-1 flex-col overflow-hidden p-5">
      {/* Breadcrumb */}
      <div className="mb-4 flex shrink-0 items-center gap-1.5 text-[12.5px] text-[#9ca3af]">
        <Home size={12} className="text-[#9ca3af]" />
        <ChevronRight size={11} />
        {breadcrumb.parent && (
          <>
            <span>{breadcrumb.parent}</span>
            <ChevronRight size={11} />
          </>
        )}
        <span className="text-[#374151] font-medium">{breadcrumb.current}</span>
      </div>

      <div className="flex flex-1 flex-col min-h-0">
        {Comp ? (
          <Comp />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white">
            <p className="text-[13px] text-[#9ca3af]">请从左侧菜单选择页面</p>
          </div>
        )}
      </div>
    </main>
  )
}
