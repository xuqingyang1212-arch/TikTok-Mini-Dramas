import { get, post, put } from "../api-client"
import type { PageData } from "../types"

export type UserListQueryParams = Record<string, string | number | boolean | undefined | null>

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
export interface RoleUpdateDto extends RoleCreateDto { id?: number | string }

export interface AppUserDetail {
  id: number | string
  name?: string
  email?: string
  appId?: string
  phone?: string
  status?: string
}

export const userApi = {
  list: <T = unknown>(params?: UserListQueryParams) => get<PageData<T>>("/users", params),
  create: (body: Record<string, unknown>) => post<{ id?: number }>("/users", body),
  update: (id: number, body: Record<string, unknown>) => put<{ id?: number }>(`/users/${id}`, body),
}

export const roleApi = {
  list: <T = unknown>(params?: UserListQueryParams) => get<PageData<T>>("/roles", params),
  create: (body: RoleCreateDto) => post<{ id?: number | string }>("/roles", body),
  update: (id: number | string, body: RoleCreateDto) => put<{ id?: number | string }>(`/roles/${id}`, body),
  permissionTree: () => get<PermissionNode[]>("/permissions/tree"),
}

export const appUserApi = {
  list: <T = unknown>(params?: UserListQueryParams) => get<PageData<T>>("/app-users", params),
  getById: (id: number) => get<AppUserDetail>(`/app-users/${id}`),
  getDetail: (id: number | string) => get<AppUserDetail>(`/app-users/${id}/detail`),
  subscriptions: <T = unknown>(id: number | string, params?: UserListQueryParams) => get<PageData<T>>(`/app-users/${id}/subscriptions`, params),
  unlocks: <T = unknown>(id: number | string, params?: UserListQueryParams) => get<PageData<T>>(`/app-users/${id}/unlocks`, params),
  watchLogs: <T = unknown>(id: number | string, params?: UserListQueryParams) => get<PageData<T>>(`/app-users/${id}/watch-logs`, params),
}
