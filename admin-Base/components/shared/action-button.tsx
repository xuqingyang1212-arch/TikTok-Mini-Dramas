"use client"

import { forwardRef, type ButtonHTMLAttributes } from "react"
import { Copy } from "lucide-react"
import { cn } from "@/lib/utils"

export type ActionButtonVariant = "primary" | "danger" | "neutral"

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant
}

const variantClasses: Record<ActionButtonVariant, string> = {
  primary: "border-[#38c08f] text-[#13a673] hover:bg-[#f0fbf7]",
  danger: "border-[#f87171] text-[#dc2626] hover:bg-[#fef2f2]",
  neutral: "border-[#9ca3af] text-[#4b5563] hover:bg-[#f9fafb]",
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { variant = "primary", type = "button", className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-[26px] items-center justify-center gap-1 rounded-[4px] border bg-white px-2.5 text-[12px] font-normal whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:border-[#d1d5db] disabled:text-[#9ca3af] disabled:hover:bg-white",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

export interface CopyButtonProps extends Omit<ActionButtonProps, "variant"> {
  label?: string
}

export function CopyButton({ label = "复制", className, ...props }: CopyButtonProps) {
  return (
    <ActionButton className={cn("h-[28px] rounded-[5px]", className)} {...props}>
      <Copy size={13} />
      {label}
    </ActionButton>
  )
}
