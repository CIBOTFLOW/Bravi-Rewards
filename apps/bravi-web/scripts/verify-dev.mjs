import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const production = process.argv.includes('--production')
const port = production ? 3200 : 3199
const baseUrl = `http://127.0.0.1:${port}`
const childEnvironment = { ...process.env }
if (production) {
  delete childEnvironment.BRAVI_REWARDS_CORE_URL
  delete childEnvironment.BRAVI_REWARDS_BFF_TOKEN
  delete childEnvironment.BRAVI_WEB_SESSIONS_JSON
}
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    cwd: process.cwd(),
    env: childEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)

let diagnostics = ''
child.stdout.on('data', (chunk) => { diagnostics += chunk.toString('utf8') })
child.stderr.on('data', (chunk) => { diagnostics += chunk.toString('utf8') })

async function waitUntilReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Next dev exited early.\n${diagnostics}`)
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // The server has not opened its socket yet.
    }
    await delay(150)
  }
  throw new Error(`Next dev did not become ready.\n${diagnostics}`)
}

async function stop() {
  if (child.exitCode != null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(3000).then(() => child.kill('SIGKILL')),
  ])
}

try {
  await waitUntilReady()

  const home = await fetch(baseUrl).then((response) => response.text())
  assert.match(home, /Small rewards\./)

  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json())
  assert.equal(health.status, 'degraded')
  assert.equal(health.effects.giftCardOrderCreation, false)
  assert.equal(health.effects.providerSubmission, false)
  assert.equal(health.effects.fepRecipientSelection, false)

  if (production) {
    assert.match(home, /Production member sessions are not configured/)
    const walletResponse = await fetch(`${baseUrl}/api/v1/wallet`)
    assert.equal(walletResponse.status, 503)
    assert.equal((await walletResponse.json()).error, 'SESSION_UNAVAILABLE')

    const planResponse = await fetch(`${baseUrl}/api/v1/gift-card-disbursement-plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ totalAmountMinor: 40000, denominationMinor: 1500, currency: 'USD' }),
    })
    assert.equal(planResponse.status, 503)
    assert.equal((await planResponse.json()).error, 'SESSION_UNAVAILABLE')
    process.stdout.write('Bravi web production fail-closed journey passed.\n')
    process.exitCode = 0
  } else {
    assert.match(home, /Illustrative preview wallet/)
    const wallet = await fetch(`${baseUrl}/api/v1/wallet`).then((response) => response.json())
    assert.equal(wallet.availableMinor, 40000)
    assert.equal(wallet.source, 'demo')

    const planResponse = await fetch(`${baseUrl}/api/v1/gift-card-disbursement-plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        totalAmountMinor: 40000,
        denominationMinor: 1500,
        currency: 'USD',
      }),
    })
    assert.equal(planResponse.status, 200)
    const plan = await planResponse.json()
    assert.equal(plan.giftCount, 26)
    assert.equal(plan.allocatedAmountMinor, 39000)
    assert.equal(plan.remainderMinor, 1000)
    assert.equal(plan.effect, 'NONE')

    const privateFieldResponse = await fetch(`${baseUrl}/api/v1/gift-card-disbursement-plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        totalAmountMinor: 1500,
        denominationMinor: 1500,
        currency: 'USD',
        recipientEmail: 'private@example.com',
      }),
    })
    assert.equal(privateFieldResponse.status, 400)
    assert.equal((await privateFieldResponse.json()).error, 'UNSUPPORTED_PLAN_FIELD')

    process.stdout.write('Bravi web HTTP journey passed.\n')
  }
} finally {
  await stop()
}
