import Link from 'next/link'

import { Money } from '@/components/Money'
import type { WalletView } from '@/lib/contracts'

export function WalletCard({ wallet }: { wallet: WalletView }) {
  return (
    <section className="wallet-card" aria-labelledby="wallet-title">
      <div>
        <span className="eyebrow light">Available rewards</span>
        <h2 id="wallet-title"><Money minor={wallet.availableMinor} currency={wallet.currency} /></h2>
        <p>{wallet.source === 'demo' ? 'Illustrative preview wallet' : `Rewards Core projection v${wallet.version}`}</p>
      </div>
      <dl>
        <div><dt>Pending</dt><dd><Money minor={wallet.pendingMinor} currency={wallet.currency} /></dd></div>
        <div><dt>Reserved</dt><dd><Money minor={wallet.reservedMinor} currency={wallet.currency} /></dd></div>
        <div><dt>Lifetime given</dt><dd><Money minor={wallet.lifetimeGiftedMinor + wallet.lifetimeGivenToFepMinor} currency={wallet.currency} /></dd></div>
      </dl>
      <Link className="wallet-action" href="/give">Use rewards <span aria-hidden="true">→</span></Link>
    </section>
  )
}
