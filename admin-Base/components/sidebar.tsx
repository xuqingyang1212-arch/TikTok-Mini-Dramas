"use client"

import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MenuItem, SubMenuItem } from "@/components/admin-layout"

interface SidebarProps {
  menuData: MenuItem[]
  expandedKeys: string[]
  selectedKey: string
  onMenuClick: (item: MenuItem) => void
  onSubMenuClick: (subItem: SubMenuItem) => void
}

export default function Sidebar({
  menuData,
  expandedKeys,
  selectedKey,
  onMenuClick,
  onSubMenuClick,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[240px] flex-shrink-0 flex-col border-r border-[#e5e7eb] bg-white">
      {/* Logo / System Name */}
      <div className="flex h-[52px] items-center border-b border-[#e5e7eb] px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#38c08f]">
            <LayoutGrid size={15} className="text-white" />
          </div>
          <span className="text-[15px] font-semibold text-[#1a1a1a] tracking-wide">
            TikTok漫剧管理后台
          </span>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-3" suppressHydrationWarning>
        {menuData.map((item) => {
          const hasChildren = item.children && item.children.length > 0
          const isExpanded = expandedKeys.includes(item.key)
          const isSelectedDirect = selectedKey === item.key
          const Icon = item.icon

          return (
            <div key={item.key}>
              {/* First Level */}
              <button
                onClick={() => onMenuClick(item)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-5 py-2.5 text-left text-[13.5px] transition-colors",
                  isSelectedDirect
                    ? "bg-[#edfaf4] text-[#38c08f] font-medium"
                    : "text-[#374151] hover:bg-[#f5f6f7]"
                )}
              >
                <span
                  className={cn(
                    isSelectedDirect ? "text-[#38c08f]" : "text-[#6b7280]"
                  )}
                >
                  {Icon && <Icon size={16} />}
                </span>
                <span className="flex-1">{item.label}</span>
                {hasChildren && (
                  <span className="text-[#9ca3af]">
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                )}
              </button>

              {/* Second Level */}
              {hasChildren && isExpanded && (
                <div className="bg-[#fafafa]">
                  {item.children!.map((sub) => {
                    const isSubSelected = selectedKey === sub.key
                    return (
                      <button
                        key={sub.key}
                        onClick={() => onSubMenuClick(sub)}
                        className={cn(
                          "flex w-full items-center gap-2 py-2 pl-[52px] pr-4 text-left text-[13px] transition-colors",
                          isSubSelected
                            ? "bg-[#edfaf4] text-[#38c08f] font-medium"
                            : "text-[#4b5563] hover:bg-[#f0f0f0] hover:text-[#1a1a1a]"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isSubSelected ? "bg-[#38c08f]" : "bg-[#d1d5db]"
                          )}
                        />
                        {sub.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#e5e7eb] px-5 py-3">
        <p className="text-[11px] text-[#9ca3af]">v1.0.0</p>
      </div>
    </aside>
  )
}
