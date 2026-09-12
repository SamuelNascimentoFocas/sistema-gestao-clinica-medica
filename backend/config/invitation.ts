import app from '@adonisjs/core/services/app'
import env from '#start/env'

const configuredFrontendUrl = env.get('FRONTEND_URL')

if (app.inProduction && !configuredFrontendUrl) {
  throw new Error('FRONTEND_URL is required in production')
}

const frontendUrl = new URL(configuredFrontendUrl ?? 'http://localhost:3000')

if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
  throw new Error('FRONTEND_URL must use HTTP or HTTPS')
}

export default {
  frontendUrl: frontendUrl.toString().replace(/\/$/, ''),
  tokenTtlHours: 24,
} as const
