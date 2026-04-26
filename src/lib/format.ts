export function formatMoney(value: number, currency?: string) {
  if (currency) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatWeight(value: number) {
  return `${value.toFixed(2)} g`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}