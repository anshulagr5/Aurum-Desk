export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Mixed'

export interface ShopProfile {
  shopName: string
  address: string
  phone: string
  email: string
  gstin: string
  currency: string
  invoicePrefix: string
  invoiceSequence: number
  defaultTaxRate: number
  invoiceTerms: string
  invoiceLogoDataUrl: string
  invoiceSaveDirectory: string
}

export interface Product {
  id: string
  hsn: string
  name: string
  category: string
  purity: string
  grossWeight: number
  stoneWeight: number
  stockQty: number
  location: string
  isArchived: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  city: string
  address: string
  outstanding: number
  isArchived: boolean
}

export interface Supplier {
  id: string
  name: string
  phone: string
  email: string
  city: string
  address: string
  gstin: string
  isArchived: boolean
}

export interface Purchase {
  id: string
  billNumber: string
  date: string
  supplierId: string
  supplierName: string
  productId: string
  productName: string
  unitCost: number
  makingCharge: number
  totalWeight: number
  totalCost: number
  paidAmount: number
  notes: string
}

export interface SaleItem {
  productId: string
  productName: string
  hsn: string
  quantity: number
  grossWeight: number
  stoneWeight: number
  totalWeight: number
  unitPrice: number
  makingCharge: number
  otherCharges: number
  lineTotal: number
}

export interface Sale {
  id: string
  invoiceNumber: string
  date: string
  customerId: string
  customerName: string
  customerPhone: string
  customerAddress: string
  taxRate: number
  separateRateAndMakingCharge: boolean
  items: SaleItem[]
  subtotal: number
  discount: number
  taxAmount: number
  total: number
  paidAmount: number
  balanceAmount: number
  paymentMode: PaymentMode
  notes: string
}

export interface OutstandingSettlement {
  amount: number
  date: string
}

export interface OutstandingEntry {
  id: string
  saleId: string
  invoiceNumber: string
  date: string
  customerId: string
  customerName: string
  balanceAmount: number
  paidAmount: number
  status: 'pending' | 'settled'
  settlements: OutstandingSettlement[]
}

export interface AppData {
  shop: ShopProfile
  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  purchases: Purchase[]
  sales: Sale[]
  outstandings: OutstandingEntry[]
}

export type ViewId =
  | 'dashboard'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'sales'
  | 'issued-invoices'
  | 'outstandings'
  | 'reports'
  | 'settings'

export type ProductFormInput = Omit<Product, 'id' | 'isArchived'>

export type CustomerFormInput = Omit<Customer, 'id' | 'outstanding' | 'isArchived'>

export type SupplierFormInput = Omit<Supplier, 'id' | 'isArchived'>

export interface PurchaseDraft {
  supplierId: string
  productId: string
  unitCost: number
  makingCharge: number
  totalWeight: number
  totalCost: number
  paidAmount: number
  date: string
  billNumber: string
  notes: string
}

export interface SaleDraftItem {
  id: string
  productId: string
  quantity: number
  grossWeight: number
  stoneWeight: number
  totalWeight: number
  unitPrice: number
  makingCharge: number
  otherCharges: number
}

export interface SaleDraft {
  customerId: string
  saveCustomerDetails: boolean
  customerName: string
  customerPhone: string
  customerEmail: string
  editSaleId?: string
  customerCity: string
  customerAddress: string
  taxRate: number
  separateRateAndMakingCharge: boolean
  date: string
  paymentMode: PaymentMode
  discount: number
  paidAmount: number
  notes: string
  items: SaleDraftItem[]
}

export interface SalePreviewItem {
  draftItemId: string
  product: Product
  quantity: number
  grossWeight: number
  stoneWeight: number
  totalWeight: number
  unitPrice: number
  makingCharge: number
  otherCharges: number
  lineTotal: number
}
