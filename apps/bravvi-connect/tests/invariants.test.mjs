import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const app = await read('../src/App.tsx')
const config = await read('../src/config.ts')
const gateway = await read('../src/gateway.ts')
const data = await read('../src/data.ts')

test('canonical mobile navigation is Home Discover Create Activity You', () => {
  const labels = ['Home', 'Discover', 'Create', 'Activity', 'You']
  const positions = labels.map((label) => app.indexOf(`label: '${label}'`))
  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
})

test('paid work and risky live effects default disabled', () => {
  for (const flag of ['paidHelp: false', 'providerOnboarding: false', 'publicDreamPublishing: false', 'liveRewardsGiving: false', 'liveRewardsRedemption: false', 'liveVendorOrdering: false']) {
    assert.match(config, new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('staging and live modes fail closed rather than returning mocks', () => {
  assert.match(gateway, /IS_DEMO_MODE \? demoFepGateway : failClosedFepGateway/)
  assert.match(gateway, /IS_DEMO_MODE \? demoRewardsGateway : failClosedRewardsGateway/)
  assert.doesNotMatch(gateway, /staging.*mock|live.*mock/i)
})

test('draft save is truthful and local only', () => {
  assert.match(app, /Draft saved on this device\. Nothing was submitted to FEP\./)
  assert.match(gateway, /LOCAL_DRAFTS_KEY/)
  assert.doesNotMatch(app, /open for community voting|funding matched|you are approved/i)
})

test('financially misleading controls and public ranking language are absent', () => {
  for (const prohibited of ['Vote to fund', 'Add funds', 'Withdraw Rewards', 'cash out']) assert.doesNotMatch(app, new RegExp(prohibited, 'i'))
  assert.match(app, /No star rating, moral score, eligibility effect or public ranking/)
})

test('rewards and engagement are excluded from eligibility', () => {
  assert.match(app, /Reward balance, purchase history, giving behavior and goal activity are never used to decide aid eligibility or priority/)
})

test('the browser does not call Sultan or Supabase directly', () => {
  assert.doesNotMatch(app + gateway, /supabase\.co|service_role|sultan-fep|\/v1\/recommendations/i)
})

test('essential request data contains work-boots and multi-vendor planning language', () => {
  assert.match(data, /WORK-BOOTS/)
  assert.match(app, /compare fresh approved vendor offers, fees, substitutions, delivery windows and the authorized amount/)
})
