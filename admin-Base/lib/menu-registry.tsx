"use client"

// 菜单注册表 · 单一真相源
//
// 本文件是全前端**唯一**的业务菜单声明处。侧边栏结构、权限映射、路由分发
// 全部从这里派生，新增一个业务页面只需在 `menuRegistry` 追加一项：
//
//   1. 在 menuRegistry 对应父节点的 children 追加叶子节点
//   2. 叶子节点声明 { key, label, permission, component }
//   3. 后端在 internal/consts/permissions.go 配套声明权限 key + 路由挂 RequirePerm
//
// 无需再改 admin-layout.tsx、content-area.tsx、lib/permissions.ts。

import type { ComponentType } from "react"
import type { LucideIcon } from "lucide-react"
import { Film, Wallet, Wrench, Users, Settings } from "lucide-react"
import dynamic from "next/dynamic"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RegistryLeaf {
  key: string
  label: string
  // 单个权限 key 或数组（数组表示任一命中即可见）。留空表示全员可见。
  permission?: string | string[]
  component: ComponentType
  // true 表示不在侧边栏展示，但路由/权限/组件仍正常工作（仅隐藏入口）。
  hidden?: boolean
}

export interface RegistryBranch {
  key: string
  label: string
  icon: LucideIcon
  children: RegistryLeaf[]
}

// ─── Loading placeholder ────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-[8px] border border-[#e5e7eb] bg-white p-5 animate-pulse">
      <div className="h-[44px] rounded-[6px] bg-[#f3f4f6]" />
      <div className="flex-1 rounded-[6px] bg-[#f9fafb]" />
    </div>
  )
}

function lazyPage(importer: () => Promise<{ default: ComponentType }>) {
  return dynamic(importer, { ssr: false, loading: () => <PageSkeleton /> })
}

// ─── 占位页面组件 ───────────────────────────────────────────────────────────
// 业务页面暂未开发时显示的占位组件

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col rounded-[8px] border border-[#e5e7eb] bg-white">
      <div className="flex h-[56px] items-center border-b border-[#e5e7eb] px-5">
        <h2 className="text-[16px] font-medium text-[#1f2937]">{title}</h2>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-[#9ca3af]">
          <div className="text-[48px] mb-3">🚧</div>
          <div className="text-[14px]">页面开发中，敬请期待...</div>
        </div>
      </div>
    </div>
  )
}

// 创建占位页面工厂函数
function createPlaceholder(title: string): ComponentType {
  return function Placeholder() {
    return <PlaceholderPage title={title} />
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

export const menuRegistry: RegistryBranch[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 资源管理
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: "resource",
    label: "资源管理",
    icon: Film,
    children: [
      {
        key: "dramaMgr",
        label: "剧集管理",
        permission: "resource.drama.list",
        component: lazyPage(() => import("@/components/drama-management")),
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 金融管理
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: "finance",
    label: "金融管理",
    icon: Wallet,
    children: [
      {
        key: "rechargeOrder",
        label: "充值订单",
        permission: "finance.recharge.list",
        component: lazyPage(() => import("@/components/recharge-order-management")),
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 运营配置
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: "operation",
    label: "运营配置",
    icon: Wrench,
    children: [
      {
        key: "appMgr",
        label: "应用管理",
        permission: "operation.app.list",
        component: lazyPage(() => import("@/components/app-management")),
      },
      {
        key: "subscriptionConfig",
        label: "订阅配置",
        permission: "operation.subs.list",
        component: lazyPage(() => import("@/components/subscription-management")),
      },
      {
        key: "paymentConfig",
        label: "支付配置",
        permission: "operation.payment.list",
        component: lazyPage(() => import("@/components/payment-config-management")),
        hidden: true,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 用户管理
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: "user",
    label: "用户管理",
    icon: Users,
    children: [
      {
        key: "appUserMgr",
        label: "用户信息",
        permission: "user.appuser.list",
        component: lazyPage(() => import("@/components/app-user-management")),
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 系统管理
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: "system",
    label: "系统管理",
    icon: Settings,
    children: [
      {
        key: "adminUserMgr",
        label: "用户管理",
        permission: "system.user.list",
        component: lazyPage(() => import("@/components/user-management")),
      },
      {
        key: "roleMgr",
        label: "角色管理",
        permission: "system.role.list",
        component: lazyPage(() => import("@/components/role-management")),
      },
    ],
  },
]

// ─── Derived structures ─────────────────────────────────────────────────────
// 侧边栏/面包屑/权限模块只消费这里的派生结果，不直接读 menuRegistry.

export interface MenuLeaf {
  key: string
  label: string
  parentKey: string
  parentLabel: string
}

export interface MenuBranch {
  key: string
  label: string
  icon: LucideIcon
  children: MenuLeaf[]
}

// 给 Sidebar + AdminLayout 用 —— 菜单结构（不含 component）
export function getMenuTree(): MenuBranch[] {
  return menuRegistry
    .map((b) => ({
      key: b.key,
      label: b.label,
      icon: b.icon,
      children: b.children
        // hidden 叶子不进侧边栏，但路由/权限仍生效
        .filter((c) => !c.hidden)
        .map((c) => ({
          key: c.key,
          label: c.label,
          parentKey: b.key,
          parentLabel: b.label,
        })),
    }))
    // 若某父节点全部子项被隐藏，则父节点也不展示
    .filter((b) => b.children.length > 0)
}

// 给 lib/permissions.ts 用 —— 叶子 key → 权限 key 数组
export function getPermissionMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const b of menuRegistry) {
    for (const c of b.children) {
      if (c.permission == null) continue
      map[c.key] = Array.isArray(c.permission) ? c.permission : [c.permission]
    }
  }
  return map
}

// 给 lib/permissions.ts 用 —— 父 key → 子 key 列表
export function getParentChildren(): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const b of menuRegistry) {
    map[b.key] = b.children.map((c) => c.key)
  }
  return map
}

// 给 lib/permissions.ts 的 getFirstAllowedKey 用 —— 叶子节点按声明顺序拍平
export function getLeafOrder(): string[] {
  const order: string[] = []
  for (const b of menuRegistry) {
    for (const c of b.children) order.push(c.key)
  }
  return order
}

// 给 ContentArea 用 —— 按 key 取动态加载的业务组件
export function getComponentByKey(key: string): ComponentType | undefined {
  for (const b of menuRegistry) {
    for (const c of b.children) {
      if (c.key === key) return c.component
    }
  }
  return undefined
}
