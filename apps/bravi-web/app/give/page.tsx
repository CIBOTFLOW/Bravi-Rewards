import type { Metadata } from 'next'

import { BoundaryNotice } from '@/components/BoundaryNotice'
import { GivePlanner } from '@/components/GivePlanner'
import { getMemberSession } from '@/lib/session'
import { getWallet } from '@/lib/rewards-core'

export const metadata: Metadata = { title: 'Give' }
export const dynamic = 'force-dynamic'

export default async function GivePage() {
  const session = await getMemberSession()
  const walletResult = session.status === 'authenticated'
    ? await getWallet(session.memberSubjectId)
      .then((wallet) => ({ wallet, reason: null }))
      .catch((error: unknown) => ({
        wallet: null,
        reason: error instanceof Error ? error.message : 'Rewards Core is unavailable.',
      }))
    : { wallet: null, reason: null }

  return (
    <main className="page-stack">
      <section className="page-heading compact">
        <span className="eyebrow">Give</span>
        <h1>Turn one balance into many useful moments.</h1>
        <p>Preview an equal-value distribution before collecting any recipient contact or creating an order.</p>
      </section>

      {walletResult.wallet ? (
        <GivePlanner availableMinor={walletResult.wallet.availableMinor} currency={walletResult.wallet.currency} />
      ) : (
        <BoundaryNotice
          title="Planner needs a member session"
          detail={walletResult.reason ?? (session.status === 'unavailable' ? session.reason : 'Sign in before planning from a wallet.')}
        />
      )}

      <section className="safety-list" aria-labelledby="plan-boundary-title">
        <h2 id="plan-boundary-title">This is a plan, not a send</h2>
        <ul>
          <li>No wallet value is reserved or deducted.</li>
          <li>No gift-card provider request is created.</li>
          <li>No recipient name, email, or phone is collected.</li>
          <li>FEP recipient selection is never available in Bravi.</li>
        </ul>
      </section>
    </main>
  )
}
