import { useDeferredValue, useMemo, useState } from 'react'
import { DeleteIcon, EditIcon } from '../../components/ui/ActionIcons'
import { createSupplierDraft } from '../../hooks/useShopData'
import type { AppData, SupplierFormInput } from '../../types'

export function SuppliersView({
  data,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}: {
  data: AppData
  onAddSupplier: (input: SupplierFormInput) => boolean
  onUpdateSupplier: (supplierId: string, input: SupplierFormInput) => boolean
  onDeleteSupplier: (supplierId: string) => boolean
}) {
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<SupplierFormInput>(() => createSupplierDraft())
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  const filteredSuppliers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) {
      return data.suppliers
    }

    return data.suppliers.filter((supplier) =>
      [supplier.name, supplier.phone, supplier.email, supplier.city, supplier.gstin]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [data.suppliers, deferredSearch])

  function updateForm(field: keyof SupplierFormInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function submitSupplier() {
    const ok = editingSupplierId
      ? onUpdateSupplier(editingSupplierId, form)
      : onAddSupplier(form)

    if (ok) {
      setForm(createSupplierDraft())
      setEditingSupplierId(null)
    }
  }

  function beginEdit(supplierId: string) {
    const supplier = data.suppliers.find((entry) => entry.id === supplierId)
    if (!supplier) {
      return
    }

    setForm({
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      city: supplier.city,
      address: supplier.address,
      gstin: supplier.gstin,
    })
    setEditingSupplierId(supplierId)
  }

  function cancelEdit() {
    setForm(createSupplierDraft())
    setEditingSupplierId(null)
  }

  function deleteSupplier(supplierId: string, supplierName: string) {
    if (!window.confirm(`Delete vendor ${supplierName}?`)) {
      return
    }

    const ok = onDeleteSupplier(supplierId)
    if (ok && editingSupplierId === supplierId) {
      cancelEdit()
    }
  }

  return (
    <section className="panel-grid two-col-wide">
      <article className="panel form-panel">
        <div className="panel-heading">
          <h3>{editingSupplierId ? 'Edit vendor' : 'Add vendor'}</h3>
        </div>
        <div className="form-grid compact-grid">
          <label><span>Name</span><input placeholder="Enter supplier name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} /></label>
          <label><span>Phone</span><input placeholder="Enter phone number" value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} /></label>
          <label><span>Email</span><input placeholder="Enter email address" value={form.email} onChange={(event) => updateForm('email', event.target.value)} /></label>
          <label><span>City</span><input placeholder="Enter city" value={form.city} onChange={(event) => updateForm('city', event.target.value)} /></label>
          <label><span>GSTIN</span><input placeholder="Enter GSTIN" value={form.gstin} onChange={(event) => updateForm('gstin', event.target.value)} /></label>
          <label className="span-two"><span>Address</span><textarea placeholder="Enter address" value={form.address} onChange={(event) => updateForm('address', event.target.value)} /></label>
        </div>
        <div className="action-row">
          <button className="primary-button" onClick={submitSupplier}>{editingSupplierId ? 'Update vendor' : 'Save vendor'}</button>
          {editingSupplierId && <button className="ghost-button" onClick={cancelEdit}>Cancel</button>}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <h3>Vendor directory</h3>
          <input className="search-input" placeholder="Search vendor, GSTIN or city" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="list-stack tall-list">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="list-row card-row">
              <div>
                <strong>{supplier.name}{supplier.isArchived ? ' (Archived)' : ''}</strong>
                <p>{supplier.city} · {supplier.phone}</p>
              </div>
              <div className="hero-actions">
                <span>{supplier.gstin || 'GST pending'}</span>
                <button className="ghost-button icon-button-shell" onClick={() => beginEdit(supplier.id)} aria-label="Edit vendor" title="Edit vendor">
                  <EditIcon />
                </button>
                <button className="ghost-button danger-button icon-button-shell" onClick={() => deleteSupplier(supplier.id, supplier.name)} aria-label="Delete vendor" title="Delete vendor">
                  <DeleteIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}