import { cn } from "@/lib/utils"

export function MonetizationBadge({ type, className }: { type: string; className?: string }) {
  const isIAA = type === "IAA"
  return (
    <span className={cn(
      "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
      isIAA ? "bg-[#ecfdf3] text-[#087443]" : "bg-[#f1efff] text-[#5b4cc4]",
      className,
    )}>
      {type}
    </span>
  )
}
