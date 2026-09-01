"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"
import { toast } from "@/lib/toast"

export interface PopconfirmProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  children: ReactNode
}

export function Popconfirm({
  title,
  description,
  confirmText = "确定",
  cancelText = "取消",
  onConfirm,
  children,
}: PopconfirmProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        open &&
        triggerRef.current &&
        popoverRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (open && e.key === "Escape") {
        e.stopImmediatePropagation()
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [open])

  async function handleConfirm() {
    if (loading) return
    setLoading(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div onClick={() => setOpen(true)}>{children}</div>
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="false"
          className="absolute right-0 top-full z-[100] mt-1 w-max min-w-[220px] max-w-[280px] rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-lg"
        >
          <div className="flex items-start gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fef3c7]">
              <span className="text-[12px] text-[#d97706]">!</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug text-[#111827] break-words">{title}</p>
              {description && (
                <p className="mt-1 text-[12px] leading-snug text-[#6b7280] break-words">{description}</p>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-[26px] rounded-[5px] border border-[#d1d5db] bg-white px-3 text-[12px] text-[#374151] transition-colors hover:bg-[#f5f6f7]"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="h-[26px] rounded-[5px] bg-[#ef4444] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[#dc2626] disabled:opacity-50"
            >
              {loading ? "处理中..." : confirmText}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
