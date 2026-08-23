import { RewardsService } from './rewardsService.js'

export function createDemoService() {
  const service = new RewardsService()
  service.createCompany({ code: 'LUZIONE', name: 'Luzione' })
  service.createCompany({ code: 'CI_FLOW', name: 'C.I Flow' })
  service.createMember({ subjectId: 'member_connor' })
  service.createMember({ subjectId: 'member_irem' })
  service.createProgramVersion({
    companyCode: 'LUZIONE',
    programCode: 'LUZIONE_STANDARD',
    version: 1,
    rateBps: 300,
    currency: 'USD',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
  })
  return service
}
