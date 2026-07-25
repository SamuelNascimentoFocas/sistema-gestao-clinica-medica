const JSON_CONTENT_TYPE = 'application/json'

function getBackendApiUrl() {
  const backendApiUrl = process.env.BACKEND_API_URL?.trim()

  if (!backendApiUrl) {
    throw new Error('A variável BACKEND_API_URL não foi configurada')
  }

  return backendApiUrl.replace(/\/+$/, '')
}

export async function backendApiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)

  headers.set('Accept', JSON_CONTENT_TYPE)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', JSON_CONTENT_TYPE)
  }

  return fetch(`${getBackendApiUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}

export async function readBackendResponse(response: Response): Promise<unknown> {
  const body = await response.text()

  if (!body) {
    return null
  }

  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

export function getBackendError(
  body: unknown,
  fallbackMessage: string
): {
  message: string
  errors?: unknown
} {
  if (typeof body !== 'object' || body === null) {
    return {
      message: fallbackMessage,
    }
  }

  const candidate = body as {
    message?: unknown
    errors?: unknown
  }

  return {
    message:
      typeof candidate.message === 'string'
        ? candidate.message
        : fallbackMessage,
    ...(candidate.errors === undefined
      ? {}
      : {
          errors: candidate.errors,
        }),
  }
}