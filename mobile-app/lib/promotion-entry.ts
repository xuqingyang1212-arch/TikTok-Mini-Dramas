const PENDING_LINK_KEY = "mini_drama_pending_promotion_link"
const LINK_KEY = "linkId"
const NESTED_KEYS = new Set(["query", "scene", "startparam", "startparams", "extradata", "referrerinfo"])

interface TikTokLaunchBridge {
  getLaunchOptionsSync?: () => unknown
  getEnterOptionsSync?: () => unknown
}

type TikTokWindow = Window & { tt?: TikTokLaunchBridge }

function normalizeKey(key: string) {
  return key.replace(/[-_]/g, "").toLowerCase()
}

function normalizeLinkId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const linkId = String(value).trim()
  return /^[1-9]\d*$/.test(linkId) ? linkId : null
}

function findLinkId(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) return null

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === LINK_KEY) {
        const linkId = normalizeLinkId(child)
        if (linkId) return linkId
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (NESTED_KEYS.has(normalizeKey(key))) {
        const linkId = findLinkId(child, depth + 1)
        if (linkId) return linkId
      }
    }
    return null
  }

  if (typeof value !== "string") return null
  const text = value.trim()
  if (!text) return null

  try {
    const parsed = JSON.parse(text) as unknown
    if (parsed !== text) {
      const linkId = findLinkId(parsed, depth + 1)
      if (linkId) return linkId
    }
  } catch {}

  try {
    const decoded = decodeURIComponent(text)
    const url = new URL(decoded, window.location.origin)
    const linkId = findLinkId(Object.fromEntries(url.searchParams), depth + 1)
    if (linkId) return linkId
  } catch {}

  const params = new URLSearchParams(text.replace(/^[?#]/, ""))
  return findLinkId(Object.fromEntries(params), depth + 1)
}

function readTikTokEntryOptions(): unknown[] {
  const tt = (window as TikTokWindow).tt
  if (!tt) return []

  const options: unknown[] = []
  for (const getter of [tt.getEnterOptionsSync, tt.getLaunchOptionsSync]) {
    if (!getter) continue
    try {
      options.push(getter.call(tt))
    } catch {}
  }
  return options
}

export function capturePromotionLink(): string | null {
  if (typeof window === "undefined") return null

  const existing = sessionStorage.getItem(PENDING_LINK_KEY)
  const entryValues: unknown[] = [Object.fromEntries(new URL(window.location.href).searchParams), ...readTikTokEntryOptions()]
  const discovered = entryValues.map((value) => findLinkId(value)).find(Boolean) || null

  if (discovered) {
    sessionStorage.setItem(PENDING_LINK_KEY, discovered)
    return discovered
  }
  return existing
}

export function getPendingPromotionLink(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(PENDING_LINK_KEY)
}

export function clearPendingPromotionLink(linkId: string) {
  if (typeof window === "undefined") return
  if (sessionStorage.getItem(PENDING_LINK_KEY) === linkId) {
    sessionStorage.removeItem(PENDING_LINK_KEY)
  }
}

export function clearPromotionLink(linkId: string) {
  if (typeof window === "undefined") return

  clearPendingPromotionLink(linkId)

  const url = new URL(window.location.href)
  let changed = false
  for (const [key, value] of [...url.searchParams.entries()]) {
    if (key === LINK_KEY || findLinkId({ [key]: value }) === linkId) {
      url.searchParams.delete(key)
      changed = true
    }
  }
  if (changed) {
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
  }
}
