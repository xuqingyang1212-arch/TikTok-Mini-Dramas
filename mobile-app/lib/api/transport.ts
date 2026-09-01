import { API_PREFIX, getApiBaseUrl } from "./platform"

export class ApiError extends Error {
  readonly status?: number
  readonly code?: number
  readonly response?: Response
  readonly body?: unknown

  constructor(message: string, init: { status?: number; code?: number; response?: Response; body?: unknown } = {}) {
    super(message)
    this.name = "ApiError"
    this.status = init.status
    this.code = init.code
    this.response = init.response
    this.body = init.body
  }

  static async fromResponse(response: Response, fallbackMessage?: string): Promise<ApiError> {
    const body = await parseResponseBody(response)
    const code = typeof body === "object" && body && "code" in body && typeof body.code === "number" ? body.code : undefined
    const message =
      (typeof body === "object" && body && "message" in body && typeof body.message === "string" && body.message.trim()) ||
      (typeof body === "object" && body && "error" in body && typeof body.error === "string" && body.error.trim()) ||
      fallbackMessage || `Request failed (${response.status})`

    return new ApiError(message, {
      status: response.status,
      code,
      response,
      body,
    })
  }
}

export function encodePathSegment(value: string | number): string {
  return encodeURIComponent(String(value))
}

export function getAcceptLanguageHeader(): string {
  if (typeof window === "undefined") return "zh-CN"

  const savedLocale = window.localStorage.getItem("mini_drama_language")
  if (savedLocale === "en") return "en-US"
  if (savedLocale === "zh") return "zh-CN"

  const docLang = document.documentElement.lang || navigator.language || "zh-CN"
  return docLang.toLowerCase().startsWith("en") ? "en-US" : "zh-CN"
}

export async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text || !text.trim()) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function buildApiUrl(path: string): string {
  const normalizedBase = getApiBaseUrl().replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${API_PREFIX}${normalizedPath}`
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  const isJsonBody = options?.body != null && typeof options.body === "string" && !headers.has("Content-Type")
  if (isJsonBody) {
    headers.set("Content-Type", "application/json")
  }
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", getAcceptLanguageHeader())
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw await ApiError.fromResponse(response, "Request failed")
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await parseResponseBody(response)

  if (payload && typeof payload === "object" && "code" in payload && "data" in payload) {
    const envelope = payload as { code?: number; message?: string; data?: T }
    if (typeof envelope.code === "number" && envelope.code !== 0) {
      throw new ApiError(envelope.message || "Request failed", {
        status: response.status,
        code: envelope.code,
        body: payload,
      })
    }
    return envelope.data as T
  }

  return payload as T
}
