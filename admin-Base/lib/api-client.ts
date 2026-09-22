// HTTP 客户端：token 管理 + fetch 包装 + 通用 get/post/put/del。
// 各业务 endpoint 仅从这里 import，不直接 fetch。

export function getApiBase() {
  const envBase = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "")
  if (envBase) return envBase

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:8080/api/v1`
  }

  return "http://localhost:8080/api/v1"
}

export function getMediaBase() {
  const envBase = process.env.NEXT_PUBLIC_MEDIA_BASE || process.env.NEXT_PUBLIC_API_BASE
  if (envBase) return envBase.replace(/\/$/, "")

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:8080`
  }

  return "http://localhost:8080"
}

export function resolveMediaUrl(url: string): string {
  if (!url) return ""
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url
  if (url.startsWith("/")) return `${getMediaBase()}${url}`
  return `${getMediaBase()}/${url}`
}

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  error?: string
}

function getAuthHeader(): string | undefined {
  const t = getToken()
  if (!t) return undefined
  return t.startsWith("Bearer ") ? t : `Bearer ${t}`
}

async function readErrorMessage(res: Response): Promise<string> {
  return parseErrorMessage(await res.text(), res.status)
}

function parseErrorMessage(text: string, status: number, fallback = "请求失败"): string {
  if (!text) return `${fallback} (${status})`
  try {
    const json = JSON.parse(text) as Partial<ApiResponse>
    if (typeof json.message === "string" && json.message.trim()) return json.message
    if (typeof json.error === "string" && json.error.trim()) return json.error
  } catch {}
  return `${fallback} (${status})`
}

function handleInvalidSession(status: number, text = ""): string | null {
  if (status !== 401 && status !== 409) return null
  let message = status === 409 ? "您的账号已在其他设备登录，当前会话已失效" : "未登录或登录已过期"
  if (text) {
    try {
      const body = JSON.parse(text) as Partial<ApiResponse>
      if (body.message) message = body.message
    } catch {}
  }
  clearToken()
  if (typeof window !== "undefined") {
    if (status === 409) alert(message)
    window.location.href = "/login"
  }
  return message
}

function composeSignal(callerSignal?: AbortSignal, timeoutMs = 30000) {
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true })
  const timeout = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs)
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout)
      callerSignal?.removeEventListener("abort", abortFromCaller)
    },
  }
}

let token = ""
let _offlineUntil = 0

export function setToken(t: string) {
  token = t
  if (typeof window !== "undefined") {
    localStorage.setItem("token", t)
  }
}

export function getToken(): string {
  if (token) return token
  if (typeof window !== "undefined") {
    token = localStorage.getItem("token") || ""
  }
  return token
}

export function clearToken() {
  token = ""
  if (typeof window !== "undefined") {
    localStorage.removeItem("token")
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (Date.now() < _offlineUntil) throw new Error("backend offline")

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  }

  const authHeader = getAuthHeader()
  if (authHeader) {
    headers["Authorization"] = authHeader
  }

  const { signal, cleanup } = composeSignal(options.signal ?? undefined)

  let res: Response
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers,
      signal,
    })
  } catch (err) {
    if (options.signal?.aborted) throw err
    if (signal.aborted) throw new Error("请求超时，请稍后重试")
    _offlineUntil = Date.now() + 3000
    throw new Error("backend offline")
  } finally {
    cleanup()
  }
  _offlineUntil = 0

  if (res.status === 401 || res.status === 409) {
    const message = handleInvalidSession(res.status, await res.text())
    throw new Error(message || "请求失败")
  }

  if (!res.ok) {
    const msg = await readErrorMessage(res)
    throw new Error(msg)
  }

  const text = await res.text()
  if (!text) {
    return undefined as T
  }

  let json: ApiResponse<T>
  try {
    json = JSON.parse(text) as ApiResponse<T>
  } catch {
    throw new Error(`服务器返回异常 (${res.status})`)
  }
  if (json.code !== 0) {
    throw new Error(json.message || "请求失败")
  }
  return json.data
}

export function get<T = unknown>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const query = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(
          ([k, v]) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
        )
        .join("&")
    : ""
  return request<T>(path + query)
}

export async function downloadFile(
  path: string,
  params?: Record<string, unknown>,
  fallbackFilename = "export.xlsx",
  signal?: AbortSignal
): Promise<void> {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.append(key, String(value))
  })
  const authHeader = getAuthHeader()
  const composed = composeSignal(signal)
  try {
    const response = await fetch(`${getApiBase()}${path}${query.size ? `?${query.toString()}` : ""}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
      signal: composed.signal,
    })
    if (response.status === 401 || response.status === 409) {
      throw new Error(handleInvalidSession(response.status, await response.text()) || "请求失败")
    }
    if (!response.ok) throw new Error(await readErrorMessage(response))

    const blob = await response.blob()
    const disposition = response.headers.get("Content-Disposition") || ""
    const filenameMatch = disposition.match(/filename=([^;]+)/)
    const filename = filenameMatch ? decodeURIComponent(filenameMatch[1].trim().replace(/^"|"$/g, "")) : fallbackFilename
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    if (signal?.aborted) throw error
    if (composed.signal.aborted) throw new Error("请求超时，请稍后重试")
    if (error instanceof TypeError) throw new Error("backend offline")
    throw error
  } finally {
    composed.cleanup()
  }
}

export function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) })
}

export function put<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) })
}

// File upload (multipart/form-data)
export async function uploadFile<T = unknown>(
  path: string,
  file: File,
  fieldName = "file",
  callerSignal?: AbortSignal,
): Promise<T> {
  const form = new FormData()
  form.append(fieldName, file)

  const headers: Record<string, string> = {}
  const authHeader = getAuthHeader()
  if (authHeader) headers["Authorization"] = authHeader

  const { signal, cleanup } = composeSignal(callerSignal)
  let res: Response
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      method: "POST",
      headers,
      body: form,
      signal,
    })
  } catch (err) {
    if (callerSignal?.aborted) throw err
    if (signal.aborted) throw new Error("请求超时，请稍后重试")
    throw err
  } finally {
    cleanup()
  }

  if (res.status === 401 || res.status === 409) {
    throw new Error(handleInvalidSession(res.status, await res.text()) || "上传失败")
  }

  if (!res.ok) {
    const msg = await readErrorMessage(res)
    throw new Error(msg)
  }

  const json = (await res.json()) as ApiResponse<T>
  if (json.code !== 0) throw new Error(json.message || "上传失败")
  return json.data as T
}

export function del<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" })
}

// File upload with progress callback (uses XMLHttpRequest)
export function uploadFileWithProgress<T = unknown>(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
  fieldName = "file"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append(fieldName, file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${getApiBase()}${path}`)

    const authHeader = getAuthHeader()
    if (authHeader) xhr.setRequestHeader("Authorization", authHeader)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      const sessionMessage = handleInvalidSession(xhr.status, xhr.responseText)
      if (sessionMessage) return reject(new Error(sessionMessage))
      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(new Error(parseErrorMessage(xhr.responseText, xhr.status, "上传失败")))
      }
      try {
        const json = JSON.parse(xhr.responseText) as ApiResponse<T>
        if (json.code !== 0) return reject(new Error(json.message || "上传失败"))
        resolve(json.data as T)
      } catch { reject(new Error("上传失败")) }
    }
    xhr.onerror = () => reject(new Error("网络错误"))
    xhr.send(form)
  })
}
