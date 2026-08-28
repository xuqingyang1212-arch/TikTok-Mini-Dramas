"use client"

import { useRef, useState, useEffect } from "react"
import { ChevronDown, CircleUser, LogOut } from "lucide-react"
import { clearToken } from "@/lib/api"

export default function Header({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleLogout() {
    setOpen(false)
    clearToken()
    window.location.href = "/login"
  }

  return (
    <header className="flex h-[52px] flex-shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-6">
      {/* Left placeholder */}
      <div />

      {/* Right user area */}
      <div className="relative flex items-center gap-4" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-[13px] text-[#374151] hover:text-[#1a1a1a] transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#edfaf4]">
            <CircleUser size={16} className="text-[#38c08f]" />
          </div>
          <span className="font-medium">{userName || "管理员"}</span>
          <ChevronDown size={13} className={`text-[#9ca3af] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[140px] overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white shadow-lg">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-[#374151] hover:bg-[#f9fafb] transition-colors"
            >
              <LogOut size={14} className="text-[#9ca3af]" />
              退出登录
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
