import type { HttpContext } from '@adonisjs/core/http'
import DomainError from '#exceptions/domain_error'

export function respondToDomainError(error: unknown, response: HttpContext['response']) {
  if (!(error instanceof DomainError)) {
    throw error
  }

  switch (error.kind) {
    case 'forbidden':
      return response.forbidden({ message: error.message })
    case 'not_found':
      return response.notFound({ message: error.message })
    case 'conflict':
      return response.conflict({ message: error.message })
    case 'invalid':
      return response.unprocessableEntity({ message: error.message })
    case 'storage_unavailable':
      return response.internalServerError({ message: error.message })
  }
}
