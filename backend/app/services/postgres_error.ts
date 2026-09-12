export function getPostgreSqlError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  return error as { code?: string; constraint?: string }
}

export function getUniqueConstraint(error: unknown) {
  const databaseError = getPostgreSqlError(error)
  return databaseError?.code === '23505' ? (databaseError.constraint ?? null) : null
}
