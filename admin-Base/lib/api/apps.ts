import { get, post, put } from "../api-client"
import type { PageData } from "../types"
import type { UserListQueryParams } from "./users"

export type MonetizationType = "IAA" | "IAP"
export interface SubjectInfo {
  subjectId: string
  subjectNameCn: string
  subjectNameEn: string
  registeredAddress: string
  registrationNumber: string
}
export interface AppListItem {
  id: number
  name: string
  appId?: string
  clientKey?: string
  subjectId?: string
  subject?: SubjectInfo
  monetizationType?: MonetizationType
  adPlacementId?: string
}
export interface AppCreateDto {
  name: string
  appId: string
  clientKey: string
  clientSecret?: string
  subjectId: string
  monetizationType: MonetizationType
  adPlacementId?: string
}
export interface AppUpdateDto extends AppCreateDto { id?: number }

export const appApi = {
  list: <T = AppListItem>(params?: UserListQueryParams) => get<PageData<T>>("/apps", params),
  getById: (id: number) => get<AppListItem>(`/apps/${id}`),
  create: (body: AppCreateDto) => post<AppListItem>("/apps", body),
  update: (id: number, body: AppUpdateDto) => put<AppListItem>(`/apps/${id}`, body),
  listSubjects: () => get<SubjectInfo[]>("/apps/subjects"),
}
