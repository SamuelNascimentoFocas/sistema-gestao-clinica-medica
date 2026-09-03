/**
 * Application failures, independent of HTTP. Controllers choose the response status.
 */
export default class DomainError extends Error {
  constructor(
    public readonly kind:
      'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'storage_unavailable',
    message: string
  ) {
    super(message)
    this.name = 'DomainError'
  }
}
