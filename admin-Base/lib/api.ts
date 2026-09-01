// Endpoint 集合：业务 API 分组聚合。
// 注意：HTTP 客户端 / token 管理位于 ./api-client，所有 endpoint 共用同一份 request 封装。
// 其他文件保持从 "@/lib/api" 导入即可，无需感知拆分。

import { get, post, put, del, uploadFile, uploadFileWithProgress, getApiBase, getToken, resolveMediaUrl } from "./api-client"
import type { PageData } from "./types"

export {
  setToken,
  getToken,
  clearToken,
  getApiBase,
  resolveMediaUrl,
} from "./api-client"

export interface UserLoginResponse {
  token: string
  user: {
    id?: number
    name?: string
    email?: string
    role?: string
  }
}

export interface CurrentUserResponse {
  user: {
    id?: number
    name?: string
    email?: string
    permissions?: string[]
  }
  permissions: string[]
}

export interface AppListItem {
  id: number
  name: string
  appId?: string
  clientKey?: string
  company?: string
  monetizationType?: string
  adPlacementId?: string
}

export interface AppCreateDto {
  name: string
  appId: string
  clientKey: string
  clientSecret?: string
  company: string
  monetizationType: string
  adPlacementId?: string
}

export interface AppUpdateDto extends AppCreateDto {
  id?: number
}

export interface PermissionNode {
  key: string
  label?: string
  children?: PermissionNode[]
}

export interface RoleCreateDto {
  name: string
  remark?: string
  permissions: string[]
}

export interface RoleUpdateDto extends RoleCreateDto {
  id?: number | string
}

export interface AppUserDetail {
  id: number | string
  name?: string
  email?: string
  appId?: string
  phone?: string
  status?: string
}

export interface DramaCreateDto {
  name: string
  coverUrl: string
  language: string
  paywallEpisode: number
}

export interface SubscriptionPlanCreateDto {
  appId: number
  period: string
  applePrice: number
  googlePrice: number
  webDiscount: number
  tierId: string
}

export interface PaymentConfigCreateDto {
  appId?: number
  dramaId?: number
  beansPerEp: number
  description?: string
}

// ======================== Auth ========================
// 登录流程：只需邮箱即可登录，新邮箱自动注册并赋予超级管理员权限
export const authApi = {
  login: (email: string) =>
    post<UserLoginResponse>("/auth/login", { email }),
  me: () => get<CurrentUserResponse>("/users/me"),
}

// ======================== Users ========================
export type UserListQueryParams = Record<string, string | number | boolean | undefined | null>

export const userApi = {
  list: <T = unknown>(params?: UserListQueryParams) => get<PageData<T>>("/users", params),
  create: (body: Record<string, unknown>) => post<{ id?: number }>("/users", body),
  update: (id: number, body: Record<string, unknown>) => put<{ id?: number }>(`/users/${id}`, body),
}

// ======================== Roles ========================
export const roleApi = {
  list: <T = unknown>(params?: UserListQueryParams) => get<PageData<T>>("/roles", params),
  create: (body: RoleCreateDto) => post<{ id?: number | string }>("/roles", body),
  update: (id: number | string, body: RoleCreateDto) => put<{ id?: number | string }>(`/roles/${id}`, body),
  permissionTree: () => get<PermissionNode[]>("/permissions/tree"),
}

// ======================== Apps (小程序应用) ========================
export const appApi = {
  list: <T = AppListItem>(params?: UserListQueryParams) => get<PageData<T>>("/apps", params),
  getById: (id: number) => get<AppListItem>(`/apps/${id}`),
  create: (body: AppCreateDto) => post<AppListItem>("/apps", body),
  update: (id: number, body: AppUpdateDto) => put<AppListItem>(`/apps/${id}`, body),
  getCompanies: () => get<string[]>("/apps/companies"),
}

// ======================== App Users (小程序用户) ========================
export const appUserApi = {
  list: <T = unknown>(params?: UserListQueryParams) => get<PageData<T>>("/app-users", params),
  getById: (id: number) => get<AppUserDetail>(`/app-users/${id}`),
  getDetail: (id: number | string) => get<AppUserDetail>(`/app-users/${id}/detail`),
  subscriptions: <T = unknown>(id: number | string, params?: UserListQueryParams) => get<PageData<T>>(`/app-users/${id}/subscriptions`, params),
  unlocks: <T = unknown>(id: number | string, params?: UserListQueryParams) => get<PageData<T>>(`/app-users/${id}/unlocks`, params),
  watchLogs: <T = unknown>(id: number | string, params?: UserListQueryParams) => get<PageData<T>>(`/app-users/${id}/watch-logs`, params),
}

// ======================== Dramas (剧集管理) ========================
export const dramaApi = {
  list: <T = unknown>(params?: UserListQueryParams) => get<PageData<T>>("/dramas", params),
  getById: (id: string) => get<{ id: string; name: string; coverUrl?: string }>(`/dramas/${id}`),
  create: (body: DramaCreateDto) => post<{ id?: string }>("/dramas", body),
  update: (id: string, body: DramaCreateDto) => put<{ id?: string }>(`/dramas/${id}`, body),
  toggleStatus: (id: string) => put<{ id: string }>(`/dramas/${id}/toggle-status`, {}),
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
    put<EpisodeItem>(`/dramas/${dramaId}/episodes/${episodeId}`, body),
  delete: (dramaId: string, episodeId: string) =>
    del<{ id: string }>(`/dramas/${dramaId}/episodes/${episodeId}`),
}

// ======================== Upload ========================
export const uploadApi = {
  image: (file: File) => uploadFile<{ url: string }>("/upload/image", file),
  video: (file: File) => uploadFile<{ url: string; size: number }>("/upload/video", file),
  videoWithProgress: (file: File, onProgress?: (percent: number) => void) => uploadFileWithProgress<{ url: string; size: number }>("/upload/video", file, onProgress),
}

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
  list: <T = SubscriptionPlanItem>(params?: UserListQueryParams) => get<PageData<T>>("/subscription-plans", params),
  getById: (id: string) => get<SubscriptionPlanItem>(`/subscription-plans/${id}`),
  create: (body: SubscriptionPlanCreateDto) => post<{ id?: string }>("/subscription-plans", body),
  update: (id: string, body: SubscriptionPlanCreateDto) => put<{ id?: string }>(`/subscription-plans/${id}`, body),
  delete: (id: string) => del<{ id: string }>(`/subscription-plans/${id}`),
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
  list: <T = PaymentConfigItem>(params?: UserListQueryParams) => get<PageData<T>>("/payment-configs", params),
  getById: (id: string) => get<PaymentConfigItem>(`/payment-configs/${id}`),
  create: (body: PaymentConfigCreateDto) => post<{ id?: string }>("/payment-configs", body),
  update: (id: string, body: PaymentConfigCreateDto) => put<{ id?: string }>(`/payment-configs/${id}`, body),
  delete: (id: string) => del<{ id: string }>(`/payment-configs/${id}`),
}

// ======================== Recharge Orders (充值订单) ========================
export interface RechargeOrderItem {
  id: string
  orderNo: string
  thirdPartyOrderNo: string
  appId: string
  appName: string
  userId: string
  orderType: string
  dramaId?: string
  dramaName?: string
  tierKey?: string
  unlockCount: number
  episodeList?: string
  beansCost: number
  period?: string
  subscribeAmount: number
  deviceOs: string
  payStatus: string
  createdAt: string
  paidAt?: string
}

export const rechargeOrderApi = {
  list: <T = RechargeOrderItem>(params?: UserListQueryParams) => get<PageData<T>>("/recharge-orders", params),
  export: async (params?: Record<string, string | number | boolean | undefined | null>) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v))
    })
    const url = `${getApiBase()}/recharge-orders/export${qs.toString() ? `?${qs.toString()}` : ""}`
    const token = getToken()
    const res = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      let msg = "导出失败"
      try {
        const json = JSON.parse(text) as { message?: string }
        if (json.message) msg = json.message
      } catch {}
      throw new Error(msg)
    }
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
