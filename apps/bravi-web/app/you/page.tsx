import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'You' }

export default function YouPage() {
  return (
    <main className="page-stack">
      <section className="profile-hero">
        <div className="avatar" aria-hidden="true">B</div>
        <div>
          <span className="eyebrow">You</span>
          <h1>Member controls</h1>
          <p>Privacy-first defaults for gifts, recognition, and impact visibility.</p>
        </div>
      </section>

      <section className="settings-panel">
        <h2>Visibility</h2>
        <div className="setting-row">
          <div><strong>Impact on your feed</strong><span>Off by default; aggregated unless you opt in.</span></div>
          <span className="setting-value">Private</span>
        </div>
        <div className="setting-row">
          <div><strong>Gift attribution</strong><span>Choose per gift; recipient contact is never public.</span></div>
          <span className="setting-value">Ask each time</span>
        </div>
        <div className="setting-row">
          <div><strong>Community recognition</strong><span>Requires explicit consent and FEP review.</span></div>
          <span className="setting-value">Off</span>
        </div>
      </section>

      <section className="settings-panel">
        <h2>Account boundaries</h2>
        <div className="setting-row">
          <div><strong>Wallet authority</strong><span>Bravi Rewards Core journal</span></div>
          <span className="setting-value safe">Connected concept</span>
        </div>
        <div className="setting-row">
          <div><strong>FEP decisions</strong><span>Never made by Bravi or a sponsor</span></div>
          <span className="setting-value safe">Separated</span>
        </div>
        <div className="setting-row">
          <div><strong>Provider delivery</strong><span>Disabled until sandbox and reconciliation approval</span></div>
          <span className="setting-value blocked">Gated</span>
        </div>
      </section>
    </main>
  )
}
