"use client"

import { createPortal } from "react-dom"

export interface ConfirmDialogProps {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  zIndex?: number
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  zIndex = 60,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/20" style={{ zIndex }} onClick={onCancel} />
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: zIndex + 1 }}>
        <div className="w-[360px] rounded-[10px] bg-white shadow-2xl">
          <div className="px-6 pt-5 pb-2">
            <p className="text-[15px] font-semibold text-[#111827]">{title}</p>
          </div>
          <div className="px-6 py-3">
            <div className="text-[13px] leading-relaxed text-[#374151]">{message}</div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[#f3f4f6] px-6 py-3">
            <button
              onClick={onCancel}
              className="rounded-[6px] border border-[#d1d5db] bg-white px-4 py-1.5 text-[13px] text-[#374151] hover:bg-[#f5f6f7] transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={
                danger
                  ? "rounded-[6px] bg-[#dc2626] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#b91c1c] transition-colors"
                  : "rounded-[6px] bg-[#38c08f] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#2da87a] transition-colors"
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
