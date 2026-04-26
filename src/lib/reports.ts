import dayjs from 'dayjs'
import type { AppData } from '../types'

export interface ReportRange {
  startDate: string
  endDate: string
}

function isWithinRange(date: string, range: ReportRange) {
  const value = dayjs(date)
  const start = dayjs(range.startDate)
  const end = dayjs(range.endDate)

  return !value.isBefore(start, 'day') && !value.isAfter(end, 'day')
}

export function buildReportSnapshot(data: AppData, range: ReportRange) {
  const recentSales = data.sales.filter((sale) => isWithinRange(sale.date, range))
  const recentPurchases = data.purchases.filter((purchase) => isWithinRange(purchase.date, range))

  const salesByProduct = recentSales
    .flatMap((sale) => sale.items)
    .reduce<Record<string, number>>((summary, item) => {
      summary[item.productName] = (summary[item.productName] ?? 0) + item.lineTotal
      return summary
    }, {})

  const totalSales = recentSales.reduce((sum, sale) => sum + sale.total, 0)
  const totalPurchases = recentPurchases.reduce((sum, purchase) => sum + purchase.totalCost, 0)

  const purchasedWeightByProduct = recentPurchases.reduce<Record<string, number>>((summary, purchase) => {
    summary[purchase.productName] = (summary[purchase.productName] ?? 0) + purchase.totalWeight
    return summary
  }, {})

  const soldWeightByProduct = recentSales
    .flatMap((sale) => sale.items)
    .reduce<Record<string, number>>((summary, item) => {
      summary[item.productName] = (summary[item.productName] ?? 0) + item.totalWeight
      return summary
    }, {})

  const stockWeight = Array.from(
    new Set([
      ...Object.keys(purchasedWeightByProduct),
      ...Object.keys(soldWeightByProduct),
    ]),
  ).reduce((sum, product) => sum + Math.max((purchasedWeightByProduct[product] ?? 0) - (soldWeightByProduct[product] ?? 0), 0), 0)

  const productWeightFlow = Array.from(
    new Set([
      ...Object.keys(purchasedWeightByProduct),
      ...Object.keys(soldWeightByProduct),
    ]),
  )
    .map((product) => ({
      product,
      purchasedWeight: purchasedWeightByProduct[product] ?? 0,
      soldWeight: soldWeightByProduct[product] ?? 0,
    }))
    .sort((left, right) => (right.purchasedWeight + right.soldWeight) - (left.purchasedWeight + left.soldWeight))

  return {
    range,
    totalSales,
    totalPurchases,
    grossMargin: totalSales - totalPurchases,
    openReceivables: data.customers.reduce((sum, customer) => sum + customer.outstanding, 0),
    stockWeight,
    productWeightFlow,
    salesByProduct: Object.entries(salesByProduct).sort((a, b) => b[1] - a[1]),
  }
}