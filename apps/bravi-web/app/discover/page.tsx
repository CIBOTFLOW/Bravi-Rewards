import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Discover' }

const programs = [
  {
    tone: 'green',
    label: 'Work enablement',
    title: 'Tools that keep work moving',
    summary: 'Broad support for verified work essentials, transport, and capacity needs.',
    note: 'FEP-reviewed program',
  },
  {
    tone: 'gold',
    label: 'Everyday essentials',
    title: 'Practical help, at the right moment',
    summary: 'Public-safe context for household essentials without exposing private evidence.',
    note: 'Public cards are context only',
  },
  {
    tone: 'coral',
    label: 'Community capacity',
    title: 'Recognize people helping others',
    summary: 'Support a broad, reviewed cohort while FEP independently selects eligible cases.',
    note: 'No named-recipient targeting',
  },
]

export default function DiscoverPage() {
  return (
    <main className="page-stack">
      <section className="page-heading">
        <span className="eyebrow">Discover</span>
        <h1>See where capacity can grow.</h1>
        <p>Explore approved programs and public-safe stories. Bravi shows context; FEP retains eligibility and allocation authority.</p>
      </section>

      <section className="program-grid" aria-label="Example approved programs">
        {programs.map((program) => (
          <article className={`program-card ${program.tone}`} key={program.title}>
            <span className="tag">{program.label}</span>
            <h2>{program.title}</h2>
            <p>{program.summary}</p>
            <footer>{program.note}</footer>
          </article>
        ))}
      </section>

      <section className="boundary-panel">
        <div>
          <span className="eyebrow">Clear authority</span>
          <h2>A preference is not a decision.</h2>
        </div>
        <p>
          Choosing a program or broad cohort tells FEP what kind of impact matters to you.
          It never approves a case, reveals a private applicant, or moves money.
        </p>
        <Link className="button button-secondary" href="/give">Plan how much</Link>
      </section>

      <section className="affiliate-note">
        <span aria-hidden="true">A</span>
        <div>
          <h2>Amazon essentials catalog</h2>
          <p>Only reviewed SiteStripe links may enter the catalog. Affiliate earnings feed an aggregate pool and never create points or determine recipient eligibility.</p>
        </div>
      </section>
    </main>
  )
}
