import { miniApi } from "@/lib/api"
import { readPromotionLaunchContext } from "@/lib/app/promotion"

const activations = new Map<string, Promise<void>>()

export function ensurePromotionActivation(userId: string, search: string): Promise<void> {
  const { linkId } = readPromotionLaunchContext(search)
  if (linkId === null) return Promise.resolve()

  const key = `${userId}:${linkId}`
  const existing = activations.get(key)
  if (existing) return existing

  const activation = miniApi.activateUser(userId, linkId).then(() => undefined)
  activations.set(key, activation)
  activation.catch(() => {
    if (activations.get(key) === activation) activations.delete(key)
  })
  return activation
}
