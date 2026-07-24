import type { ClinicAuthorizationContext } from '#services/clinic_authorization_service'
import type ClinicProfessional from '#models/clinic_professional'

export type AppointmentManagementScope = 'all' | 'own'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    clinicAuthorization?: ClinicAuthorizationContext
    scheduleProfessional?: ClinicProfessional
    appointmentManagementScope?: AppointmentManagementScope
  }
}
