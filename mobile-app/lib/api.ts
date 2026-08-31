// API client for the mini program frontend

const API_BASE = typeof window !== "undefined"
  ? `http://${window.location.hostname}:8080`
  : "http://localhost:8080"

const API_PREFIX = "/api/mini"

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

function getAcceptLanguageHeader(): string {
  if (typeof window === "undefined") return "zh-CN"

  const savedLocale = localStorage.getItem("mini_drama_language")
  if (savedLocale === "en") return "en-US"
  if (savedLocale === "zh") return "zh-CN"

  const docLang = document.documentElement.lang || navigator.language || "zh-CN"
  return docLang.toLowerCase().startsWith("en") ? "en-US" : "zh-CN"
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  headers.set("Content-Type", "application/json")
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", getAcceptLanguageHeader())
  }

  const res = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
    ...options,
    headers,
  })

  const json: ApiResponse<T> = await res.json()
  if (json.code !== 0) {
    throw new Error(json.message || "Request failed")
  }
  return json.data
}

// Build full media URL from relative path
export function getMediaUrl(path: string): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `${API_BASE}${path}`
}

// Detect device OS
export function getDeviceOs(): "Apple" | "Google" {
  if (typeof navigator === "undefined") return "Apple"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("android")) return "Google"
  return "Apple"
}

// ─── Types ──────────────────────────────────────────

export interface AppInfo {
  name: string
  clientKey: string
}

export interface Drama {
  id: string
  name: string
  coverUrl: string
  language: string
  episodeCount: number
  paywallEpisode?: number
}

export interface Episode {
  episodeNo: number
  videoUrl: string
  duration: number
  isFree?: boolean
  isUnlocked?: boolean
  unlockType?: "free" | "beans" | "subscription" | "locked"
}

export interface Subscription {
  active: boolean
  period?: "weekly" | "monthly" | "quarterly" | "half_yearly" | "yearly"
  expireAt?: string
}

export interface LoginResult {
  userId: string
  isNew: boolean
  subscription?: Subscription
}

export interface UserInfo {
  userId: string
  openId: string
  appName: string
  clientKey: string
  createdAt: string
  subscription?: Subscription
}

export interface SubscriptionPaymentRecord {
  orderNo: string
  period: "weekly" | "monthly" | "quarterly" | "half_yearly" | "yearly"
  amount: number
  deviceOs: "Apple" | "Google"
  paidAt: string
}

export interface UnlockPaymentRecord {
  orderNo: string
  dramaId: string
  dramaName: string
  unlockCount: number
  episodes: number[]
  beansCost: number
  paidAt: string
}

export interface PaymentRecords {
  subscriptions: SubscriptionPaymentRecord[]
  unlocks: UnlockPaymentRecord[]
}

export interface WatchReportResult {
  logId: string
  dramaId: string
  episodeNo: number
  unlockType: "free" | "beans" | "subscription"
  watchedAt: string
}

export interface UnlockStatus {
  dramaId: string
  episodeCount: number
  paywallEpisode: number
  bySubscription: boolean
  unlockedCount: number
  remainingCount: number
  episodes: Episode[]
}

export interface PaywallTier {
  key: string
  label: string
  episodes: number
  beansCost: number
}

export interface SubscriptionPlan {
  planId: string
  period: "weekly" | "monthly" | "quarterly" | "half_yearly" | "yearly"
  applePrice: number
  googlePrice: number
  webDiscount: number
  tierId?: string
}

export interface PaywallData {
  dramaId: string
  totalEpisodes: number
  paywallEpisode: number
  beansPerEp: number
  unlockedCount: number
  remainingCount: number
  hasSubscription: boolean
  tiers: PaywallTier[]
  subscriptionPlans: SubscriptionPlan[]
}

export interface UnlockOrder {
  orderNo: string
  orderType: "unlock"
  payStatus: "pending" | "paid" | "failed"
  beansCost: number
  episodes: number[]
}

export interface SubscriptionOrder {
  orderNo: string
  orderType: "subscription"
  payStatus: "pending" | "paid" | "failed"
}

export interface PayResultResponse {
  orderNo: string
  payStatus: "paid" | "failed"
  unlocked?: number[]
}

// ─── API Methods ────────────────────────────────────

export const miniApi = {
  // Get available apps
  getApps: () =>
    request<{ list: AppInfo[] }>("/apps"),

  // Login / register
  login: (appId: string, openId: string) =>
    request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ appId, openId }),
    }),

  // Get user info
  getUser: (userId: string) =>
    request<UserInfo>(`/users/${userId}`),

  // Get successful subscription and Beans unlock purchases
  getPaymentRecords: (userId: string) =>
    request<PaymentRecords>(`/users/${userId}/payment-records`),

  // Drama list
  getDramas: (page = 1, pageSize = 20) =>
    request<{ list: Drama[]; total: number; page: number; pageSize: number }>(
      `/dramas?page=${page}&pageSize=${pageSize}`
    ),

  // Drama detail
  getDrama: (id: string) =>
    request<Drama>(`/dramas/${id}`),

  // Episode list with unlock status
  getEpisodes: (dramaId: string, userId?: string) =>
    request<{ list: Episode[]; total: number; paywallEpisode?: number }>(
      `/dramas/${dramaId}/episodes${userId ? `?userId=${userId}` : ""}`
    ),

  // Single episode
  getEpisode: (dramaId: string, episodeNo: number, userId?: string) =>
    request<Episode>(
      `/dramas/${dramaId}/episodes/${episodeNo}${userId ? `?userId=${userId}` : ""}`
    ),

  // Get unlock status for all episodes
  getUnlockStatus: (dramaId: string, userId: string) =>
    request<UnlockStatus>(`/dramas/${dramaId}/unlock-status?userId=${userId}`),

  // Report the first actual play after entering an unlocked episode
  reportWatch: (userId: string, dramaId: string, episodeNo: number) =>
    request<WatchReportResult>("/watch-report", {
      method: "POST",
      body: JSON.stringify({ userId, dramaId, episodeNo }),
    }),

  // Get paywall data (tiers and subscription plans)
  getPaywall: (dramaId: string, userId?: string, appId?: string) => {
    const params = new URLSearchParams()
    if (userId) params.set("userId", userId)
    if (appId) params.set("appId", appId)
    const qs = params.toString()
    return request<PaywallData>(`/dramas/${dramaId}/paywall${qs ? `?${qs}` : ""}`)
  },

  // Create unlock order (beans)
  createUnlockOrder: (userId: string, dramaId: string, tierKey: string) =>
    request<UnlockOrder>("/orders/unlock", {
      method: "POST",
      body: JSON.stringify({ 
        userId, 
        dramaId, 
        tierKey,
        deviceOs: getDeviceOs()
      }),
    }),

  // Create subscription order
  createSubscriptionOrder: (userId: string, planId: string, dramaId?: string) =>
    request<SubscriptionOrder>("/orders/subscription", {
      method: "POST",
      body: JSON.stringify({ 
        userId, 
        planId,
        dramaId: dramaId || undefined,
        deviceOs: getDeviceOs()
      }),
    }),

  // Report pay result
  reportPayResult: (orderNo: string, success: boolean) =>
    request<PayResultResponse>(`/orders/${orderNo}/pay-result`, {
      method: "POST",
      body: JSON.stringify({ success }),
    }),
}
