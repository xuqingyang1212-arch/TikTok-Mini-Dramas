import { downloadFile, get } from "../api-client"
import type { PageData } from "../types"
import type { MonetizationType } from "./apps"
import type { UserListQueryParams } from "./users"

export interface RechargeOrderItem { id: string; orderNo: string; thirdPartyOrderNo: string; appId: string; appName: string; userId: string; attributionLinkId: string | null; orderType: string; dramaId?: string; dramaName?: string; tierKey?: string; unlockCount: number; episodeList?: string; beansCost: number; period?: string; subscribeAmount: number; deviceOs: string; payStatus: string; createdAt: string; paidAt?: string }
export const rechargeOrderApi = {
  list: <T = RechargeOrderItem>(params?: UserListQueryParams) => get<PageData<T>>("/recharge-orders", params),
  export: (params?: UserListQueryParams) => downloadFile("/recharge-orders/export", params, "recharge-orders.xlsx"),
}
export interface AdSessionItem { id: string; sessionNo: string; userId: string; attributionLinkId: string | null; appId: string; appName: string; dramaId: string; dramaName: string; episodeNo: number; status: "pending" | "completed" | "canceled" | "expired"; createdAt: string; completedAt?: string }
export const adSessionApi = {
  list: (params?: UserListQueryParams) => get<PageData<AdSessionItem>>("/ad-sessions", params),
  export: (params?: UserListQueryParams) => downloadFile("/ad-sessions/export", params, "ad-sessions.xlsx"),
}
export interface MediaEventReportItem { id: string; userId: string; attributionLinkId: string | null; appId: string; appName: string; monetizationType: MonetizationType; dramaId: string; dramaName: string; episodeNo: number; eventName: string; status: "success" | "failed" | "unsupported"; reportedAt: string; params: Record<string, unknown>; result: Record<string, unknown> }
export const mediaEventReportApi = {
  list: (params?: UserListQueryParams) => get<PageData<MediaEventReportItem>>("/media-event-reports", params),
  export: (params?: UserListQueryParams) => downloadFile("/media-event-reports/export", params, "media-event-reports.xlsx"),
}
