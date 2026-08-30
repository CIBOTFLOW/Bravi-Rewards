import Link from 'next/link'

import { BoundaryNotice } from '@/components/BoundaryNotice'
import { Money } from '@/components/Money'
import { WalletCard } from '@/components/WalletCard'
import { getMemberSession } from '@/lib/session'
import { getWallet } from '@/lib/rewards-core'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
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
      <section className="hero home-hero">
        <div className="eyebrow">Your capacity, made useful</div>
        <h1>Small rewards.<br />Real momentum.</h1>
        <p>
          Use Bravi for yourself, gift a person you choose, or express a broad
          community preference for FEP to review independently.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/give">Plan a gift</Link>
          <Link className="button button-secondary" href="/discover">Discover impact</Link>
        </div>
      </section>

      {walletResult.wallet ? (
        <WalletCard wallet={walletResult.wallet} />
      ) : (
        <BoundaryNotice
          title="Rewards are temporarily unavailable"
          detail={walletResult.reason ?? (session.status === 'unavailable'
            ? session.reason
            : 'A verified member session is required to view a wallet.')}
        />
      )}

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Ways to use Bravi</span>
            <h2>Choose the kind of good</h2>
          </div>
        </div>
        <div className="choice-grid">
          <article className="choice-card coral">
            <span className="choice-icon" aria-hidden="true">↗</span>
            <h3>Give directly</h3>
            <p>Plan equal-value gift cards for people you already know.</p>
            <Link href="/give">Open planner <span aria-hidden="true">→</span></Link>
          </article>
          <article className="choice-card green">
            <span className="choice-icon" aria-hidden="true">◎</span>
            <h3>Back a program</h3>
            <p>Express a preference for an approved program or broad cohort. FEP decides cases.</p>
            <Link href="/discover">See programs <span aria-hidden="true">→</span></Link>
          </article>
          <article className="choice-card gold">
            <span className="choice-icon" aria-hidden="true">◇</span>
            <h3>Build your balance</h3>
            <p>Earn rewards from verified settled commerce and approved programs.</p>
            <Link href="/activity">View activity <span aria-hidden="true">→</span></Link>
          </article>
        </div>
      </section>

      <section className="impact-strip" aria-label="Example Bravi gift-card distribution">
        <div>
          <span className="eyebrow">A useful example</span>
          <strong><Money minor={40000} /></strong>
        </div>
        <p><b>26 people</b> can each receive a <Money minor={1500} /> gift card, with <Money minor={1000} /> left unallocated.</p>
        <Link className="text-link" href="/give">Try the plan →</Link>
      </section>
    </main>
  )
}
