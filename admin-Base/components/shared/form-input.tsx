"use client"

import { cn } from "@/lib/utils"

export interface FormInputProps {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  error?: string
  required?: boolean
  type?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

/**
 * 表单输入框组件
 * 统一 placeholder 颜色为 #9ca3af
 */
export function FormInput({
  label,
  placeholder,
  value,
  onChange,
  error,
  required,
  type = "text",
  min,
  max,
  step,
  disabled,
}: FormInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}
        {required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-[34px] w-full rounded-[6px] border px-3 text-[13px] outline-none transition-colors",
          "bg-white text-[#374151] placeholder-[#9ca3af] focus:border-[#38c08f]",
          "disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-[#9ca3af]",
          error ? "border-[#f04438]" : "border-[#d1d5db]"
        )}
      />
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}
