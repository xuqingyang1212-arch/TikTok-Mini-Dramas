"use client"

import { Home, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/I18nProvider"

interface BottomNavProps {
  activeTab: "home" | "me"
  onTabChange: (tab: "home" | "me") => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useI18n()
  const tabs = [
    { key: "home" as const, label: t("nav.home"), icon: Home },
    { key: "me" as const, label: t("nav.me"), icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="flex h-[60px] items-center justify-around border-t border-white/10 bg-black/90 backdrop-blur-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-6 py-1 transition-all",
                isActive ? "text-white" : "text-white/50"
              )}
            >
              <Icon size={23} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[12px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
