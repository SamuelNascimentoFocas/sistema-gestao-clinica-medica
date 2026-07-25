import { NextResponse } from 'next/server'
import {
  backendApiFetch,
  getBackendError,
  readBackendResponse,
} from '@/lib/server/backend-api'
import { setSessionCookie } from '@/lib/server/auth-session'
import type {
  BackendLoginResponse,
  LoginRequest,
} from '@/types/auth'

function parseLoginRequest(body: unknown): LoginRequest | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const candidate = body as {
    email?: unknown
    password?: unknown
  }

  if (
    typeof candidate.email !== 'string' ||
    typeof candidate.password !== 'string'
  ) {
    return null
  }

  const email = candidate.email.trim()

  if (!email || !candidate.password) {
    return null
  }

  return {
    email,
    password: candidate.password,
  }
}

export async function POST(request: Request) {
  let requestBody: unknown

  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json(
      {
        message: 'Corpo da requisição inválido',
      },
      {
        status: 400,
      }
    )
  }

  const credentials = parseLoginRequest(requestBody)

  if (!credentials) {
    return NextResponse.json(
      {
        message: 'Informe um e-mail e uma senha válidos',
      },
      {
        status: 422,
      }
    )
  }

  try {
    const backendResponse = await backendApiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })

    const backendBody = await readBackendResponse(backendResponse)

    if (!backendResponse.ok) {
      return NextResponse.json(
        getBackendError(backendBody, 'Não foi possível realizar o login'),
        {
          status: backendResponse.status,
        }
      )
    }

    const loginResponse = backendBody as BackendLoginResponse | null

    if (
      !loginResponse?.user ||
      typeof loginResponse.token?.value !== 'string'
    ) {
      return NextResponse.json(
        {
          message: 'O servidor retornou uma sessão inválida',
        },
        {
          status: 502,
        }
      )
    }

    const response = NextResponse.json({
      user: loginResponse.user,
    })

    setSessionCookie(
      response,
      loginResponse.token.value,
      loginResponse.token.expiresAt
    )

    return response
  } catch (error) {
    console.error('Falha na comunicação com o backend durante o login', error)

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