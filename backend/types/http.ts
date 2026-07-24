import type { ClinicAuthorizationContext } from '#services/clinic_authorization_service'
import type ClinicProfessional from '#models/clinic_professional'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    clinicAuthorization?: ClinicAuthorizationContext
    scheduleProfessional?: ClinicProfessional
  }
}
