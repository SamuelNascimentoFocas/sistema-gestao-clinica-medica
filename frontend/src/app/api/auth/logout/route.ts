import { NextResponse } from 'next/server'
import { backendApiFetch } from '@/lib/server/backend-api'
import {
  clearSessionCookie,
  getSessionToken,
} from '@/lib/server/auth-session'
import { logServerError } from '@/lib/server/server-logging'

export async function DELETE() {
  const token = await getSessionToken()

  if (token) {
    try {
      await backendApiFetch('/api/v1/auth/logout', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (error) {
      logServerError('auth.logout_backend_request_failed', error)
    }
  }

  const response = new NextResponse(null, {
    status: 204,
  })

  clearSessionCookie(response)

  return response
}
