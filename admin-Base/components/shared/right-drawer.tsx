"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

export interface RightDrawerProps {
  open?: boolean
  width?: number | string
  title?: string
  zIndex?: number
  overlayOpacity?: number
  onClose: () => void
  children: ReactNode
}

export function RightDrawer({
  open = true,
  width = 560,
  title,
  zIndex = 50,
  overlayOpacity = 0.2,
  onClose,
  children,
}: RightDrawerProps) {
  if (!open) return null

  const w = typeof width === "number" ? `${width}px` : width
  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: zIndex - 1, backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 flex h-full flex-col bg-white"
        style={{ zIndex, width: w, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
            <span className="text-[15px] font-semibold text-[#111827]">{title}</span>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  )
}
