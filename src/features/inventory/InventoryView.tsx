import { useDeferredValue, useMemo, useState } from "react";
import { DeleteIcon, EditIcon } from "../../components/ui/ActionIcons";
import { createProductDraft } from "../../hooks/useShopData";
import { formatWeight } from "../../lib/format";
import type { AppData, ProductFormInput } from "../../types";

export function InventoryView({
  data,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}: {
  data: AppData;
  onAddProduct: (input: ProductFormInput) => boolean;
  onUpdateProduct: (productId: string, input: ProductFormInput) => boolean;
  onDeleteProduct: (productId: string) => boolean;
}) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ProductFormInput>(() =>
    createProductDraft(),
  );
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const filteredProducts = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return data.products;
    }

    return data.products.filter((product) =>
      [product.name, product.hsn, product.category, product.purity]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data.products, deferredSearch]);

  const availableWeightMap = useMemo(() => {
    const weights = new Map<string, number>();

    data.purchases.forEach((purchase) => {
      weights.set(
        purchase.productId,
        (weights.get(purchase.productId) ?? 0) + purchase.totalWeight,
      );
    });

    data.sales
      .flatMap((sale) => sale.items)
      .forEach((item) => {
        weights.set(
          item.productId,
          (weights.get(item.productId) ?? 0) - item.totalWeight,
        );
      });

    return weights;
  }, [data.purchases, data.sales]);

  function updateForm(field: keyof ProductFormInput, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submitProduct() {
    const nextForm = {
      ...form,
      category: "",
      purity: "",
    };

    const ok = editingProductId
      ? onUpdateProduct(editingProductId, nextForm)
      : onAddProduct(nextForm);

    if (ok) {
      setForm(createProductDraft());
      setEditingProductId(null);
    }
  }

  function beginEdit(productId: string) {
    const product = data.products.find((entry) => entry.id === productId);
    if (!product) {
      return;
    }

    setForm({
      hsn: product.hsn,
      name: product.name,
      category: "",
      purity: "",
      grossWeight: 0,
      stoneWeight: 0,
      stockQty: product.stockQty,
      location: "",
    });
    setEditingProductId(productId);
  }

  function cancelEdit() {
    setForm(createProductDraft());
    setEditingProductId(null);
  }

  function deleteProduct(productId: string, productName: string) {
    if (!window.confirm(`Delete product ${productName}?`)) {
      return;
    }

    const ok = onDeleteProduct(productId);
    if (ok && editingProductId === productId) {
      cancelEdit();
    }
  }

  return (
    <section className="panel-grid two-col-wide">
      <article className="panel form-panel">
        <div className="panel-heading">
          <h3>{editingProductId ? "Edit product" : "Add product"}</h3>
        </div>
        <div className="form-grid">
          <label>
            <span>HSN</span>
            <input
              placeholder="Enter HSN"
              value={form.hsn}
              onChange={(event) => updateForm("hsn", event.target.value)}
            />
          </label>
          <label>
            <span>Product name</span>
            <input
              placeholder="Enter product name"
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
            />
          </label>
        </div>
        <div className="action-row">
          <button className="primary-button" onClick={submitProduct}>
            {editingProductId ? "Update product" : "Save product"}
          </button>
          {editingProductId && (
            <button className="ghost-button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <h3>Product catalogue</h3>
          <input
            className="search-input"
            placeholder="Search Product"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="table-wrap tall">
          <table>
            <thead>
              <tr>
                <th>HSN</th>
                <th>Product</th>
                <th>Stock</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>{product.hsn}</td>
                  <td>
                    {product.name}
                    {product.isArchived ? " (Archived)" : ""}
                  </td>
                  <td>
                    {formatWeight(
                      Math.max(availableWeightMap.get(product.id) ?? 0, 0),
                    )}
                  </td>
                  <td>
                    <div className="hero-actions">
                      <button
                        className="ghost-button icon-button-shell"
                        onClick={() => beginEdit(product.id)}
                        aria-label="Edit product"
                        title="Edit product"
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="ghost-button danger-button icon-button-shell"
                        onClick={() => deleteProduct(product.id, product.name)}
                        aria-label="Delete product"
                        title="Delete product"
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
