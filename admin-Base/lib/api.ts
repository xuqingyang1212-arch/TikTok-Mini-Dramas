// Endpoint 集合：业务 API 分组聚合。
// 注意：HTTP 客户端 / token 管理位于 ./api-client，所有 endpoint 共用同一份 request 封装。
// 其他文件保持从 "@/lib/api" 导入即可，无需感知拆分。

import { get, post, put, del, uploadFile, uploadFileWithProgress, getApiBase, getToken as _getToken } from "./api-client"
import type { PageData } from "./types"

export {
  setToken,
  getToken,
  clearToken,
} from "./api-client"

// ======================== Auth ========================
// 登录流程：只需邮箱即可登录，新邮箱自动注册并赋予超级管理员权限
export const authApi = {
  login: (email: string) =>
    post<{ token: string; user: any }>("/auth/login", { email }),
  me: () => get<{ user: any; permissions: string[] }>("/users/me"),
}

// ======================== Users ========================
export const userApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/users", params),
  create: (body: any) => post<any>("/users", body),
  update: (id: number, body: any) => put(`/users/${id}`, body),
}

// ======================== Roles ========================
export const roleApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/roles", params),
  create: (body: any) => post<any>("/roles", body),
  update: (id: number, body: any) => put<any>(`/roles/${id}`, body),
  permissionTree: () => get<any[]>("/permissions/tree"),
}

// ======================== Apps (小程序应用) ========================
export const appApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/apps", params),
  getById: (id: number) => get<any>(`/apps/${id}`),
  create: (body: any) => post<any>("/apps", body),
  update: (id: number, body: any) => put<any>(`/apps/${id}`, body),
  // 获取所有主体信息（用于下拉筛选）
  getCompanies: () => get<string[]>("/apps/companies"),
}

// ======================== App Users (小程序用户) ========================
export const appUserApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/app-users", params),
  getById: (id: number) => get<any>(`/app-users/${id}`),
  getDetail: (id: number | string) => get<any>(`/app-users/${id}/detail`),
  subscriptions: <T = any>(id: number | string, params?: any) => get<PageData<T>>(`/app-users/${id}/subscriptions`, params),
  unlocks: <T = any>(id: number | string, params?: any) => get<PageData<T>>(`/app-users/${id}/unlocks`, params),
  watchLogs: <T = any>(id: number | string, params?: any) => get<PageData<T>>(`/app-users/${id}/watch-logs`, params),
}

// ======================== Dramas (剧集管理) ========================
export const dramaApi = {
  list: <T = any>(params?: any) => get<PageData<T>>("/dramas", params),
  getById: (id: string) => get<any>(`/dramas/${id}`),
  create: (body: any) => post<any>("/dramas", body),
  update: (id: string, body: any) => put<any>(`/dramas/${id}`, body),
  toggleStatus: (id: string) => put<any>(`/dramas/${id}/toggle-status`, {}),
}

// ======================== Episodes (剧集单集) ========================
export interface EpisodeItem {
  id: string
  dramaId: string
  episodeNo: number
  videoUrl: string
  duration: number
  fileSize: number
}

export const episodeApi = {
  listByDrama: (dramaId: string) => get<EpisodeItem[]>(`/dramas/${dramaId}/episodes`),
  batchCreate: (dramaId: string, episodes: { episodeNo: number; videoUrl: string; duration?: number; fileSize?: number }[]) =>
    post<EpisodeItem[]>(`/dramas/${dramaId}/episodes`, { episodes }),
  update: (dramaId: string, episodeId: string, body: { videoUrl: string; duration?: number; fileSize?: number }) =>
    put<any>(`/dramas/${dramaId}/episodes/${episodeId}`, body),
  delete: (dramaId: string, episodeId: string) =>
    del<any>(`/dramas/${dramaId}/episodes/${episodeId}`),
}

// ======================== Upload ========================
export const uploadApi = {
  image: (file: File) => uploadFile<{ url: string }>("/upload/image", file),
  video: (file: File) => uploadFile<{ url: string; size: number }>("/upload/video", file),
  videoWithProgress: (file: File, onProgress?: (percent: number) => void) => uploadFileWithProgress<{ url: string; size: number }>("/upload/video", file, onProgress),
}


// ======================== Subscription Plans (订阅配置) ========================


// ======================== Subscription Plans (订阅配置) ========================
export interface SubscriptionPlanItem {
  id: string
  appId: string
  appName: string
  period: string
  applePrice: number
  googlePrice: number
  webDiscount: number
  tierId: string
}

export const subscriptionApi = {
  list: <T = SubscriptionPlanItem>(params?: any) => get<PageData<T>>("/subscription-plans", params),
  getById: (id: string) => get<any>(`/subscription-plans/${id}`),
  create: (body: any) => post<any>("/subscription-plans", body),
  update: (id: string, body: any) => put<any>(`/subscription-plans/${id}`, body),
  delete: (id: string) => del<any>(`/subscription-plans/${id}`),
}

// ======================== Payment Config (支付配置) ========================
export interface PaymentConfigItem {
  id: string
  appId: string
  appName: string
  dramaId: string
  dramaName: string
  beansPerEp: number
  description: string
  configType: string
  createdAt: string
}

export const paymentConfigApi = {
  list: <T = PaymentConfigItem>(params?: any) => get<PageData<T>>("/payment-configs", params),
  getById: (id: string) => get<any>(`/payment-configs/${id}`),
  create: (body: any) => post<any>("/payment-configs", body),
  update: (id: string, body: any) => put<any>(`/payment-configs/${id}`, body),
  delete: (id: string) => del<any>(`/payment-configs/${id}`),
}

// ======================== Recharge Orders (充值订单) ========================
export interface RechargeOrderItem {
  id: string
  orderNo: string
  thirdPartyOrderNo: string
  appId: string
  appName: string
  userId: string
  orderType: string // unlock / subscription
  dramaId?: string
  dramaName?: string
  tierKey?: string
  unlockCount: number
  episodeList?: string
  beansCost: number
  period?: string
  subscribeAmount: number
  deviceOs: string // Apple / Google
  payStatus: string // pending / paid / failed / cancelled
  createdAt: string
  paidAt?: string
}

export const rechargeOrderApi = {
  list: <T = RechargeOrderItem>(params?: any) => get<PageData<T>>("/recharge-orders", params),
  // 导出：按当前筛选下载 .xlsx。走原生 fetch 拿 blob，触发浏览器下载。
  export: async (params?: Record<string, any>) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v))
    })
    const url = `${getApiBase()}/recharge-orders/export${qs.toString() ? `?${qs.toString()}` : ""}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${_getToken()}` },
    })
    if (!res.ok) throw new Error("导出失败")
    const blob = await res.blob()
    const disposition = res.headers.get("Content-Disposition") || ""
    const match = disposition.match(/filename=([^;]+)/)
    const filename = match ? decodeURIComponent(match[1].trim()) : "recharge-orders.xlsx"
    const link = document.createElement("a")
    const objectUrl = URL.createObjectURL(blob)
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  },
}
