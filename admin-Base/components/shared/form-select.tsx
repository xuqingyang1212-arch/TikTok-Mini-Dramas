"use client"

import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface FormSelectOption {
  label: string
  value: string
}

export interface FormSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: FormSelectOption[]
  error?: string
  required?: boolean
  placeholder?: string
}

/**
 * 表单下拉选择组件
 * 统一 placeholder 颜色为 #9ca3af，与输入框保持一致
 */
export function FormSelect({
  label,
  value,
  onChange,
  options,
  error,
  required,
  placeholder = "请选择",
}: FormSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}
        {required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-[34px] w-full appearance-none rounded-[6px] border pl-3 pr-8 text-[13px] outline-none transition-colors",
            "bg-white focus:border-[#38c08f]",
            value ? "text-[#374151]" : "text-[#9ca3af]",
            error ? "border-[#f04438]" : "border-[#d1d5db]"
          )}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-[#374151]">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"
        />
      </div>
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}
