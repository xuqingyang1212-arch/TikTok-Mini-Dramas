export type ToastType = "success" | "error" | "info" | "warning"

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

type Listener = (items: ToastItem[]) => void

let _id = 0
let _items: ToastItem[] = []
const _listeners: Set<Listener> = new Set()

function notify() {
  const snapshot = [..._items]
  _listeners.forEach((fn) => fn(snapshot))
}

function push(type: ToastType, message: string, duration = 2500) {
  const id = ++_id
  _items = [..._items, { id, type, message }]
  notify()
  setTimeout(() => remove(id), duration)
  return id
}

function remove(id: number) {
  _items = _items.filter((t) => t.id !== id)
  notify()
}

function extractMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback
  if (typeof err === "string") return err
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message) || fallback
  return fallback
}

export const toast = {
  success: (msg: string, duration?: number) => push("success", msg, duration),
  error: (msg: string, duration?: number) => push("error", msg, duration ?? 3500),
  info: (msg: string, duration?: number) => push("info", msg, duration),
  warning: (msg: string, duration?: number) => push("warning", msg, duration ?? 3000),
  errorFrom: (err: unknown, fallback = "操作失败") => push("error", extractMessage(err, fallback), 3500),
  dismiss: remove,
}

export function subscribeToast(fn: Listener) {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}
