import type { AppInfo } from "../api/contracts"

export const USER_KEY = "mini_drama_user"
export const USER_SESSION_EVENT = "mini-drama-user-session"

export interface UserData {
  userId: string
  appName: string
  clientKey?: string
  monetizationType?: AppInfo["monetizationType"]
  adPlacementId?: string
}

export function parseStoredUser(value: string | null): UserData | null {
  if (!value) return null

  try {
    const user = JSON.parse(value) as Partial<UserData>
    if (typeof user.userId !== "string" || !user.userId) return null
    return user as UserData
  } catch {
    return null
  }
}

export function readStoredUser(storage: Pick<Storage, "getItem">): UserData | null {
  return parseStoredUser(storage.getItem(USER_KEY))
}

export function persistUser(storage: Pick<Storage, "setItem">, user: UserData): void {
  storage.setItem(USER_KEY, JSON.stringify(user))
}
