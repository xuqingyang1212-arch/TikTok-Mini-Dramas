"use client"

import { useState } from "react"
import { authApi, setToken } from "@/lib/api"
import { FieldError, routeErrorToField } from "@/components/shared/field-error"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailErr, setEmailErr] = useState("")
  const [formErr, setFormErr] = useState("")

  function clearAllErrors() {
    setEmailErr("")
    setFormErr("")
  }

  function dispatchError(err: unknown, fallback: string) {
    const msg = err instanceof Error ? err.message : fallback
    const field = routeErrorToField(msg)
    if (field === "email") setEmailErr(msg)
    else setFormErr(msg)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    clearAllErrors()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setEmailErr("请输入邮箱")
      return
    }
    setLoading(true)
    try {
      const data = await authApi.login(trimmedEmail)
      setToken(data.token)
      window.location.replace("/")
    } catch (err) {
      dispatchError(err, "登录失败")
      setLoading(false)
    }
  }

  const baseInputCls =
    "h-[38px] w-full rounded-[6px] border bg-white px-3 text-[13px] text-[#374151] placeholder-[#9ca3af] outline-none transition-colors"
  const normalInputCls = "border-[#d1d5db] focus:border-[#38c08f]"
  const errorInputCls = "border-[#f04438] focus:border-[#f04438]"

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-semibold text-[#111827]">TikTok 漫剧运营后台</h1>
          <p className="mt-2 text-[13px] text-[#6b7280]">输入邮箱即可登录，新邮箱自动注册</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
          {/* 邮箱 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">邮箱</label>
            <input
              type="email"
              placeholder="请输入邮箱地址"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailErr) setEmailErr("")
              }}
              className={`${baseInputCls} ${emailErr ? errorInputCls : normalInputCls}`}
              autoComplete="email"
            />
            {emailErr && <FieldError msg={emailErr} />}
          </div>

          {/* 表单级错误 */}
          {formErr && <FieldError msg={formErr} />}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-[38px] w-full items-center justify-center rounded-[6px] bg-[#38c08f] text-[14px] font-medium text-white hover:bg-[#2da87a] transition-colors disabled:opacity-60"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  )
}
