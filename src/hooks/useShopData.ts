import { startTransition, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { generateInvoicePdf } from "../invoice";
import {
  createResetData,
  exportAppData,
  importAppData,
  loadAppData,
  resetAppData,
  saveAppData,
} from "../storage";
import { formatMoney } from "../lib/format";
import { toTitleCase } from "../lib/text";
import type {
  AppData,
  Customer,
  CustomerFormInput,
  OutstandingEntry,
  Product,
  ProductFormInput,
  Purchase,
  PurchaseDraft,
  Sale,
  SaleDraft,
  SaleDraftItem,
  SaleItem,
  SalePreviewItem,
  Supplier,
  SupplierFormInput,
} from "../types";

export function createProductDraft(): ProductFormInput {
  return {
    hsn: "",
    name: "",
    category: "",
    purity: "",
    grossWeight: 0,
    stoneWeight: 0,
    stockQty: 0,
    location: "",
  };
}

export function createCustomerDraft(): CustomerFormInput {
  return {
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
  };
}

export function createSupplierDraft(): SupplierFormInput {
  return {
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    gstin: "",
  };
}

function normalizeProductInput(input: ProductFormInput): ProductFormInput {
  return {
    ...input,
    hsn: input.hsn.trim(),
    name: toTitleCase(input.name),
    category: toTitleCase(input.category),
    location: toTitleCase(input.location),
    purity: input.purity.trim(),
  };
}

function normalizeCustomerInput(input: CustomerFormInput): CustomerFormInput {
  return {
    ...input,
    name: toTitleCase(input.name),
    phone: input.phone.trim(),
    email: input.email.trim(),
    city: toTitleCase(input.city),
    address: toTitleCase(input.address),
  };
}

function normalizeSupplierInput(input: SupplierFormInput): SupplierFormInput {
  return {
    ...input,
    name: toTitleCase(input.name),
    phone: input.phone.trim(),
    email: input.email.trim(),
    city: toTitleCase(input.city),
    address: toTitleCase(input.address),
    gstin: input.gstin.trim(),
  };
}

function normalizeShopProfile(shop: AppData["shop"]): AppData["shop"] {
  return {
    ...shop,
    shopName: toTitleCase(shop.shopName),
    address: toTitleCase(shop.address),
    phone: shop.phone.trim(),
    email: shop.email.trim(),
    gstin: shop.gstin.trim(),
    currency: shop.currency.trim(),
    invoicePrefix: shop.invoicePrefix.trim(),
    invoiceSaveDirectory: shop.invoiceSaveDirectory.trim(),
  };
}

export function createPurchaseDraft(): PurchaseDraft {
  return {
    supplierId: "",
    productId: "",
    unitCost: 0,
    makingCharge: 0,
    totalWeight: 0,
    totalCost: 0,
    paidAmount: 0,
    date: dayjs().format("YYYY-MM-DD"),
    billNumber: "",
    notes: "",
  };
}

function getLatestPurchaseMap(purchases: Purchase[]) {
  const latestPurchases = new Map<
    string,
    { date: string; index: number; unitCost: number; totalWeight: number }
  >();

  purchases.forEach((purchase, index) => {
    const current = latestPurchases.get(purchase.productId);

    if (
      !current ||
      purchase.date > current.date ||
      (purchase.date === current.date && index < current.index)
    ) {
      latestPurchases.set(purchase.productId, {
        date: purchase.date,
        index,
        unitCost: purchase.unitCost,
        totalWeight: purchase.totalWeight,
      });
    }
  });

  return latestPurchases;
}

function getAvailableWeightMap(purchases: Purchase[], sales: Sale[]) {
  const purchasedWeightByProduct = purchases.reduce<Map<string, number>>(
    (summary, purchase) => {
      summary.set(
        purchase.productId,
        (summary.get(purchase.productId) ?? 0) + purchase.totalWeight,
      );
      return summary;
    },
    new Map(),
  );

  sales
    .flatMap((sale) => sale.items)
    .forEach((item) => {
      purchasedWeightByProduct.set(
        item.productId,
        (purchasedWeightByProduct.get(item.productId) ?? 0) - item.totalWeight,
      );
    });

  return purchasedWeightByProduct;
}

export function createSaleDraft(): SaleDraft {
  return {
    customerId: "",
    saveCustomerDetails: false,
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerCity: "",
    customerAddress: "",
    taxRate: 3,
    separateRateAndMakingCharge: false,
    date: dayjs().format("YYYY-MM-DD"),
    paymentMode: "Cash",
    discount: 0,
    paidAmount: 0,
    notes: "",
    items: [
      {
        id: nanoid(),
        productId: "",
        quantity: 0,
        grossWeight: 0,
        stoneWeight: 0,
        totalWeight: 0,
        unitPrice: 0,
        makingCharge: 0,
        otherCharges: 0,
      },
    ],
  };
}

export function calculateSaleLineTotal(
  item: Pick<SaleDraftItem, "grossWeight" | "stoneWeight" | "unitPrice" | "makingCharge" | "otherCharges">,
  separateRateAndMakingCharge: boolean,
) {
  const grossWeight = Math.max(item.grossWeight, 0);
  const stoneWeight = Math.max(item.stoneWeight, 0);
  const netWeight = Math.max(grossWeight - stoneWeight, 0);
  const unitPrice = Math.max(item.unitPrice, 0);
  const makingCharge = separateRateAndMakingCharge
    ? Math.max(item.makingCharge, 0)
    : 0;
  const otherCharges = Math.max(item.otherCharges, 0);

  return netWeight * (unitPrice + makingCharge) + otherCharges;
}

export function calculateSalePreview(
  products: Product[],
  saleDraft: SaleDraft,
  taxRate: number,
) {
  const items = saleDraft.items
    .map((line) => {
      const product = products.find((entry) => entry.id === line.productId);
      if (!product) {
        return null;
      }

      const grossWeight = Math.max(line.grossWeight, 0);
      if (grossWeight <= 0) {
        return null;
      }

      const stoneWeight = Math.max(line.stoneWeight, 0);
      const netWeight = Math.max(grossWeight - stoneWeight, 0);
      const quantity = line.quantity > 0 ? line.quantity : 1;
      const unitPrice = Math.max(line.unitPrice, 0);
      const makingCharge = saleDraft.separateRateAndMakingCharge
        ? Math.max(line.makingCharge, 0)
        : 0;
      const otherCharges = Math.max(line.otherCharges, 0);

      return {
        draftItemId: line.id,
        product,
        quantity,
        grossWeight,
        stoneWeight,
        totalWeight: netWeight,
        unitPrice,
        makingCharge,
        otherCharges,
        lineTotal: calculateSaleLineTotal(
          line,
          saleDraft.separateRateAndMakingCharge,
        ),
      };
    })
    .filter((entry): entry is SalePreviewItem => entry !== null);

  const subtotal = items.reduce((sum, entry) => sum + entry.lineTotal, 0);
  const discount = Math.max(saleDraft.discount, 0);
  const taxable = Math.max(subtotal - discount, 0);
  const taxAmount = taxable * (taxRate / 100);
  const totalRaw = taxable + taxAmount;
  const total = Math.ceil(totalRaw);
  const paidAmount = Math.min(Math.max(saleDraft.paidAmount, 0), total);
  const balanceAmount = Math.max(total - paidAmount, 0);

  return {
    subtotal,
    discount,
    taxAmount,
    total,
    paidAmount,
    balanceAmount,
    validItems: items,
  };
}

export function useShopData() {
  const [data, setData] = useState<AppData>(() => createResetData());
  const [isReady, setIsReady] = useState(false);
  const [notice, setNotice] = useState(
    window.aurumDesktop?.isDesktop
      ? "Loading local SQLite database from this device."
      : "Offline mode active. All records are stored locally on this device.",
  );

  function deleteSale(saleId: string) {
    const sale = data.sales.find((s) => s.id === saleId);
    if (!sale) {
      setNotice("Invoice not found.");
      return false;
    }

    startTransition(() => {
      setData((current) => {
        const linkedOutstandings = current.outstandings.filter(
          (o) => o.saleId === saleId,
        );
        const outstandingReversal = linkedOutstandings.reduce(
          (sum, o) => (o.status === "pending" ? sum + o.balanceAmount : sum),
          0,
        );

        const updatedCustomers = current.customers.map((c) =>
          c.id === sale.customerId
            ? {
                ...c,
                outstanding: Math.max(
                  0,
                  c.outstanding - sale.balanceAmount + outstandingReversal,
                ),
              }
            : c,
        );

        return {
          ...current,
          sales: current.sales.filter((s) => s.id !== saleId),
          customers: updatedCustomers,
          outstandings: current.outstandings.filter((o) => o.saleId !== saleId),
        };
      });
      setNotice(`Invoice ${sale.invoiceNumber} deleted.`);
    });
    return true;
  }

  useEffect(() => {
    let active = true;

    void loadAppData()
      .then((loaded) => {
        if (!active) {
          return;
        }

        startTransition(() => {
          setData(loaded);
          setIsReady(true);
          setNotice(
            window.aurumDesktop?.isDesktop
              ? "Offline mode active. All records are stored in the local SQLite database on this device."
              : "Offline mode active. All records are stored locally on this device.",
          );
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setIsReady(true);
        setNotice(
          "Could not load stored business data. Using the current in-memory session.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    void saveAppData(data).catch(() => {
      setNotice(
        window.aurumDesktop?.isDesktop
          ? "Could not save changes to the local SQLite database."
          : "Could not save changes to local device storage.",
      );
    });
  }, [data, isReady]);

  const dashboardMetrics = useMemo(() => {
    const currentMonth = dayjs().format("YYYY-MM");
    const monthSales = data.sales
      .filter((sale) => sale.date.startsWith(currentMonth))
      .reduce((sum, sale) => sum + sale.total, 0);
    const monthPurchases = data.purchases
      .filter((purchase) => purchase.date.startsWith(currentMonth))
      .reduce((sum, purchase) => sum + purchase.totalCost, 0);
    const latestPurchases = getLatestPurchaseMap(data.purchases);
    const availableWeightMap = getAvailableWeightMap(
      data.purchases,
      data.sales,
    );
    const inventoryValue = data.products.reduce(
      (sum, product) =>
        sum +
        Math.max(availableWeightMap.get(product.id) ?? 0, 0) *
          (latestPurchases.get(product.id)?.unitCost ?? 0),
      0,
    );
    const stockWeight = Array.from(availableWeightMap.values()).reduce(
      (sum, weight) => sum + Math.max(weight, 0),
      0,
    );
    const receivables = data.customers.reduce(
      (sum, customer) => sum + customer.outstanding,
      0,
    );

    return {
      monthSales,
      monthPurchases,
      inventoryValue,
      stockWeight,
      receivables,
    };
  }, [data]);

  function addProduct(input: ProductFormInput) {
    const normalizedInput = normalizeProductInput(input);
    const product: Product = {
      id: nanoid(),
      ...normalizedInput,
      isArchived: false,
    };

    if (!product.name || !product.hsn) {
      setNotice(
        "Enter at least a product name and HSN before saving inventory.",
      );
      return false;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        products: [product, ...current.products],
      }));
      setNotice(`Product ${product.name} added to inventory.`);
    });

    return true;
  }

  function updateProduct(productId: string, input: ProductFormInput) {
    const normalizedInput = normalizeProductInput(input);

    if (!normalizedInput.name || !normalizedInput.hsn) {
      setNotice(
        "Enter at least a product name and HSN before saving inventory.",
      );
      return false;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        products: current.products.map((product) =>
          product.id === productId
            ? { ...product, ...normalizedInput }
            : product,
        ),
      }));
      setNotice(`Product ${normalizedInput.name} updated.`);
    });

    return true;
  }

  function deleteProduct(productId: string) {
    const product = data.products.find((entry) => entry.id === productId);

    if (!product) {
      setNotice("The selected product could not be found.");
      return false;
    }

    const isUsedInPurchases = data.purchases.some(
      (purchase) => purchase.productId === productId,
    );
    const isUsedInSales = data.sales.some((sale) =>
      sale.items.some((item) => item.productId === productId),
    );

    if (isUsedInPurchases || isUsedInSales) {
      if (product.isArchived) {
        setNotice(
          `Product ${product.name} is already archived and unavailable for future use.`,
        );
        return false;
      }

      setNotice(
        `Product ${product.name} cannot be deleted because it is already used in purchases or sales.`,
      );
      startTransition(() => {
        setData((current) => ({
          ...current,
          products: current.products.map((entry) =>
            entry.id === productId ? { ...entry, isArchived: true } : entry,
          ),
        }));
        setNotice(
          `Product ${product.name} archived. Existing references are preserved and it will not appear in new entries.`,
        );
      });
      return true;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        products: current.products.filter((entry) => entry.id !== productId),
      }));
      setNotice(`Product ${product.name} deleted.`);
    });

    return true;
  }

  function addCustomer(input: CustomerFormInput) {
    const normalizedInput = normalizeCustomerInput(input);

    if (!normalizedInput.name || !normalizedInput.phone) {
      setNotice("Customer name and phone are required.");
      return false;
    }

    const customer: Customer = {
      id: nanoid(),
      ...normalizedInput,
      outstanding: 0,
      isArchived: false,
    };

    startTransition(() => {
      setData((current) => ({
        ...current,
        customers: [customer, ...current.customers],
      }));
      setNotice(`Customer ${customer.name} added.`);
    });

    return true;
  }

  function updateCustomer(customerId: string, input: CustomerFormInput) {
    const normalizedInput = normalizeCustomerInput(input);

    if (!normalizedInput.name || !normalizedInput.phone) {
      setNotice("Customer name and phone are required.");
      return false;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        customers: current.customers.map((customer) =>
          customer.id === customerId
            ? { ...customer, ...normalizedInput }
            : customer,
        ),
      }));
      setNotice(`Customer ${normalizedInput.name} updated.`);
    });

    return true;
  }

  function deleteCustomer(customerId: string) {
    const customer = data.customers.find((entry) => entry.id === customerId);

    if (!customer) {
      setNotice("The selected customer could not be found.");
      return false;
    }

    const hasInvoices = data.sales.some(
      (sale) => sale.customerId === customerId,
    );

    if (hasInvoices || customer.outstanding > 0) {
      if (customer.isArchived) {
        setNotice(
          `Customer ${customer.name} is already archived and unavailable for future use.`,
        );
        return false;
      }

      startTransition(() => {
        setData((current) => ({
          ...current,
          customers: current.customers.map((entry) =>
            entry.id === customerId ? { ...entry, isArchived: true } : entry,
          ),
        }));
        setNotice(
          `Customer ${customer.name} archived. Existing invoices stay linked and the customer will not appear in new orders.`,
        );
      });
      return true;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        customers: current.customers.filter((entry) => entry.id !== customerId),
      }));
      setNotice(`Customer ${customer.name} deleted.`);
    });

    return true;
  }

  function addSupplier(input: SupplierFormInput) {
    const normalizedInput = normalizeSupplierInput(input);

    if (!normalizedInput.name || !normalizedInput.phone) {
      setNotice("Vendor name and phone are required.");
      return false;
    }

    const supplier: Supplier = {
      id: nanoid(),
      ...normalizedInput,
      isArchived: false,
    };

    startTransition(() => {
      setData((current) => ({
        ...current,
        suppliers: [supplier, ...current.suppliers],
      }));
      setNotice(`Vendor ${supplier.name} added.`);
    });

    return true;
  }

  function updateSupplier(supplierId: string, input: SupplierFormInput) {
    const normalizedInput = normalizeSupplierInput(input);

    if (!normalizedInput.name || !normalizedInput.phone) {
      setNotice("Vendor name and phone are required.");
      return false;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        suppliers: current.suppliers.map((supplier) =>
          supplier.id === supplierId
            ? { ...supplier, ...normalizedInput }
            : supplier,
        ),
      }));
      setNotice(`Vendor ${normalizedInput.name} updated.`);
    });

    return true;
  }

  function deleteSupplier(supplierId: string) {
    const supplier = data.suppliers.find((entry) => entry.id === supplierId);

    if (!supplier) {
      setNotice("The selected vendor could not be found.");
      return false;
    }

    const hasPurchases = data.purchases.some(
      (purchase) => purchase.supplierId === supplierId,
    );

    if (hasPurchases) {
      if (supplier.isArchived) {
        setNotice(
          `Vendor ${supplier.name} is already archived and unavailable for future use.`,
        );
        return false;
      }

      startTransition(() => {
        setData((current) => ({
          ...current,
          suppliers: current.suppliers.map((entry) =>
            entry.id === supplierId ? { ...entry, isArchived: true } : entry,
          ),
        }));
        setNotice(
          `Vendor ${supplier.name} archived. Existing purchases stay linked and the vendor will not appear in new entries.`,
        );
      });
      return true;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        suppliers: current.suppliers.filter((entry) => entry.id !== supplierId),
      }));
      setNotice(`Vendor ${supplier.name} deleted.`);
    });

    return true;
  }

  function recordPurchase(draft: PurchaseDraft) {
    const product = data.products.find((entry) => entry.id === draft.productId);
    const supplier = data.suppliers.find(
      (entry) => entry.id === draft.supplierId,
    );

    if (!product || !supplier) {
      setNotice("Select both vendor and product before recording a purchase.");
      return false;
    }

    if (product.isArchived || supplier.isArchived) {
      setNotice(
        "Archived vendors or products cannot be used for new purchase entries.",
      );
      return false;
    }

    if (!draft.billNumber || !draft.date) {
      setNotice("Enter purchase bill number and date before saving the entry.");
      return false;
    }

    const purchase: Purchase = {
      id: nanoid(),
      billNumber: draft.billNumber,
      date: draft.date,
      supplierId: supplier.id,
      supplierName: supplier.name,
      productId: product.id,
      productName: product.name,
      unitCost: draft.unitCost,
      makingCharge: draft.makingCharge,
      totalWeight: draft.totalWeight,
      totalCost: draft.totalCost,
      paidAmount: Math.min(Math.max(draft.paidAmount, 0), draft.totalCost),
      notes: draft.notes,
    };

    startTransition(() => {
      setData((current) => ({
        ...current,
        purchases: [purchase, ...current.purchases],
        products: current.products.map((entry) =>
          entry.id === product.id
            ? {
                ...entry,
                stockQty: entry.stockQty + 1,
              }
            : entry,
        ),
      }));
      setNotice(
        `Purchase ${purchase.billNumber} recorded for ${product.name}.`,
      );
    });

    return true;
  }

  function updatePurchase(purchaseId: string, draft: PurchaseDraft) {
    const product = data.products.find((entry) => entry.id === draft.productId);
    const supplier = data.suppliers.find(
      (entry) => entry.id === draft.supplierId,
    );
    const previousPurchase = data.purchases.find(
      (entry) => entry.id === purchaseId,
    );

    if (!product || !supplier || !previousPurchase) {
      setNotice(
        "Select both vendor and product before saving the purchase entry.",
      );
      return false;
    }

    if (
      (product.isArchived && previousPurchase.productId !== product.id) ||
      (supplier.isArchived && previousPurchase.supplierId !== supplier.id)
    ) {
      setNotice(
        "Archived vendors or products cannot be assigned to a different purchase entry.",
      );
      return false;
    }

    if (!draft.billNumber || !draft.date) {
      setNotice("Enter purchase bill number and date before saving the entry.");
      return false;
    }

    const updatedPurchase: Purchase = {
      id: purchaseId,
      billNumber: draft.billNumber,
      date: draft.date,
      supplierId: supplier.id,
      supplierName: supplier.name,
      productId: product.id,
      productName: product.name,
      unitCost: draft.unitCost,
      makingCharge: draft.makingCharge,
      totalWeight: draft.totalWeight,
      totalCost: draft.totalCost,
      paidAmount: Math.min(Math.max(draft.paidAmount, 0), draft.totalCost),
      notes: draft.notes,
    };

    startTransition(() => {
      setData((current) => {
        const movedAwayFromPrevious =
          previousPurchase.productId !== updatedPurchase.productId;

        return {
          ...current,
          purchases: current.purchases.map((entry) =>
            entry.id === purchaseId ? updatedPurchase : entry,
          ),
          products: current.products.map((entry) => {
            if (
              entry.id === updatedPurchase.productId &&
              movedAwayFromPrevious
            ) {
              return { ...entry, stockQty: entry.stockQty + 1 };
            }

            if (
              entry.id === previousPurchase.productId &&
              movedAwayFromPrevious
            ) {
              return { ...entry, stockQty: Math.max(entry.stockQty - 1, 0) };
            }

            return entry;
          }),
        };
      });
      setNotice(`Purchase ${updatedPurchase.billNumber} updated.`);
    });

    return true;
  }

  function deletePurchase(purchaseId: string) {
    const purchase = data.purchases.find((entry) => entry.id === purchaseId);

    if (!purchase) {
      setNotice("The selected purchase entry could not be found.");
      return false;
    }

    const availableWeightMap = getAvailableWeightMap(
      data.purchases,
      data.sales,
    );
    const availableWeight = availableWeightMap.get(purchase.productId) ?? 0;

    if (availableWeight + 0.000001 < purchase.totalWeight) {
      setNotice(
        `Purchase ${purchase.billNumber} cannot be deleted because part of that stock has already been sold.`,
      );
      return false;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        purchases: current.purchases.filter((entry) => entry.id !== purchaseId),
        products: current.products.map((entry) =>
          entry.id === purchase.productId
            ? { ...entry, stockQty: Math.max(entry.stockQty - 1, 0) }
            : entry,
        ),
      }));
      setNotice(`Purchase ${purchase.billNumber} deleted.`);
    });

    return true;
  }

  function createSale(
    draft: SaleDraft,
    editSaleId: string | undefined = undefined,
    preview = calculateSalePreview(
      data.products,
      draft,
      data.shop.defaultTaxRate,
    ),
  ) {
    let customer: Customer | undefined = data.customers.find(
      (entry) => entry.id === draft.customerId,
    );
    let createdCustomer: Customer | null = null;

    if (draft.saveCustomerDetails) {
      const customerName = draft.customerName.trim();
      const customerPhone = draft.customerPhone.trim();

      if (!customerName || !customerPhone) {
        setNotice(
          "Enter at least customer name and phone when new customer mode is enabled.",
        );
        return false;
      }

      customer = data.customers.find(
        (entry) => entry.phone.trim() === customerPhone && !entry.isArchived,
      );

      if (!customer) {
        createdCustomer = {
          id: nanoid(),
          name: toTitleCase(customerName),
          phone: customerPhone,
          email: draft.customerEmail.trim(),
          city: toTitleCase(draft.customerCity),
          address: toTitleCase(draft.customerAddress),
          outstanding: 0,
          isArchived: false,
        };
        customer = createdCustomer;
      }
    }

    if (customer?.isArchived) {
      setNotice("Archived customers cannot be used for new orders.");
      return false;
    }

    if (!customer || preview.validItems.length === 0) {
      setNotice("Select a customer and at least one valid order line.");
      return false;
    }

    const archivedProduct = preview.validItems.find(
      (entry) => entry.product.isArchived,
    );
    if (archivedProduct) {
      setNotice(
        `Archived product ${archivedProduct.product.name} cannot be used in a new order.`,
      );
      return false;
    }

    const availableWeightMap = getAvailableWeightMap(
      data.purchases,
      data.sales,
    );
    const requiredWeightMap = preview.validItems.reduce<Map<string, number>>(
      (summary, entry) => {
        summary.set(
          entry.product.id,
          (summary.get(entry.product.id) ?? 0) + entry.totalWeight,
        );
        return summary;
      },
      new Map(),
    );
    const insufficientStock = preview.validItems.find((entry) => {
      const availableWeight = availableWeightMap.get(entry.product.id) ?? 0;
      const requiredWeight = requiredWeightMap.get(entry.product.id) ?? 0;
      return requiredWeight > availableWeight;
    });
    if (insufficientStock) {
      const availableWeight = Math.max(
        availableWeightMap.get(insufficientStock.product.id) ?? 0,
        0,
      );
      setNotice(
        `Not enough stock for ${insufficientStock.product.name}. Available weight is ${availableWeight.toFixed(2)} g.`,
      );
      return false;
    }

    const oldSale = editSaleId
      ? data.sales.find((s) => s.id === editSaleId)
      : undefined;

    if (editSaleId && !oldSale) {
      setNotice("Original invoice not found.");
      return false;
    }

    const saleId = editSaleId ?? nanoid();

    const invoiceNumber = oldSale
      ? oldSale.invoiceNumber
      : `${data.shop.invoicePrefix}-${String(data.shop.invoiceSequence).padStart(5, "0")}`;

    const items: SaleItem[] = preview.validItems.map((entry) => ({
      productId: entry.product.id,
      productName: entry.product.name,
      hsn: entry.product.hsn,
      quantity: entry.quantity,
      grossWeight: entry.grossWeight,
      stoneWeight: entry.stoneWeight,
      totalWeight: entry.totalWeight,
      unitPrice: entry.unitPrice,
      makingCharge: entry.makingCharge,
      otherCharges: entry.otherCharges,
      lineTotal: entry.lineTotal,
    }));

    const sale: Sale = {
      id: saleId,
      invoiceNumber,
      date: draft.date,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      taxRate: data.shop.defaultTaxRate,
      separateRateAndMakingCharge: draft.separateRateAndMakingCharge,
      items,
      subtotal: preview.subtotal,
      discount: preview.discount,
      taxAmount: preview.taxAmount,
      total: preview.total,
      paidAmount: preview.paidAmount,
      balanceAmount: preview.balanceAmount,
      paymentMode: draft.paymentMode,
      notes: draft.notes,
    };

    const newOutstanding: OutstandingEntry | null =
      preview.balanceAmount > 0
        ? {
            id: nanoid(),
            saleId: sale.id,
            invoiceNumber: sale.invoiceNumber,
            date: sale.date,
            customerId: customer.id,
            customerName: customer.name,
            balanceAmount: preview.balanceAmount,
            paidAmount: 0,
            status: "pending",
            settlements: [],
          }
        : null;

    startTransition(() => {
      setData((current) => {
        const previousSale = editSaleId
          ? current.sales.find((s) => s.id === editSaleId)
          : undefined;

        const updatedOutstandings = current.outstandings.filter(
          (o) => o.saleId !== saleId,
        );

        const updatedCustomers = current.customers.map((c) => {
          if (previousSale && c.id === previousSale.customerId) {
            return {
              ...c,
              outstanding: Math.max(
                0,
                c.outstanding - previousSale.balanceAmount,
              ),
            };
          }

          if (c.id === customer.id) {
            return {
              ...c,
              outstanding: c.outstanding + sale.balanceAmount,
            };
          }

          return c;
        });

        return {
          ...current,
          shop: {
            ...current.shop,
            invoiceSequence: editSaleId
              ? current.shop.invoiceSequence
              : current.shop.invoiceSequence + 1,
          },
          sales: editSaleId
            ? current.sales.map((s) => (s.id === editSaleId ? sale : s))
            : [sale, ...current.sales],
          customers: createdCustomer
            ? [createdCustomer, ...updatedCustomers]
            : updatedCustomers,
          outstandings: newOutstanding
            ? [newOutstanding, ...updatedOutstandings]
            : updatedOutstandings,
        };
      });
      setNotice(
        `Invoice ${sale.invoiceNumber} ${editSaleId ? "updated" : "generated"}.`,
      );
    });

    void generateInvoicePdf(sale, data.shop);
    return true;
  }

  function settleOutstanding(entryId: string, amount: number) {
    const entry = data.outstandings.find((o) => o.id === entryId);
    if (!entry) {
      setNotice("Outstanding entry not found.");
      return false;
    }

    if (entry.status === "settled") {
      setNotice("This outstanding is already fully settled.");
      return false;
    }

    const settleAmount = Math.min(Math.max(amount, 0), entry.balanceAmount - entry.paidAmount);
    if (settleAmount <= 0) {
      setNotice("Enter a valid settlement amount.");
      return false;
    }

    const today = dayjs().format("YYYY-MM-DD");
    const newPaidAmount = entry.paidAmount + settleAmount;
    const isFullySettled = newPaidAmount >= entry.balanceAmount;

    startTransition(() => {
      setData((current) => ({
        ...current,
        outstandings: current.outstandings.map((o) =>
          o.id === entryId
            ? {
                ...o,
                paidAmount: newPaidAmount,
                status: isFullySettled ? ("settled" as const) : ("pending" as const),
                settlements: [
                  ...o.settlements,
                  { amount: settleAmount, date: today },
                ],
              }
            : o,
        ),
        customers: current.customers.map((c) =>
          c.id === entry.customerId
            ? { ...c, outstanding: Math.max(0, c.outstanding - settleAmount) }
            : c,
        ),
      }));
      setNotice(
        `${formatMoney(settleAmount, data.shop.currency)} settled for ${entry.invoiceNumber}${isFullySettled ? " (fully)" : ""}.`,
      );
    });

    return true;
  }

  function deleteOutstanding(entryId: string) {
    const entry = data.outstandings.find((o) => o.id === entryId);
    if (!entry) {
      setNotice("Outstanding entry not found.");
      return false;
    }

    startTransition(() => {
      setData((current) => ({
        ...current,
        outstandings: current.outstandings.filter((o) => o.id !== entryId),
        customers: current.customers.map((c) =>
          c.id === entry.customerId && entry.status === "pending"
            ? { ...c, outstanding: Math.max(0, c.outstanding - entry.balanceAmount) }
            : c,
        ),
      }));
      setNotice(`Outstanding entry for ${entry.invoiceNumber} deleted.`);
    });

    return true;
  }

  function saveShop(shop: AppData["shop"]) {
    const normalizedShop = normalizeShopProfile(shop);

    startTransition(() => {
      setData((current) => ({
        ...current,
        shop: normalizedShop,
      }));
      setNotice("Shop profile saved.");
    });

    return true;
  }

  async function restoreFromFile(file: File) {
    const imported = await importAppData(file);
    startTransition(() => {
      setData(imported);
      setNotice(`Backup ${file.name} restored successfully.`);
    });
  }

  async function resetAllData() {
    const seeded = await resetAppData();
    startTransition(() => {
      setData(seeded);
      setNotice("Application data reset to empty values.");
    });
  }

  return {
    data,
    isReady,
    notice,
    dashboardMetrics,
    exportData: () => exportAppData(data),
    restoreFromFile,
    resetAllData,
    addProduct,
    updateProduct,
    deleteProduct,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    recordPurchase,
    updatePurchase,
    deletePurchase,
    deleteSale,
    createSale,
    settleOutstanding,
    deleteOutstanding,
    saveShop,
  };
}
