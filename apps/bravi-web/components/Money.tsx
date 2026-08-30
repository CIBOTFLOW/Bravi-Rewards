const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string) {
  const cached = formatters.get(currency)
  if (cached) return cached
  const created = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  })
  formatters.set(currency, created)
  return created
}

export function Money({
  minor,
  currency = 'USD',
  sign = false,
}: {
  minor: number
  currency?: string
  sign?: boolean
}) {
  const value = formatter(currency).format(Math.abs(minor) / 100)
  return <>{sign && minor !== 0 ? (minor > 0 ? '+' : '−') : ''}{value}</>
}
