import type {
  AdUnlockSession,
  AppInfo,
  Drama,
  Episode,
  LoginResult,
  PayResultResponse,
  PaywallData,
  PaymentRecords,
  SubscriptionOrder,
  UnlockOrder,
  UnlockStatus,
  UserInfo,
  WatchReportResult,
} from "./contracts"
import { normalizeEpisodeList } from "./domain"
import { getDeviceOs } from "./platform"
import { encodePathSegment, request } from "./transport"

export const miniApi = {
  getApps: (options?: RequestInit) =>
    request<{ list: AppInfo[] }>("/apps", options),

  login: (appId: string, openId: string, options?: RequestInit) =>
    request<LoginResult>("/auth/login", {
      ...options,
      method: "POST",
      body: JSON.stringify({ appId, openId }),
    }),

  getUser: (userId: string, options?: RequestInit) =>
    request<UserInfo>(`/users/${encodePathSegment(userId)}`, options),

  getPaymentRecords: (userId: string, options?: RequestInit) =>
    request<PaymentRecords>(`/users/${encodePathSegment(userId)}/payment-records`, options),

  getDramas: (page = 1, pageSize = 20, options?: RequestInit) =>
    request<{ list: Drama[]; total: number; page: number; pageSize: number }>(`/dramas?page=${page}&pageSize=${pageSize}`, options),

  getDrama: (id: string, options?: RequestInit) =>
    request<Drama>(`/dramas/${encodePathSegment(id)}`, options),

  getEpisodes: async (dramaId: string, userId?: string, options?: RequestInit) => {
    const result = await request<{ list: Episode[]; total: number; paywallEpisode?: number }>(
      `/dramas/${encodePathSegment(dramaId)}/episodes${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`,
      options,
    )
    return {
      ...result,
      list: normalizeEpisodeList(result.list || []),
    }
  },

  getEpisode: async (dramaId: string, episodeNo: number, userId?: string, options?: RequestInit) => {
    const episode = await request<Episode>(
      `/dramas/${encodePathSegment(dramaId)}/episodes/${encodePathSegment(episodeNo)}${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`,
      options,
    )
    return normalizeEpisodeList([episode])[0] ?? episode
  },

  getUnlockStatus: (dramaId: string, userId: string, options?: RequestInit) =>
    request<UnlockStatus>(`/dramas/${encodePathSegment(dramaId)}/unlock-status?userId=${encodeURIComponent(userId)}`, options),

  reportWatch: (userId: string, dramaId: string, episodeNo: number, options?: RequestInit) =>
    request<WatchReportResult>("/watch-report", {
      ...options,
      method: "POST",
      body: JSON.stringify({ userId, dramaId, episodeNo }),
    }),

  createAdUnlockSession: (userId: string, dramaId: string, episodeNo: number, options?: RequestInit) =>
    request<AdUnlockSession>("/ad-unlock-sessions", {
      ...options,
      method: "POST",
      body: JSON.stringify({ userId, dramaId, episodeNo }),
    }),

  completeAdUnlockSession: (sessionNo: string, userId: string, options?: RequestInit) =>
    request<AdUnlockSession>(`/ad-unlock-sessions/${encodePathSegment(sessionNo)}/complete`, {
      ...options,
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  cancelAdUnlockSession: (sessionNo: string, userId: string, options?: RequestInit) =>
    request<AdUnlockSession>(`/ad-unlock-sessions/${encodePathSegment(sessionNo)}/cancel`, {
      ...options,
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  getPaywall: (dramaId: string, userId?: string, appId?: string, currentEpisode?: number, options?: RequestInit) => {
    const params = new URLSearchParams()
    if (userId) params.set("userId", userId)
    if (appId) params.set("appId", appId)
    if (currentEpisode !== undefined) params.set("currentEpisode", String(currentEpisode))
    const qs = params.toString()
    return request<PaywallData>(`/dramas/${encodePathSegment(dramaId)}/paywall${qs ? `?${qs}` : ""}`, options)
  },

  createUnlockOrder: (userId: string, dramaId: string, tierKey: string, currentEpisode: number, options?: RequestInit) =>
    request<UnlockOrder>("/orders/unlock", {
      ...options,
      method: "POST",
      body: JSON.stringify({
        userId,
        dramaId,
        tierKey,
        currentEpisode,
        deviceOs: getDeviceOs(),
      }),
    }),

  createSubscriptionOrder: (userId: string, planId: string, dramaId?: string, options?: RequestInit) =>
    request<SubscriptionOrder>("/orders/subscription", {
      ...options,
      method: "POST",
      body: JSON.stringify({
        userId,
        planId,
        dramaId: dramaId || undefined,
        deviceOs: getDeviceOs(),
      }),
    }),

  reportPayResult: (orderNo: string, success: boolean, options?: RequestInit) =>
    request<PayResultResponse>(`/orders/${encodePathSegment(orderNo)}/pay-result`, {
      ...options,
      method: "POST",
      body: JSON.stringify({ success }),
    }),
}

export type MiniApi = typeof miniApi
