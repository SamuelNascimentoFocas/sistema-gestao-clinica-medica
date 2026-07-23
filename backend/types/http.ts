import type { ClinicAuthorizationContext } from '#services/clinic_authorization_service'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    clinicAuthorization?: ClinicAuthorizationContext
  }
}
