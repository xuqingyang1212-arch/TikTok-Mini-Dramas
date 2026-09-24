"use client"

import { usePathname, useRouter } from "next/navigation"
import { BottomNav } from "@/components/BottomNav"

export function MainNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const activeTab = pathname === "/me" ? "me" : "home"

  return (
    <BottomNav
      activeTab={activeTab}
      onTabChange={(tab) => router.push(tab === "me" ? "/me" : "/")}
    />
  )
}
