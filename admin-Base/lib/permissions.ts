// 权限校验 · 全部从 lib/menu-registry 派生，本文件不直接声明 key / 映射。
// 如需新增菜单 / 权限，改 lib/menu-registry.tsx，此处自动跟随。

import {
  getPermissionMap,
  getParentChildren,
  getLeafOrder,
} from "@/lib/menu-registry"

// Menu key -> required permission keys (need at least one to see the menu)
// 派生自菜单注册表，作为公共导出以便其它组件直接消费。
export const MENU_PERMISSION_MAP: Record<string, string[]> = getPermissionMap()

// Parent menu key -> child keys (if ANY child is visible, parent is visible)
export const PARENT_MENU_CHILDREN: Record<string, string[]> = getParentChildren()

export function hasPermission(userPerms: string[], required: string | string[]): boolean {
  const keys = Array.isArray(required) ? required : [required]
  return keys.some((k) => userPerms.includes(k))
}

export function isMenuVisible(menuKey: string, userPerms: string[]): boolean {
  const children = PARENT_MENU_CHILDREN[menuKey]
  if (children) {
    return children.some((childKey) => isMenuVisible(childKey, userPerms))
  }
  const required = MENU_PERMISSION_MAP[menuKey]
  if (!required) return true
  return hasPermission(userPerms, required)
}

export function getFirstAllowedKey(userPerms: string[]): string | null {
  const order = getLeafOrder()
  return order.find((k) => isMenuVisible(k, userPerms)) ?? null
}
