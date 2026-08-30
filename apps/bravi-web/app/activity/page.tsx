import type { Metadata } from 'next'

import { Money } from '@/components/Money'

export const metadata: Metadata = { title: 'Activity' }

const activity = [
  { type: 'Reward earned', note: 'Settled Luzione purchase', amount: 1200, tone: 'positive', date: 'Aug 28' },
  { type: 'Gift received', note: 'Private gift', amount: 1500, tone: 'positive', date: 'Aug 24' },
  { type: 'Gift planned', note: '26 × $15 preview · no effect', amount: 0, tone: 'neutral', date: 'Aug 21' },
  { type: 'Community preference', note: 'Work enablement · awaiting FEP', amount: -2500, tone: 'pending', date: 'Aug 18' },
]

export default function ActivityPage() {
  return (
    <main className="page-stack">
      <section className="page-heading compact">
        <span className="eyebrow">Activity</span>
        <h1>A ledger you can understand.</h1>
        <p>Every reward event should show its source, status, and whether it changed your available balance.</p>
      </section>

      <section className="activity-panel" aria-label="Illustrative reward activity">
        <div className="activity-filter" aria-label="Activity categories">
          <span className="filter-active">All</span>
          <span>Earned</span>
          <span>Given</span>
          <span>Pending</span>
        </div>
        <div className="activity-list">
          {activity.map((item) => (
            <article className="activity-row" key={`${item.date}-${item.type}`}>
              <span className={`activity-mark ${item.tone}`} aria-hidden="true" />
              <div>
                <h2>{item.type}</h2>
                <p>{item.note}</p>
              </div>
              <div className="activity-value">
                <strong>{item.amount === 0 ? 'Preview' : <Money minor={item.amount} sign />}</strong>
                <time>{item.date}</time>
              </div>
            </article>
          ))}
        </div>
        <p className="fixture-label">Illustrative preview data · live ledger connection is an activation gate</p>
      </section>
    </main>
  )
}
