import { del, get, post, put } from "../api-client"
import type { PageData } from "../types"
import type { UserListQueryParams } from "./users"

export interface SubscriptionPlanCreateDto { appId: number; period: string; applePrice: number; googlePrice: number; webDiscount: number; tierId: string }
export interface SubscriptionPlanItem { id: string; appId: string; appName: string; period: string; applePrice: number; googlePrice: number; webDiscount: number; tierId: string }
export const subscriptionApi = {
  list: <T = SubscriptionPlanItem>(params?: UserListQueryParams) => get<PageData<T>>("/subscription-plans", params),
  getById: (id: string) => get<SubscriptionPlanItem>(`/subscription-plans/${id}`),
  create: (body: SubscriptionPlanCreateDto) => post<{ id?: string }>("/subscription-plans", body),
  update: (id: string, body: SubscriptionPlanCreateDto) => put<{ id?: string }>(`/subscription-plans/${id}`, body),
  delete: (id: string) => del<{ id: string }>(`/subscription-plans/${id}`),
}
export interface PaymentConfigCreateDto { appId?: number; dramaId?: number; beansPerEp: number; description?: string }
export interface PaymentConfigItem { id: string; appId: string; appName: string; dramaId: string; dramaName: string; beansPerEp: number; description: string; configType: string; createdAt: string }
export const paymentConfigApi = {
  list: <T = PaymentConfigItem>(params?: UserListQueryParams) => get<PageData<T>>("/payment-configs", params),
  getById: (id: string) => get<PaymentConfigItem>(`/payment-configs/${id}`),
  create: (body: PaymentConfigCreateDto) => post<{ id?: string }>("/payment-configs", body),
  update: (id: string, body: PaymentConfigCreateDto) => put<{ id?: string }>(`/payment-configs/${id}`, body),
  delete: (id: string) => del<{ id: string }>(`/payment-configs/${id}`),
}
