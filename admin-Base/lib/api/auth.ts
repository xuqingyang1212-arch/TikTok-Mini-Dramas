import { get, post } from "../api-client"

export interface UserLoginResponse {
  token: string
  user: { id?: number; name?: string; email?: string; role?: string }
}

export interface CurrentUserResponse {
  user: { id?: number; name?: string; email?: string; permissions?: string[] }
  permissions: string[]
}

export const authApi = {
  login: (email: string) => post<UserLoginResponse>("/auth/login", { email }),
  me: () => get<CurrentUserResponse>("/users/me"),
}
