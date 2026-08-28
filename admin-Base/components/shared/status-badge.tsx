"use client"

import { cn } from "@/lib/utils"

export interface StatusStyleConfig {
  bg: string
  text: string
}

const defaultConfig: Record<string, StatusStyleConfig> = {
  "已上线":   { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "已完成":   { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "已通过":   { bg: "bg-[#ecfdf5]", text: "text-[#059669]" },
  "待审核":   { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  "待分配":   { bg: "bg-[#fffbeb]", text: "text-[#d97706]" },
  "草稿":     { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  "已失效":   { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  "已下架":   { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  "已取消":   { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  "已拒绝":   { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
  "失败":     { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" },
  "进行中":   { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "制作中":   { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
  "审核中":   { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" },
}

const fallback: StatusStyleConfig = { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }

export interface StatusBadgeProps {
  status: string
  config?: Record<string, StatusStyleConfig>
}

export function StatusBadge({ status, config }: StatusBadgeProps) {
  const merged = config ? { ...defaultConfig, ...config } : defaultConfig
  const c = merged[status] ?? fallback
  return (
    <span className={cn("inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11.5px] font-medium", c.bg, c.text)}>
      {status}
    </span>
  )
}
