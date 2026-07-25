import { NextResponse } from 'next/server'
import { backendApiFetch } from '@/lib/server/backend-api'
import {
  clearSessionCookie,
  getSessionToken,
} from '@/lib/server/auth-session'

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
      console.error('Falha ao invalidar o token no backend', error)
    }
  }

  const response = new NextResponse(null, {
    status: 204,
  })

  clearSessionCookie(response)

  return response
}