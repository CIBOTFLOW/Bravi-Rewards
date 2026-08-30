'use client'

import { FormEvent, useState } from 'react'

import type { DisbursementPlan } from '@/lib/contracts'

function dollars(minor: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)
}

export function GivePlanner({ availableMinor, currency }: { availableMinor: number; currency: string }) {
  const [amount, setAmount] = useState(Math.min(400, availableMinor / 100).toFixed(2))
  const [denomination, setDenomination] = useState('15')
  const [plan, setPlan] = useState<DisbursementPlan | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const maximum = (availableMinor / 100).toFixed(2)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setPlan(null)
    try {
      const response = await fetch('/api/v1/gift-card-disbursement-plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          totalAmountMinor: Math.round(Number(amount) * 100),
          denominationMinor: Math.round(Number(denomination) * 100),
          currency,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message ?? 'Could not create the plan.')
      setPlan(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the plan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="planner-card">
      <form onSubmit={submit}>
        <div className="planner-balance">
          <span>Available to plan</span>
          <strong>{dollars(availableMinor, currency)}</strong>
        </div>
        <label>
          Total amount
          <span className="currency-input"><span>$</span><input min="0.01" max={maximum} step="0.01" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} /></span>
        </label>
        <label>
          Equal gift-card value
          <select value={denomination} onChange={(event) => setDenomination(event.target.value)}>
            <option value="5">$5</option>
            <option value="10">$10</option>
            <option value="15">$15</option>
            <option value="25">$25</option>
            <option value="50">$50</option>
            <option value="100">$100</option>
          </select>
        </label>
        <button className="button button-primary full" disabled={loading} type="submit">
          {loading ? 'Planning…' : 'Preview distribution'}
        </button>
      </form>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {plan ? (
        <div className="plan-result" aria-live="polite">
          <span className="eyebrow">No-effect preview</span>
          <strong>{plan.giftCount}</strong>
          <h2>equal gift cards</h2>
          <div className="plan-equation">
            <span>{plan.giftCount} × {dollars(plan.denominationMinor, currency)}</span>
            <b>{dollars(plan.allocatedAmountMinor, currency)}</b>
          </div>
          <div className="plan-equation remainder">
            <span>Left unallocated</span>
            <b>{dollars(plan.remainderMinor, currency)}</b>
          </div>
          <p>Next, a future consented delivery step can collect recipients one at a time. This preview does not.</p>
        </div>
      ) : null}
    </section>
  )
}
