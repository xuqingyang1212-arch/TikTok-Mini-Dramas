// 跨组件通用的后端数据形状。
// 这里只收录会被 3+ 个组件共同消费的类型；
// 业务详情 / 弹窗私有的表单模型继续留在各自组件内。

// ─── Pagination ─────────────────────────────────────────────────────────────

export { type PageSizeOption } from "@/components/list-pagination"

/** 列表接口统一返回形状：/api/v1/xxx 都是 { total, list }。 */
export interface PageData<T = unknown> {
  total: number
  list: T[]
}

// ─── User / Role ────────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  email: string
  status: "启用" | "禁用"
  roles?: Role[] | null
  createdAt?: string
  updatedAt?: string
}

export interface Role {
  id: number
  name: string
  remark?: string
  permissions?: Array<{ permissionKey: string }>
  createdAt?: string
  updatedAt?: string
}

// ─── Common UI Shapes ───────────────────────────────────────────────────────

/** 日期区间筛选器值（与 DateRangePicker 一致） */
export type DateRangeValue = [string, string] | []
