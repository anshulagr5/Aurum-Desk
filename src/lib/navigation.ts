import type { ViewId } from '../types'

export const views: Array<{ id: ViewId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'suppliers', label: 'Vendors' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'sales', label: 'Orders & Billing' },
  { id: 'issued-invoices', label: 'Issued Invoices' },
  { id: 'outstandings', label: 'Outstandings' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
]

const viewIds = new Set<ViewId>(views.map((view) => view.id))

export function getViewRoute(viewId: ViewId) {
  return `#/${viewId}`
}

export function getViewFromHash(hash: string): ViewId {
  const candidate = hash.replace(/^#\/?/, '')
  return viewIds.has(candidate as ViewId) ? (candidate as ViewId) : 'sales'
}
