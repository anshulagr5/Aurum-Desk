import { nanoid } from 'nanoid'
import type { AppData, Sale } from './types'
import { toTitleCase } from './lib/text'

const STORAGE_KEY = 'aurum-jewellery-shop-data-v1'

export function createResetData(): AppData {
  return {
    shop: {
      shopName: '',
      address: '',
      phone: '',
      email: '',
      gstin: '',
      currency: 'INR',
      invoicePrefix: '',
      invoiceSequence: 0,
      defaultTaxRate: 3,
      invoiceTerms: '',
      invoiceLogoDataUrl: '',
      invoiceSaveDirectory: '',
    },
    products: [],
    customers: [],
    suppliers: [],
    purchases: [],
    sales: [],
    outstandings: [],
  }
}

export function createDefaultData(): AppData {
  return createResetData()
}

function normalizeAppData(value: Partial<AppData>): AppData {
  const defaults = createDefaultData()
  const emptyProduct = {
    id: '',
    hsn: '',
    name: '',
    category: '',
    purity: '',
    grossWeight: 0,
    stoneWeight: 0,
    stockQty: 0,
    location: '',
    isArchived: false,
  }
  const emptyCustomer = {
    id: '',
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    outstanding: 0,
    isArchived: false,
  }
  const emptySupplier = {
    id: '',
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    gstin: '',
    isArchived: false,
  }
  const rawShop = value.shop ?? {}
  const shop = {
    ...(rawShop as Partial<AppData['shop']> & { defaultMakingChargeRate?: number }),
  }

  delete shop.defaultMakingChargeRate

  const customers = (value.customers ?? []).map((customer) => {
    const normalizedCustomer = {
      ...emptyCustomer,
      ...customer,
      name: customer.name ? toTitleCase(customer.name) : '',
      city: customer.city ? toTitleCase(customer.city) : '',
      address: customer.address ? toTitleCase(customer.address) : '',
      isArchived: Boolean(customer.isArchived ?? false),
    } as typeof emptyCustomer & { tier?: string }

    delete normalizedCustomer.tier
    return normalizedCustomer
  })

  const customerMap = new Map(customers.map((customer) => [customer.id, customer]))

  const suppliers = (value.suppliers ?? []).map((supplier) => {
    const normalizedSupplier = {
      ...emptySupplier,
      ...supplier,
      name: supplier.name ? toTitleCase(supplier.name) : '',
      city: supplier.city ? toTitleCase(supplier.city) : '',
      address: supplier.address ? toTitleCase(supplier.address) : '',
      isArchived: Boolean(supplier.isArchived ?? false),
    } as typeof emptySupplier & { specialty?: string }

    delete normalizedSupplier.specialty
    return normalizedSupplier
  })

  const normalizedPurchases = (value.purchases ?? []).map((purchase) => ({
    ...purchase,
    makingCharge: purchase.makingCharge ?? 0,
    totalWeight: purchase.totalWeight ?? 0,
    totalCost: purchase.totalCost ?? (purchase.totalWeight ?? 0) * (purchase.unitCost + (purchase.makingCharge ?? 0)),
    paidAmount: purchase.paidAmount ?? purchase.totalCost ?? 0,
  }))

  const normalizedSales = (value.sales ?? []).map((sale) => {
    const normalizedSale = {
      ...(sale as Sale & { makingCharges?: number; separateRateAndMakingCharge?: boolean; taxRate?: number }),
    }

    const customer = customerMap.get(sale.customerId)

    delete normalizedSale.makingCharges

    return {
      ...normalizedSale,
      customerName: sale.customerName ? toTitleCase(sale.customerName) : '',
      customerPhone: sale.customerPhone ?? customer?.phone ?? '',
      customerAddress: sale.customerAddress ? toTitleCase(sale.customerAddress) : customer?.address ?? '',
      taxRate: sale.taxRate ?? shop.defaultTaxRate ?? 3,
      separateRateAndMakingCharge: sale.separateRateAndMakingCharge ?? false,
      items: (sale.items ?? []).map((item) => {
        const normalizedItem = {
          ...(item as Sale['items'][number] & { sku?: string; makingCharge?: number }),
        }

        normalizedItem.hsn = normalizedItem.hsn ?? normalizedItem.sku ?? ''

        delete normalizedItem.sku

        return {
          ...normalizedItem,
          productName: normalizedItem.productName ? toTitleCase(normalizedItem.productName) : '',
          makingCharge: normalizedItem.makingCharge ?? 0,
          stoneWeight: normalizedItem.stoneWeight ?? 0,
          otherCharges: normalizedItem.otherCharges ?? 0,
          totalWeight: item.totalWeight ?? item.grossWeight * item.quantity,
          grossWeight: item.grossWeight ?? (item.totalWeight ? item.totalWeight / Math.max(item.quantity, 1) : 0),
        }
      }),
    }
  })

  const derivedStockByProduct = new Map<string, number>()
  normalizedPurchases.forEach((purchase) => {
    derivedStockByProduct.set(purchase.productId, (derivedStockByProduct.get(purchase.productId) ?? 0) + purchase.totalWeight)
  })
  normalizedSales
    .flatMap((sale) => sale.items)
    .forEach((item) => {
      derivedStockByProduct.set(item.productId, (derivedStockByProduct.get(item.productId) ?? 0) - item.totalWeight)
    })

  const normalizedOutstandings = (value.outstandings ?? []).map((entry) => {
    // Migrate old format (settlementDate string) to new settlements array
    const rawSettlements = (entry as typeof entry & { settlementDate?: string; settlements?: Array<{ amount: number; date: string }> }).settlements
    const settlementDate = (entry as typeof entry & { settlementDate?: string }).settlementDate

    let settlements: Array<{ amount: number; date: string }> = []
    if (rawSettlements && Array.isArray(rawSettlements)) {
      settlements = rawSettlements.map((s) => ({ amount: Number(s.amount ?? 0), date: String(s.date ?? '') }))
    } else if (settlementDate && entry.status === 'settled') {
      settlements = [{ amount: Number(entry.balanceAmount ?? 0), date: settlementDate }]
    }

    const paidAmount = Number((entry as typeof entry & { paidAmount?: number }).paidAmount ?? settlements.reduce((sum, s) => sum + s.amount, 0))

    return {
      id: entry.id ?? nanoid(),
      saleId: entry.saleId ?? '',
      invoiceNumber: entry.invoiceNumber ?? '',
      date: entry.date ?? '',
      customerId: entry.customerId ?? '',
      customerName: entry.customerName ? toTitleCase(entry.customerName) : '',
      balanceAmount: Number(entry.balanceAmount ?? 0),
      paidAmount,
      status: (entry.status === 'settled' ? 'settled' : 'pending') as 'pending' | 'settled',
      settlements,
    }
  })

  // Derive outstandings from existing sales if none exist (migration)
  const derivedOutstandings = normalizedOutstandings.length > 0
    ? normalizedOutstandings
    : normalizedSales
        .filter((sale) => sale.balanceAmount > 0)
        .map((sale) => ({
          id: nanoid(),
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          date: sale.date,
          customerId: sale.customerId,
          customerName: sale.customerName,
          balanceAmount: sale.balanceAmount,
          paidAmount: 0,
          status: 'pending' as const,
          settlements: [] as Array<{ amount: number; date: string }>,
        }))

  return {
    shop: {
      ...defaults.shop,
      ...shop,
      shopName: shop.shopName ? toTitleCase(shop.shopName) : '',
      address: shop.address ? toTitleCase(shop.address) : '',
      invoiceLogoDataUrl: shop.invoiceLogoDataUrl ?? '',
      invoiceSaveDirectory: typeof shop.invoiceSaveDirectory === 'string' ? shop.invoiceSaveDirectory.trim() : '',
    },
    products: (value.products ?? []).map((product) => {
      const fallback = emptyProduct
      const normalizedProduct = {
        ...(product as typeof fallback & {
        sku?: string
        purchaseRate?: number
        saleRate?: number
        makingCharge?: number
        }),
      }

      normalizedProduct.hsn = normalizedProduct.hsn ?? normalizedProduct.sku ?? fallback.hsn

      delete normalizedProduct.sku
      delete normalizedProduct.purchaseRate
      delete normalizedProduct.saleRate
      delete normalizedProduct.makingCharge

      return {
        ...fallback,
        ...normalizedProduct,
        name: normalizedProduct.name ? toTitleCase(normalizedProduct.name) : '',
        category: normalizedProduct.category ? toTitleCase(normalizedProduct.category) : '',
        location: normalizedProduct.location ? toTitleCase(normalizedProduct.location) : '',
        stockQty: Math.max(derivedStockByProduct.get(normalizedProduct.id ?? fallback.id) ?? normalizedProduct.stockQty ?? fallback.stockQty, 0),
        isArchived: Boolean(normalizedProduct.isArchived ?? false),
      }
    }),
    customers,
    suppliers,
    purchases: normalizedPurchases,
    sales: normalizedSales,
    outstandings: derivedOutstandings,
  }
}

function getDesktopDataApi() {
  return window.aurumDesktop?.data
}

async function loadFromLocalStorage() {
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    const seeded = createDefaultData()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
    return seeded
  }

  try {
    return normalizeAppData(JSON.parse(raw) as Partial<AppData>)
  } catch {
    const fallback = createDefaultData()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback))
    return fallback
  }
}

export async function loadAppData(): Promise<AppData> {
  const desktopDataApi = getDesktopDataApi()

  if (!desktopDataApi) {
    return loadFromLocalStorage()
  }

  const stored = await desktopDataApi.load()
  if (stored) {
    return normalizeAppData(stored)
  }

  const seeded = createDefaultData()
  await desktopDataApi.save(seeded)
  return seeded
}

export async function saveAppData(data: AppData) {
  const desktopDataApi = getDesktopDataApi()

  if (desktopDataApi) {
    await desktopDataApi.save(data)
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export async function resetAppData() {
  const seeded = createResetData()
  await saveAppData(seeded)
  return seeded
}

export function exportAppData(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  anchor.href = url
  anchor.download = `aurum-backup-${stamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function importAppData(file: File) {
  const text = await file.text()
  const parsed = JSON.parse(text) as Partial<AppData>
  const normalized = normalizeAppData(parsed)
  await saveAppData(normalized)
  return normalized
}
