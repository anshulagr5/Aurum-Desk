import { useDeferredValue, useMemo, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { DeleteIcon, EditIcon } from "../../components/ui/ActionIcons";
import { createPurchaseDraft } from "../../hooks/useShopData";
import { formatMoney, formatWeight } from "../../lib/format";
import type { AppData, Purchase, PurchaseDraft } from "../../types";

function numberInputValue(value: number) {
  return value === 0 ? "" : value;
}

function parseNumberInput(value: string) {
  return value === "" ? 0 : Number(value);
}

function clampPaidAmount(value: number, totalAmount: number) {
  return Math.min(Math.max(value, 0), totalAmount);
}

export function PurchasesView({
  data,
  onRecordPurchase,
  onUpdatePurchase,
  onDeletePurchase,
}: {
  data: AppData;
  onRecordPurchase: (draft: PurchaseDraft) => boolean;
  onUpdatePurchase: (purchaseId: string, draft: PurchaseDraft) => boolean;
  onDeletePurchase: (purchaseId: string) => boolean;
}) {
  const [draft, setDraft] = useState<PurchaseDraft>(() =>
    createPurchaseDraft(),
  );
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [paidAmountWarning, setPaidAmountWarning] = useState("");
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filteredPurchases = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return data.purchases;
    }
    return data.purchases.filter((purchase) =>
      [
        purchase.billNumber,
        purchase.supplierName,
        purchase.productName,
        purchase.date,
        purchase.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data.purchases, deferredSearch]);
  const availableSuppliers = useMemo(
    () =>
      data.suppliers.filter(
        (supplier) => !supplier.isArchived || supplier.id === draft.supplierId,
      ),
    [data.suppliers, draft.supplierId],
  );
  const availableProducts = useMemo(
    () =>
      data.products.filter(
        (product) => !product.isArchived || product.id === draft.productId,
      ),
    [data.products, draft.productId],
  );
  const calculatedAmount = useMemo(() => {
    return draft.totalWeight * (draft.unitCost + draft.makingCharge);
  }, [draft.makingCharge, draft.totalWeight, draft.unitCost]);
  const hasExplicitPaidAmount = paidAmountInput.trim() !== "";
  const safePaidAmount = clampPaidAmount(
    hasExplicitPaidAmount
      ? parseNumberInput(paidAmountInput)
      : draft.paidAmount,
    calculatedAmount,
  );
  const balanceAmount = Math.max(calculatedAmount - safePaidAmount, 0);

  function updateDraft(field: keyof PurchaseDraft, value: string | number) {
    if (field === "paidAmount") {
      const rawValue = typeof value === "number" ? String(value) : value;
      const attemptedPaidAmount = parseNumberInput(rawValue);
      const nextPaidAmount = clampPaidAmount(
        attemptedPaidAmount,
        calculatedAmount,
      );

      setPaidAmountInput(nextPaidAmount === 0 ? "" : String(nextPaidAmount));
      setPaidAmountWarning(
        attemptedPaidAmount > calculatedAmount
          ? "Paid amount cannot be greater than the total amount."
          : "",
      );
      setDraft((current) => ({
        ...current,
        paidAmount: nextPaidAmount,
      }));
      return;
    }

    setDraft((current) => {
      const nextDraft = { ...current, [field]: value };
      const nextCalculatedAmount =
        nextDraft.totalWeight * (nextDraft.unitCost + nextDraft.makingCharge);
      const nextPaidAmount = clampPaidAmount(
        nextDraft.paidAmount,
        nextCalculatedAmount,
      );

      setPaidAmountInput(nextPaidAmount === 0 ? "" : String(nextPaidAmount));
      setPaidAmountWarning(
        nextDraft.paidAmount > nextCalculatedAmount
          ? "Paid amount cannot be greater than the total amount."
          : "",
      );

      return {
        ...nextDraft,
        paidAmount: nextPaidAmount,
      };
    });
  }

  function submitPurchase() {
    const submittedPaidAmount = hasExplicitPaidAmount
      ? safePaidAmount
      : calculatedAmount;
    const payload = {
      ...draft,
      totalCost: calculatedAmount,
      paidAmount: submittedPaidAmount,
    };
    const ok = editingPurchaseId
      ? onUpdatePurchase(editingPurchaseId, payload)
      : onRecordPurchase(payload);

    if (ok) {
      setDraft(createPurchaseDraft());
      setPaidAmountInput("");
      setPaidAmountWarning("");
      setEditingPurchaseId(null);
    }
  }

  function beginEdit(purchase: Purchase) {
    setDraft({
      supplierId: purchase.supplierId,
      productId: purchase.productId,
      unitCost: purchase.unitCost,
      makingCharge: purchase.makingCharge,
      totalWeight: purchase.totalWeight,
      totalCost: purchase.totalCost,
      paidAmount: purchase.paidAmount,
      date: purchase.date,
      billNumber: purchase.billNumber,
      notes: purchase.notes,
    });
    setPaidAmountInput(String(purchase.paidAmount));
    setPaidAmountWarning("");
    setEditingPurchaseId(purchase.id);
  }

  function cancelEdit() {
    setDraft(createPurchaseDraft());
    setPaidAmountInput("");
    setPaidAmountWarning("");
    setEditingPurchaseId(null);
  }

  function deletePurchase(purchase: Purchase) {
    if (!window.confirm(`Delete purchase ${purchase.billNumber}?`)) {
      return;
    }

    const ok = onDeletePurchase(purchase.id);
    if (ok && editingPurchaseId === purchase.id) {
      cancelEdit();
    }
  }

  return (
    <section className="panel-grid two-col-wide">
      <article className="panel form-panel">
        <div className="panel-heading">
          <h3>{editingPurchaseId ? "Edit purchase" : "Record purchase"}</h3>
        </div>
        <div className="form-grid compact-grid">
          <label>
            <span>Bill number</span>
            <input
              placeholder="Enter bill number"
              value={draft.billNumber}
              onChange={(event) =>
                updateDraft("billNumber", event.target.value)
              }
            />
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={draft.date}
              onChange={(event) => updateDraft("date", event.target.value)}
            />
          </label>
          <label>
            <span>Vendor</span>
            <Autocomplete
              fullWidth
              size="small"
              options={availableSuppliers}
              getOptionLabel={(supplier) => `${supplier.name}${supplier.isArchived ? " (Archived)" : ""}`}
              value={availableSuppliers.find((s) => s.id === draft.supplierId) || null}
              onChange={(_event, newValue) => updateDraft("supplierId", newValue?.id || "")}
              renderInput={(params) => <TextField {...params} label="Vendor" size="small" />}
            />
          </label>
          <label>
            <span>Product</span>
            <Autocomplete
              fullWidth
              size="small"
              options={availableProducts}
              getOptionLabel={(product) => `${product.name}${product.isArchived ? " (Archived)" : ""}`}
              value={availableProducts.find((p) => p.id === draft.productId) || null}
              onChange={(_event, newValue) => updateDraft("productId", newValue?.id || "")}
              renderInput={(params) => <TextField {...params} label="Product" size="small" />}
            />
          </label>
          <label>
            <span>Product rate</span>
            <input
              type="number"
              placeholder="Enter rate"
              value={numberInputValue(draft.unitCost)}
              onWheel={(event) => event.currentTarget.blur()}
              onChange={(event) =>
                updateDraft("unitCost", parseNumberInput(event.target.value))
              }
            />
          </label>
          <label>
            <span>Making charge</span>
            <input
              type="number"
              placeholder="Enter making charge"
              value={numberInputValue(draft.makingCharge)}
              onWheel={(event) => event.currentTarget.blur()}
              onChange={(event) =>
                updateDraft(
                  "makingCharge",
                  parseNumberInput(event.target.value),
                )
              }
            />
          </label>
          <label>
            <span>Weight</span>
            <input
              type="number"
              step="0.01"
              placeholder="Enter weight"
              value={numberInputValue(draft.totalWeight)}
              onWheel={(event) => event.currentTarget.blur()}
              onChange={(event) =>
                updateDraft("totalWeight", parseNumberInput(event.target.value))
              }
            />
          </label>
          <label>
            <span>Paid amount</span>
            <input
              type="number"
              min="0"
              max={calculatedAmount}
              placeholder="Enter paid amount"
              value={paidAmountInput}
              onWheel={(event) => event.currentTarget.blur()}
              onChange={(event) =>
                updateDraft("paidAmount", event.target.value)
              }
            />
            {paidAmountWarning && (
              <small className="field-note">{paidAmountWarning}</small>
            )}
          </label>
          <div className="purchase-totals span-two">
            <div className="purchase-total-card">
              <span>Total amount</span>
              <strong>
                {formatMoney(calculatedAmount, data.shop.currency)}
              </strong>
            </div>
            <div className="purchase-total-card accent">
              <span>Balance</span>
              <strong>{formatMoney(balanceAmount, data.shop.currency)}</strong>
            </div>
          </div>
          <label className="span-two">
            <span>Notes</span>
            <textarea
              placeholder="Enter notes"
              value={draft.notes}
              onChange={(event) => updateDraft("notes", event.target.value)}
            />
          </label>
        </div>
        <div className="action-row">
          <button className="primary-button" onClick={submitPurchase}>
            {editingPurchaseId
              ? "Update purchase entry"
              : "Post purchase entry"}
          </button>
          {editingPurchaseId && (
            <button className="ghost-button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <h3>Purchase history</h3>
          <input
            className="search-input"
            placeholder="Search bill, vendor or product"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span>{filteredPurchases.length} entries</span>
        </div>
        <div className="table-wrap tall">
          <table className="purchase-history-table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Product</th>
                <th>Weight</th>
                <th>Pricing</th>
                <th>Amounts</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{purchase.billNumber}</td>
                  <td>{purchase.date}</td>
                  <td>{purchase.supplierName}</td>
                  <td>{purchase.productName}</td>
                  <td>{formatWeight(purchase.totalWeight)}</td>
                  <td>
                    <div className="cell-stack compact-money-cell">
                      <span>Rate</span>
                      <strong>
                        {formatMoney(purchase.unitCost, data.shop.currency)}
                      </strong>
                      <span>Making</span>
                      <strong>
                        {formatMoney(purchase.makingCharge, data.shop.currency)}
                      </strong>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack compact-money-cell">
                      <span>Total</span>
                      <strong>
                        {formatMoney(purchase.totalCost, data.shop.currency)}
                      </strong>
                      <span>Paid</span>
                      <strong>
                        {formatMoney(purchase.paidAmount, data.shop.currency)}
                      </strong>
                      <span>Balance</span>
                      <strong>
                        {formatMoney(
                          Math.max(purchase.totalCost - purchase.paidAmount, 0),
                          data.shop.currency,
                        )}
                      </strong>
                    </div>
                  </td>
                  <td>
                    <div className="purchase-history-actions">
                      <button
                        className="ghost-button icon-button-shell"
                        onClick={() => beginEdit(purchase)}
                        aria-label="Edit purchase"
                        title="Edit purchase"
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="ghost-button danger-button icon-button-shell"
                        onClick={() => deletePurchase(purchase)}
                        aria-label="Delete purchase"
                        title="Delete purchase"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    {data.purchases.length === 0
                      ? "No purchases recorded yet."
                      : "No matching purchases."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
