export function formatFileSize(bytes: number, emptyDisplay = ""): string {
  if (bytes <= 0) return emptyDisplay
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * Format a date value to `YYYY-MM-DD HH:mm:ss` in the China operating timezone.
 * API timestamps are UTC; milliseconds remain in storage but are intentionally hidden here.
 */
export function formatDateTime(value: string | number | Date | undefined | null): string {
  if (value == null || value === "") return ""
  const date = value instanceof Date ? value : new Date(value as string | number)
  if (Number.isNaN(date.getTime())) return String(value)

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""

  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")} ${valueOf("hour")}:${valueOf("minute")}:${valueOf("second")}`
}
