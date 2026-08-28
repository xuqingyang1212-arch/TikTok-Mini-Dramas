export function formatFileSize(bytes: number, emptyDisplay = ""): string {
  if (bytes <= 0) return emptyDisplay
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * Format a date value to `YYYY-MM-DD HH:mm:ss` in UTC+8.
 * Accepts ISO strings, Date objects, or timestamps.
 * Returns empty string for falsy input, raw string for unparseable values.
 */
export function formatDateTime(value: string | number | Date | undefined | null): string {
  if (value == null || value === "") return ""
  const d = value instanceof Date ? value : new Date(value as string | number)
  if (Number.isNaN(d.getTime())) return String(value)
  const utc = d.getTime() + d.getTimezoneOffset() * 60_000
  const cn = new Date(utc + 8 * 3600_000)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${cn.getFullYear()}-${p(cn.getMonth() + 1)}-${p(cn.getDate())} ${p(cn.getHours())}:${p(cn.getMinutes())}:${p(cn.getSeconds())}`
}
