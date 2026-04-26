const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function toWordsBelowHundred(value: number): string {
  if (value < 10) {
    return ONES[value]
  }

  if (value < 20) {
    return TEENS[value - 10]
  }

  const tensValue = Math.floor(value / 10)
  const onesValue = value % 10
  return onesValue === 0 ? TENS[tensValue] : `${TENS[tensValue]} ${ONES[onesValue]}`
}

function toWordsBelowThousand(value: number): string {
  if (value < 100) {
    return toWordsBelowHundred(value)
  }

  const hundredsValue = Math.floor(value / 100)
  const remainder = value % 100
  if (remainder === 0) {
    return `${ONES[hundredsValue]} hundred`
  }

  return `${ONES[hundredsValue]} hundred ${toWordsBelowHundred(remainder)}`
}

function numberToWords(value: number): string {
  if (value === 0) {
    return 'zero'
  }

  const parts: string[] = []
  const scales: Array<[number, string]> = [
    [10000000, 'crore'],
    [100000, 'lakh'],
    [1000, 'thousand'],
  ]

  let remainder = value

  scales.forEach(([divisor, label]) => {
    if (remainder >= divisor) {
      const unit = Math.floor(remainder / divisor)
      parts.push(`${numberToWords(unit)} ${label}`)
      remainder %= divisor
    }
  })

  if (remainder > 0) {
    parts.push(toWordsBelowThousand(remainder))
  }

  return parts.join(' ')
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function amountToWords(amount: number, currency: string) {
  const whole = Math.floor(amount)
  const fraction = Math.round((amount - whole) * 100)
  const majorUnit = currency === 'INR' ? 'rupees' : currency.toLowerCase()
  const minorUnit = currency === 'INR' ? 'paise' : 'cents'

  let result = `${capitalize(numberToWords(whole))} ${majorUnit}`

  if (fraction > 0) {
    result += ` and ${numberToWords(fraction)} ${minorUnit}`
  }

  return `${result} only`
}