import { downloadFile, get, post } from "../api-client"
import type { PageData } from "../types"
import type { MonetizationType } from "./apps"
import type { UserListQueryParams } from "./users"

export interface PromotionLinkListItem {
  linkId: string
  name: string
  appId: string
  tiktokAppId: string
  appName: string
  monetizationType: MonetizationType
  dramaId: string
  dramaName: string
  paywallEpisode: number
  beansPerEp: number | null
  creatorName: string
  promotionUrl: string
}
export interface PromotionLinkCreateDto { name?: string; appId: string; dramaId: string; paywallEpisode: number; beansPerEp?: number }
export type PromotionLinkCreateResult = PromotionLinkListItem
export const promotionLinkApi = {
  list: (params?: UserListQueryParams) => get<PageData<PromotionLinkListItem>>("/promotion-links", params),
  create: (body: PromotionLinkCreateDto) => post<PromotionLinkCreateResult>("/promotion-links", body),
  export: (params?: UserListQueryParams) => downloadFile("/promotion-links/export", params, "promotion-links.xlsx"),
}
