"use client"

import { useEffect, useState, useCallback } from "react"
import { subscribeToast, type ToastItem, type ToastType } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react"
import { toast as toastApi } from "@/lib/toast"

const iconMap: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

const styleMap: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: "bg-[#ecfdf5]", border: "border-[#a7f3d0]", icon: "text-[#059669]", text: "text-[#065f46]" },
  error:   { bg: "bg-[#fef2f2]", border: "border-[#fecaca]", icon: "text-[#dc2626]", text: "text-[#991b1b]" },
  info:    { bg: "bg-[#eff6ff]", border: "border-[#bfdbfe]", icon: "text-[#2563eb]", text: "text-[#1e40af]" },
  warning: { bg: "bg-[#fffbeb]", border: "border-[#fde68a]", icon: "text-[#d97706]", text: "text-[#92400e]" },
}

function ToastEntry({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const Icon = iconMap[item.type]
  const s = styleMap[item.type]

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2.5 rounded-[8px] border px-4 py-2.5 shadow-lg transition-all duration-200",
        s.bg, s.border,
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      )}
    >
      <Icon size={16} className={cn("shrink-0", s.icon)} />
      <span className={cn("text-[13px] font-medium", s.text)}>{item.message}</span>
      <button
        onClick={onDismiss}
        className="ml-1 shrink-0 rounded-full p-0.5 text-[#9ca3af] hover:text-[#6b7280] transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export default function GlobalToast() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => subscribeToast(setItems), [])

  const handleDismiss = useCallback((id: number) => { toastApi.dismiss(id) }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed left-1/2 top-5 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
      {items.map((item) => (
        <ToastEntry key={item.id} item={item} onDismiss={() => handleDismiss(item.id)} />
      ))}
    </div>
  )
}
