export interface PromotionLaunchContext {
  dramaId: string | null
  linkId: string | null
}

export function readPromotionLaunchContext(search: string): PromotionLaunchContext {
  const params = new URLSearchParams(search)
  return {
    dramaId: params.get("dramaId"),
    linkId: params.get("linkId"),
  }
}
