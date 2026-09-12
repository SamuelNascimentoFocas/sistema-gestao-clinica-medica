// Process-local, monotonic sequences. Do not reset between tests sharing a database.
const counters = new Map<string, number>()

export function nextFixtureSequence(resource: string) {
  const next = (counters.get(resource) ?? 0) + 1
  counters.set(resource, next)
  return next
}
