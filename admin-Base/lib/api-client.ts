// HTTP 客户端：token 管理 + fetch 包装 + 通用 get/post/put/del。
// 各业务 endpoint 仅从这里 import，不直接 fetch。

export function getApiBase() {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8080/api/v1`
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/v1"
}

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
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
    ...(options.headers as Record<string, string>),
  }

  const t = getToken()
  if (t) {
    headers["Authorization"] = `Bearer ${t}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  let res: Response
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("请求超时，请稍后重试")
    }
    _offlineUntil = Date.now() + 3000
    throw new Error("backend offline")
  } finally {
    clearTimeout(timeout)
  }
  _offlineUntil = 0

  if (res.status === 401) {
    clearToken()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    throw new Error("未登录或登录已过期")
  }

  if (res.status === 409) {
    const body = await res.text()
    let msg = "您的账号已在其他设备登录，当前会话已失效"
    try {
      const j = JSON.parse(body)
      if (j.message) msg = j.message
    } catch {}
    clearToken()
    if (typeof window !== "undefined") {
      alert(msg)
      window.location.href = "/login"
    }
    throw new Error(msg)
  }

  const text = await res.text()
  if (!text) {
    throw new Error(`服务器错误 (${res.status})`)
  }
  let json: ApiResponse<T>
  try {
    json = JSON.parse(text)
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
  fieldName = "file"
): Promise<T> {
  const form = new FormData()
  form.append(fieldName, file)

  const t = getToken()
  const headers: Record<string, string> = {}
  if (t) headers["Authorization"] = `Bearer ${t}`

  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers,
    body: form,
  })

  if (res.status === 401) {
    clearToken()
    if (typeof window !== "undefined") window.location.href = "/login"
    throw new Error("未登录或登录已过期")
  }

  const json = await res.json()
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

    const t = getToken()
    if (t) xhr.setRequestHeader("Authorization", `Bearer ${t}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText)
        if (json.code !== 0) return reject(new Error(json.message || "上传失败"))
        resolve(json.data as T)
      } catch { reject(new Error("上传失败")) }
    }
    xhr.onerror = () => reject(new Error("网络错误"))
    xhr.send(form)
  })
}
