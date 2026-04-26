import { useDeferredValue, useMemo, useState } from "react";
import { DeleteIcon, EditIcon } from "../../components/ui/ActionIcons";
import { createCustomerDraft } from "../../hooks/useShopData";
import { formatMoney } from "../../lib/format";
import type { AppData, CustomerFormInput } from "../../types";

export function CustomersView({
  data,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
}: {
  data: AppData;
  onAddCustomer: (input: CustomerFormInput) => boolean;
  onUpdateCustomer: (customerId: string, input: CustomerFormInput) => boolean;
  onDeleteCustomer: (customerId: string) => boolean;
}) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<CustomerFormInput>(() =>
    createCustomerDraft(),
  );
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null,
  );
  const deferredSearch = useDeferredValue(search);

  const filteredCustomers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return data.customers;
    }

    return data.customers.filter((customer) =>
      [customer.name, customer.phone, customer.city]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data.customers, deferredSearch]);

  function updateForm(field: keyof CustomerFormInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submitCustomer() {
    const ok = editingCustomerId
      ? onUpdateCustomer(editingCustomerId, form)
      : onAddCustomer(form);

    if (ok) {
      setForm(createCustomerDraft());
      setEditingCustomerId(null);
    }
  }

  function beginEdit(customerId: string) {
    const customer = data.customers.find((entry) => entry.id === customerId);
    if (!customer) {
      return;
    }

    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      city: customer.city,
      address: customer.address,
    });
    setEditingCustomerId(customerId);
  }

  function cancelEdit() {
    setForm(createCustomerDraft());
    setEditingCustomerId(null);
  }

  function deleteCustomer(customerId: string, customerName: string) {
    if (!window.confirm(`Delete customer ${customerName}?`)) {
      return;
    }

    const ok = onDeleteCustomer(customerId);
    if (ok && editingCustomerId === customerId) {
      cancelEdit();
    }
  }

  return (
    <section className="panel-grid two-col-wide">
      <article className="panel form-panel">
        <div className="panel-heading">
          <h3>{editingCustomerId ? "Edit customer" : "Add customer"}</h3>
        </div>
        <div className="form-grid compact-grid">
          <label>
            <span>Name</span>
            <input
              placeholder="Enter customer name"
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
            />
          </label>
          <label>
            <span>Phone</span>
            <input
              placeholder="Enter phone number"
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value)}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              placeholder="Enter email address"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
            />
          </label>
          <label>
            <span>City</span>
            <input
              placeholder="Enter city"
              value={form.city}
              onChange={(event) => updateForm("city", event.target.value)}
            />
          </label>
          <label className="span-two">
            <span>Address</span>
            <textarea
              placeholder="Enter address"
              value={form.address}
              onChange={(event) => updateForm("address", event.target.value)}
            />
          </label>
        </div>
        <div className="action-row">
          <button className="primary-button" onClick={submitCustomer}>
            {editingCustomerId ? "Update customer" : "Save customer"}
          </button>
          {editingCustomerId && (
            <button className="ghost-button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <h3>Customer ledger</h3>
          <input
            className="search-input"
            placeholder="Search name, phone or city"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="table-wrap tall">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>City</th>
                <th>Outstanding</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    {customer.name}
                    {customer.isArchived ? " (Archived)" : ""}
                  </td>
                  <td>{customer.phone}</td>
                  <td>{customer.city}</td>
                  <td>
                    {formatMoney(customer.outstanding, data.shop.currency)}
                  </td>
                  <td>
                    <div className="hero-actions">
                      <button
                        className="ghost-button icon-button-shell"
                        onClick={() => beginEdit(customer.id)}
                        aria-label="Edit customer"
                        title="Edit customer"
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="ghost-button danger-button icon-button-shell"
                        onClick={() =>
                          deleteCustomer(customer.id, customer.name)
                        }
                        aria-label="Delete customer"
                        title="Delete customer"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
