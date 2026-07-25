import { NextResponse } from 'next/server'
import {
  backendApiFetch,
  getBackendError,
  readBackendResponse,
} from '@/lib/server/backend-api'
import {
  clearSessionCookie,
  getSessionToken,
} from '@/lib/server/auth-session'

export async function GET() {
  const token = await getSessionToken()

  if (!token) {
    return NextResponse.json(
      {
        message: 'Sessão não autenticada',
      },
      {
        status: 401,
      }
    )
  }

  try {
    const backendResponse = await backendApiFetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const backendBody = await readBackendResponse(backendResponse)

    if (!backendResponse.ok) {
      const response = NextResponse.json(
        getBackendError(backendBody, 'Não foi possível validar a sessão'),
        {
          status: backendResponse.status,
        }
      )

      if (backendResponse.status === 401) {
        clearSessionCookie(response)
      }

      return response
    }

    return NextResponse.json(backendBody)
  } catch (error) {
    console.error('Falha na comunicação com o backend ao validar a sessão', error)

    return NextResponse.json(
      {
        message: 'Não foi possível conectar ao servidor da clínica',
      },
      {
        status: 503,
      }
    )
  }
}