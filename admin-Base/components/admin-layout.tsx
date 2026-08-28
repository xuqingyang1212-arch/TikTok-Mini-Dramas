"use client"

import { useState, useEffect, useMemo, createContext, useContext } from "react"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import ContentArea from "@/components/content-area"
import { getToken, authApi } from "@/lib/api"
import { isMenuVisible, getFirstAllowedKey, hasPermission } from "@/lib/permissions"
import { getMenuTree, type MenuBranch, type MenuLeaf } from "@/lib/menu-registry"

// 对外仍然导出 MenuItem / SubMenuItem，保持已有组件（Sidebar 等）的调用不变。
export type MenuItem = MenuBranch
export type SubMenuItem = MenuLeaf

// ─── Permission Context ─────────────────────────────────────────────────────
const PermContext = createContext<string[]>([])
export function usePermissions() { return useContext(PermContext) }
export function usePerm(key: string | string[]) { return hasPermission(usePermissions(), key) }

export default function AdminLayout() {
  const [authReady, setAuthReady] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ name: string; permissions: string[] } | null>(null)
  const [bootMsg, setBootMsg] = useState("加载中...")

  // 菜单数据：从 lib/menu-registry 派生（单一真相源）。
  const menuData = useMemo<MenuItem[]>(() => getMenuTree(), [])

  useEffect(() => {
    let cancelled = false

    // 后端可能在重启（几秒内不可达），这里做最多 10 次、每次 1s 的重试。
    // 仅当拿到鉴权失败的响应（401，由 api-client 统一处理：clearToken + 跳 /login）
    // 或多次网络失败后才认定登录失效；其它网络抖动期间保留现有登录态。
    async function initAuth() {
      const token = getToken()
      if (!token) {
        window.location.href = "/login"
        return
      }

      const maxAttempts = 10
      for (let i = 1; i <= maxAttempts; i++) {
        if (cancelled) return
        try {
          const data = await authApi.me()
          if (cancelled) return
          setCurrentUser({ name: data.user?.name || "", permissions: data.permissions || [] })
          setAuthReady(true)
          return
        } catch (err) {
          const msg = err instanceof Error ? err.message : ""
          // 鉴权相关错误（401 的 "未登录或登录已过期"、409 的多端登录互踢）由 api-client
          // 自己跳转到 /login，这里直接退出循环即可。
          if (msg.includes("未登录") || msg.includes("登录已过期") || msg.includes("已在其他设备登录")) {
            return
          }
          // 其它失败（主要是后端重启/网络抖动：message = "backend offline"），等 1s 再试。
          if (i < maxAttempts) {
            setBootMsg(`连接服务器... (${i}/${maxAttempts})`)
            await new Promise((r) => setTimeout(r, 1000))
          }
        }
      }

      if (!cancelled) {
        // 多次都连不上，认为后端确实挂了，引导回登录页由用户决定
        window.location.href = "/login"
      }
    }

    initAuth()
    return () => {
      cancelled = true
    }
  }, [])

  const perms = currentUser?.permissions ?? []

  const filteredMenu = useMemo(() => {
    return menuData
      .filter((item) => isMenuVisible(item.key, perms))
      .map((item) => {
        if (!item.children) return item
        return {
          ...item,
          children: item.children.filter((sub) => isMenuVisible(sub.key, perms)),
        }
      })
      .filter((item) => !item.children || item.children.length > 0)
  }, [menuData, perms])

  const defaultKey = useMemo(() => getFirstAllowedKey(perms) ?? "", [perms])

  const [expandedKeys, setExpandedKeys] = useState<string[]>(() => menuData.map((m) => m.key))
  const [selectedKey, setSelectedKeyRaw] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#/, "")
      if (hash) return hash
    }
    return ""
  })

  function setSelectedKey(key: string) {
    setSelectedKeyRaw(key)
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${key}`)
    }
  }

  useEffect(() => {
    if (authReady && !selectedKey && defaultKey) {
      setSelectedKey(defaultKey)
    }
  }, [authReady, defaultKey, selectedKey])

  // If current selectedKey becomes invisible (e.g. after role change), reset
  useEffect(() => {
    if (authReady && selectedKey && !isMenuVisible(selectedKey, perms)) {
      setSelectedKey(defaultKey)
    }
  }, [authReady, selectedKey, perms, defaultKey])

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleMenuClick = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      toggleExpand(item.key)
    } else {
      setSelectedKey(item.key)
    }
  }

  const handleSubMenuClick = (subItem: SubMenuItem) => {
    setSelectedKey(subItem.key)
  }

  const getBreadcrumb = (): { parent?: string; current: string } => {
    for (const item of filteredMenu) {
      if (!item.children && item.key === selectedKey) {
        return { current: item.label }
      }
      if (item.children) {
        const sub = item.children.find((c) => c.key === selectedKey)
        if (sub) return { parent: item.label, current: sub.label }
      }
    }
    return { current: "" }
  }

  const breadcrumb = getBreadcrumb()

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f7f9]">
        <p className="text-[14px] text-[#6b7280]">{bootMsg}</p>
      </div>
    )
  }

  return (
    <PermContext.Provider value={perms}>
      <div className="flex h-screen overflow-hidden bg-[#f6f7f9]">
        <Sidebar
          menuData={filteredMenu}
          expandedKeys={expandedKeys}
          selectedKey={selectedKey}
          onMenuClick={handleMenuClick}
          onSubMenuClick={handleSubMenuClick}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header userName={currentUser?.name} />
          <ContentArea breadcrumb={breadcrumb} selectedKey={selectedKey} />
        </div>
      </div>
    </PermContext.Provider>
  )
}
