import type { DeviceOS, SubscriptionPlan } from "./contracts"

export const API_PREFIX = "/api/mini"

export function getApiBaseUrl(): string {
  if (typeof process !== "undefined") {
    const envValues = [
      process.env.NEXT_PUBLIC_API_BASE_URL,
      process.env.NEXT_PUBLIC_MINI_API_BASE_URL,
      process.env.API_BASE_URL,
    ]
    const envValue = envValues.find((value) => typeof value === "string" && value.trim().length > 0)
    if (envValue) {
      return envValue.trim().replace(/\/+$/, "")
    }
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location
    const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)
    if (isLocalHost) {
      return `${protocol}//${hostname}:8080`
    }

    if (port) {
      return `${protocol}//${hostname}:8080`
    }

    return `${protocol}//${hostname}`
  }

  return "http://localhost:8080"
}

export function getMediaUrl(path: string): string {
  if (!path) return ""
  if (/^https?:\/\//i.test(path) || path.startsWith("//")) return path
  const base = getApiBaseUrl().replace(/\/+$/, "")
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

export function getDeviceOs(): DeviceOS {
  if (typeof navigator === "undefined") return "Apple"
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes("android") ? "Google" : "Apple"
}

export function getDevicePrice(plan: SubscriptionPlan, deviceOs: DeviceOS = getDeviceOs()): number {
  return deviceOs === "Google" ? plan.googlePrice || plan.applePrice || 0 : plan.applePrice || plan.googlePrice || 0
}
