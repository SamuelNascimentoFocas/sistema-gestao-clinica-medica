export type AuthUser = {
  id: string
  fullName: string
  email: string
  isGlobalAdmin: boolean
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type AuthUserResponse = {
  user: AuthUser
}

export type BackendLoginResponse = AuthUserResponse & {
  token: {
    type: 'bearer'
    value: string
    expiresAt: string | null
  }
}

export type ApiErrorResponse = {
  message: string
  errors?: unknown
}