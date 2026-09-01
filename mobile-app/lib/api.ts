import { getApiBaseUrl } from "./api/platform"

export * from "./api/contracts"
export * from "./api/domain"
export * from "./api/platform"
export * from "./api/transport"
export * from "./api/services"

export { miniApi } from "./api/services"
export const API_BASE = getApiBaseUrl()
