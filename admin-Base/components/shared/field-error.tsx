/**
 * FieldError — 字段级错误提示。
 *
 * 使用规范（详见 .cursor/rules/design-system.mdc 的"表单错误提示"章节）：
 *   - 错误文案**紧贴**对应的输入控件下方呈现（`mt-1.5`），不要集中堆到表单底部。
 *   - 哪个字段错，错误就出现在哪个字段下面。
 *   - 与 `<input>` 的红色边框错误态配合使用。
 *
 * 典型用法：
 *   <div>
 *     <label>邮箱</label>
 *     <input className={cn(inputCls, emailErr && "border-[#f04438] ...")} />
 *     {emailErr && <FieldError msg={emailErr} />}
 *   </div>
 */
export function FieldError({ msg }: { msg: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-1 text-[12px] text-[#dc2626]">
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
      </svg>
      {msg}
    </div>
  )
}

/**
 * routeErrorToField — 根据后端返回的错误文案自动路由到对应字段。
 *
 * 规则（按优先级）：
 *   - 含"验证码" → `code`
 *   - 含"邮箱" / "账号"    → `email`
 *   - 其他                   → `form`（非字段级，显示在表单末尾）
 *
 * 业务页面可以基于这个函数快速把一个 catch 到的 message 按字段分发到不同的 state slot。
 */
export function routeErrorToField(message: string): "email" | "code" | "form" {
  if (message.includes("验证码")) return "code"
  if (message.includes("邮箱") || message.includes("账号")) return "email"
  return "form"
}
