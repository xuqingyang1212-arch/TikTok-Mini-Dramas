export type DeviceOS = "Apple" | "Google"
export type MonetizationType = "IAA" | "IAP"

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface AppInfo {
  name: string
  clientKey: string
  monetizationType: MonetizationType
  adPlacementId: string
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
  unlockType?: "free" | "beans" | "subscription" | "ad" | "locked"
  canUnlockByAd?: boolean
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
  deviceOs: DeviceOS
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
  unlockType: "free" | "beans" | "subscription" | "ad"
  watchedAt: string
}

export interface AdUnlockSession {
  sessionNo: string
  status: "pending" | "already_unlocked" | "completed" | "canceled" | "expired"
  dramaId: string
  episodeNo: number
  adPlacementId: string
  expireAt: string
  unlockType: "free" | "beans" | "subscription" | "ad" | "locked"
  isUnlocked: boolean
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
