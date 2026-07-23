import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const SessionsController = () => import('#controllers/sessions_controller')
const ClinicsController = () => import('#controllers/clinics_controller')

router.get('/', async () => {
  return {
    name: 'Clinic Management API',
    status: 'ok',
  }
})

router
  .group(() => {
    router.post('/login', [SessionsController, 'store'])
  })
  .prefix('/api/v1/auth')

router
  .group(() => {
    router.get('/me', [SessionsController, 'show'])
    router.delete('/logout', [SessionsController, 'destroy'])
  })
  .prefix('/api/v1/auth')
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )

router
  .group(() => {
    router.get('/', [ClinicsController, 'index'])
    router.post('/', [ClinicsController, 'store'])

    router.get('/:id', [ClinicsController, 'show']).where('id', router.matchers.uuid())

    router.patch('/:id', [ClinicsController, 'update']).where('id', router.matchers.uuid())

    router
      .patch('/:id/status', [ClinicsController, 'updateStatus'])
      .where('id', router.matchers.uuid())
  })
  .prefix('/api/v1/clinics')
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(middleware.globalAdmin())
