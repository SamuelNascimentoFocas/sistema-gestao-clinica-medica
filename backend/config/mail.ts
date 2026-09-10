import { defineConfig, transports } from '@adonisjs/mail'
import app from '@adonisjs/core/services/app'
import env from '#start/env'

const smtpUser = env.get('SMTP_USER')
const smtpPassword = env.get('SMTP_PASSWORD')
const smtpHost = env.get('SMTP_HOST')
const mailFrom = env.get('MAIL_FROM')

if (app.inProduction && (!smtpHost || !mailFrom)) {
  throw new Error('SMTP_HOST and MAIL_FROM are required in production')
}

if (Boolean(smtpUser) !== Boolean(smtpPassword)) {
  throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together')
}

const mailConfig = defineConfig({
  default: 'smtp',
  from: mailFrom ?? 'no-reply@clinic.local',
  mailers: {
    smtp: transports.smtp({
      host: smtpHost ?? '127.0.0.1',
      port: env.get('SMTP_PORT', 1025),
      secure: env.get('SMTP_SECURE', false),
      auth:
        smtpUser && smtpPassword
          ? {
              type: 'login',
              user: smtpUser,
              pass: smtpPassword,
            }
          : undefined,
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
