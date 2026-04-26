import { Fragment, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import {
  Autocomplete, Box, Button, Chip, Collapse, FormControl, FormControlLabel,
  Grid, IconButton, InputLabel, MenuItem, Paper, Select, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import {
  calculateSaleLineTotal, calculateSalePreview, createSaleDraft,
} from "../../hooks/useShopData";
import { formatMoney, formatWeight } from "../../lib/format";
import { previewInvoicePdf } from "../../invoice";
import type { AppData, Sale, SaleDraft, SaleDraftItem, SaleItem } from "../../types";

function numberInputValue(value: number) { return value === 0 ? "" : value; }
function parseNumberInput(value: string) { return value === "" ? 0 : Number(value); }
function clampPaidAmount(value: number, totalAmount: number) {
  return Math.min(Math.max(value, 0), Math.max(totalAmount, 0));
}
function createLineItemDraft(): SaleDraftItem {
  return { id: nanoid(), productId: "", quantity: 0, grossWeight: 0, stoneWeight: 0, totalWeight: 0, unitPrice: 0, makingCharge: 0, otherCharges: 0 };
}
function getLineItemAmount(item: SaleDraftItem, separateRateAndMakingCharge: boolean) {
  return calculateSaleLineTotal(item, separateRateAndMakingCharge);
}

export function SalesView({ data, onCreateSale }: { data: AppData; onCreateSale: (draft: SaleDraft, editSaleId?: string) => boolean; }) {
  const availableWeightMap = useMemo(() => {
    const availableWeights = new Map<string, number>();
    data.purchases.forEach((purchase) => {
      availableWeights.set(purchase.productId, (availableWeights.get(purchase.productId) ?? 0) + purchase.totalWeight);
    });
    data.sales.flatMap((sale) => sale.items).forEach((item) => {
      availableWeights.set(item.productId, (availableWeights.get(item.productId) ?? 0) - item.totalWeight);
    });
    return availableWeights;
  }, [data.purchases, data.sales]);

  const createDraftState = () => ({ ...createSaleDraft(), items: [] });
  const [draft, setDraft] = useState<SaleDraft>(createDraftState());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const saleId = sessionStorage.getItem("editSaleId");
    if (!saleId) return;
    const sale = data.sales.find((s) => s.id === saleId);
    if (!sale) { sessionStorage.removeItem("editSaleId"); return; }
    const draftItems: SaleDraftItem[] = sale.items.map((item) => ({
      id: nanoid(), productId: item.productId, quantity: item.quantity || 1,
      grossWeight: item.grossWeight, stoneWeight: item.stoneWeight,
      totalWeight: item.totalWeight, unitPrice: item.unitPrice, makingCharge: item.makingCharge,
      otherCharges: item.otherCharges,
    }));
    setDraft({
      customerId: sale.customerId, saveCustomerDetails: false,
      customerName: sale.customerName, customerPhone: sale.customerPhone,
      customerEmail: "", customerCity: "", customerAddress: sale.customerAddress,
      editSaleId: sale.id, taxRate: sale.taxRate,
      separateRateAndMakingCharge: sale.separateRateAndMakingCharge,
      date: sale.date, paymentMode: sale.paymentMode, discount: sale.discount,
      paidAmount: sale.paidAmount, notes: sale.notes, items: draftItems,
    });
    setIsEditing(true);
    sessionStorage.removeItem("editSaleId");
  }, [data.sales]);

  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [paidAmountWarning, setPaidAmountWarning] = useState("");
  const [lineItemDraft, setLineItemDraft] = useState<SaleDraftItem>(() => createLineItemDraft());
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [editingLineItemDraft, setEditingLineItemDraft] = useState<SaleDraftItem | null>(null);

  const selectableCustomers = useMemo(() =>
    data.customers.filter((customer) => !customer.isArchived || customer.id === draft.customerId),
    [data.customers, draft.customerId]);
  const selectableProducts = useMemo(() => data.products.filter((product) => !product.isArchived), [data.products]);
  const preview = useMemo(() => calculateSalePreview(data.products, draft, data.shop.defaultTaxRate),
    [data.products, data.shop.defaultTaxRate, draft]);
  const splitTaxRate = data.shop.defaultTaxRate / 2;
  const selectedCustomer = data.customers.find((customer) => customer.id === draft.customerId);
  const draftCustomer = draft.saveCustomerDetails
    ? { id: "draft-customer", name: draft.customerName.trim(), phone: draft.customerPhone.trim(), address: draft.customerAddress.trim() }
    : selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name, phone: selectedCustomer.phone, address: selectedCustomer.address } : null;
  const canPreviewDraftInvoice = Boolean(draftCustomer?.name && preview.validItems.length > 0);
  const canAddLineItem = Boolean(lineItemDraft.productId && lineItemDraft.grossWeight > 0);
  const hasExplicitPaidAmount = paidAmountInput.trim() !== "";
  const effectivePaidAmount = clampPaidAmount(hasExplicitPaidAmount ? parseNumberInput(paidAmountInput) : draft.paidAmount, preview.total);

  function updateDraft(field: keyof Omit<SaleDraft, "items">, value: string | number | boolean) {
    if (field === "paidAmount" && typeof value === "string") {
      const attemptedPaidAmount = parseNumberInput(value);
      const nextPaidAmount = clampPaidAmount(attemptedPaidAmount, preview.total);
      setPaidAmountInput(nextPaidAmount === 0 ? "" : String(nextPaidAmount));
      setPaidAmountWarning(attemptedPaidAmount > preview.total ? "Paid amount cannot be greater than the grand total." : "");
      setDraft((current) => ({ ...current, paidAmount: nextPaidAmount }) as SaleDraft);
      return;
    }
    setDraft((current) => {
      const nextDraft = { ...current, [field]: value } as SaleDraft;
      const nextPreview = calculateSalePreview(data.products, nextDraft, data.shop.defaultTaxRate);
      const nextPaidAmount = clampPaidAmount(nextDraft.paidAmount, nextPreview.total);
      setPaidAmountInput(nextPaidAmount === 0 ? "" : String(nextPaidAmount));
      setPaidAmountWarning(nextDraft.paidAmount > nextPreview.total ? "Paid amount cannot be greater than the grand total." : "");
      return { ...nextDraft, paidAmount: nextPaidAmount };
    });
  }

  function updateLineItem(item: SaleDraftItem, field: keyof SaleDraftItem, value: string | number) {
    return { ...item, [field]: value };
  }

  function addLineItem() {
    if (!canAddLineItem) return;
    setDraft((current) => ({ ...current, items: [...current.items, lineItemDraft] }));
    setLineItemDraft(createLineItemDraft());
  }

  function removeLineItem(itemId: string) {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }));
    if (editingLineItemId === itemId) { setEditingLineItemId(null); setEditingLineItemDraft(null); }
  }

  function submitOrder() {
    const ok = onCreateSale({ ...draft, date: dayjs().format("YYYY-MM-DD"), paidAmount: effectivePaidAmount }, isEditing ? draft.editSaleId : undefined);
    if (ok) {
      setDraft(createDraftState()); setPaidAmountInput(""); setPaidAmountWarning("");
      setLineItemDraft(createLineItemDraft()); setEditingLineItemId(null); setEditingLineItemDraft(null);
      setIsEditing(false); window.location.hash = "#/issued-invoices";
    }
  }

  function previewDraftInvoice() {
    if (!draftCustomer || preview.validItems.length === 0) return;
    const items: SaleItem[] = preview.validItems.map((entry) => ({
      productId: entry.product.id, productName: entry.product.name, hsn: entry.product.hsn,
      quantity: entry.quantity, grossWeight: entry.grossWeight, stoneWeight: entry.stoneWeight,
      totalWeight: entry.totalWeight, unitPrice: entry.unitPrice, makingCharge: entry.makingCharge,
      otherCharges: entry.otherCharges, lineTotal: entry.lineTotal,
    }));
    const invoicePreview: Sale = {
      id: "preview", invoiceNumber: `${data.shop.invoicePrefix}-${String(data.shop.invoiceSequence).padStart(5, "0")}`,
      date: dayjs().format("YYYY-MM-DD"), customerId: draftCustomer.id, customerName: draftCustomer.name,
      customerPhone: draftCustomer.phone, customerAddress: draftCustomer.address, taxRate: data.shop.defaultTaxRate,
      separateRateAndMakingCharge: draft.separateRateAndMakingCharge, items, subtotal: preview.subtotal,
      discount: preview.discount, taxAmount: preview.taxAmount, total: preview.total,
      paidAmount: effectivePaidAmount, balanceAmount: Math.max(preview.total - effectivePaidAmount, 0),
      paymentMode: draft.paymentMode, notes: draft.notes,
    };
    previewInvoicePdf(invoicePreview, data.shop);
  }

  function startEditingLineItem(itemId: string) {
    const item = draft.items.find((entry) => entry.id === itemId);
    if (!item) return;
    setEditingLineItemId(itemId); setEditingLineItemDraft({ ...item });
  }

  function saveEditingLineItem() {
    if (!editingLineItemId || !editingLineItemDraft || !editingLineItemDraft.productId || editingLineItemDraft.grossWeight <= 0) return;
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.id === editingLineItemId ? editingLineItemDraft : item) }));
    setEditingLineItemId(null); setEditingLineItemDraft(null);
  }

  function cancelEditingLineItem() { setEditingLineItemId(null); setEditingLineItemDraft(null); }

  function cancelEdit() {
    setDraft(createDraftState());
    setPaidAmountInput("");
    setPaidAmountWarning("");
    setLineItemDraft(createLineItemDraft());
    setEditingLineItemId(null);
    setEditingLineItemDraft(null);
    setIsEditing(false);
    window.location.hash = "#/issued-invoices";
  }

  function renderLineItemEditor(item: SaleDraftItem, onChange: (field: keyof SaleDraftItem, value: string | number) => void) {
    const lineAmount = getLineItemAmount(item, draft.separateRateAndMakingCharge);
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              fullWidth
              size="small"
              options={selectableProducts}
              getOptionLabel={(product) => product.name}
              renderOption={(props, product) => (
                <li {...props}>
                  {product.name} &middot; {Math.max(availableWeightMap.get(product.id) ?? 0, 0).toFixed(2)} g available
                </li>
              )}
              value={selectableProducts.find((p) => p.id === item.productId) || null}
              onChange={(_event, newValue) => onChange("productId", newValue?.id || "")}
              renderInput={(params) => <TextField {...params} label="Product" size="small" />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" label="Quantity" type="number" placeholder="Enter quantity"
              value={numberInputValue(item.quantity)} onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              onChange={(e) => onChange("quantity", parseNumberInput(e.target.value))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" label="Gross Wt" type="number" placeholder="Enter gross weight"
              slotProps={{ htmlInput: { step: 0.01 } }} value={numberInputValue(item.grossWeight)} disabled={!item.productId}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              onChange={(e) => onChange("grossWeight", parseNumberInput(e.target.value))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" label="Stone Wt" type="number" placeholder="Enter stone weight"
              slotProps={{ htmlInput: { step: 0.01 } }} value={numberInputValue(item.stoneWeight)} disabled={!item.productId}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              onChange={(e) => onChange("stoneWeight", parseNumberInput(e.target.value))} />
          </Grid>
          <Grid size={{ xs: 12, sm: draft.separateRateAndMakingCharge ? 3 : 6 }}>
            <TextField fullWidth size="small" label="Rate per g" type="number" placeholder="Enter rate per g"
              value={numberInputValue(item.unitPrice)} onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              onChange={(e) => onChange("unitPrice", parseNumberInput(e.target.value))} />
          </Grid>
          {draft.separateRateAndMakingCharge && (
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth size="small" label="Making per g" type="number" placeholder="Enter making per g"
                value={numberInputValue(item.makingCharge)} onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                onChange={(e) => onChange("makingCharge", parseNumberInput(e.target.value))} />
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: draft.separateRateAndMakingCharge ? 3 : 6 }}>
            <TextField fullWidth size="small" label="Other Charges" type="number" placeholder="Enter other charges"
              value={numberInputValue(item.otherCharges)} onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              onChange={(e) => onChange("otherCharges", parseNumberInput(e.target.value))} />
          </Grid>
        </Grid>
        <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: "action.hover", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Calculated line amount</Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{formatMoney(lineAmount, data.shop.currency)}</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* Left panel */}
      <Grid size={{ xs: 12, lg: 5 }}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">{isEditing ? "Edit Invoice" : "Customer Details"}</Typography>
            {isEditing && <Chip label="Editing invoice" color="warning" size="small" />}
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {isEditing ? (
                  <TextField
                    fullWidth
                    size="small"
                    label="Customer"
                    value={draft.customerName}
                    disabled
                    sx={{ bgcolor: "action.hover" }}
                  />
                ) : (
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={selectableCustomers}
                    getOptionLabel={(customer) => `${customer.name}${customer.isArchived ? " (Archived)" : ""}`}
                    value={selectableCustomers.find((c) => c.id === draft.customerId) || null}
                    onChange={(_event, newValue) => updateDraft("customerId", newValue?.id || "")}
                    renderInput={(params) => <TextField {...params} label="Customer" size="small" />}
                    disabled={draft.saveCustomerDetails}
                  />
                )}
                {!isEditing && (
                  <FormControlLabel control={<Switch size="small" checked={draft.saveCustomerDetails} onChange={(e) => {
                    const enabled = e.target.checked;
                    setDraft((current) => ({ ...current, saveCustomerDetails: enabled, customerId: enabled ? "" : current.customerId }));
                  }} />} label="New" sx={{ whiteSpace: "nowrap" }} />
                )}
                {isEditing && <Chip label="Editing" size="small" color="default" />}
              </Box>
            </Grid>

            {draft.saveCustomerDetails && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth size="small" label="Customer name" placeholder="Enter customer name"
                    value={draft.customerName} onChange={(e) => updateDraft("customerName", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth size="small" label="Customer phone" placeholder="Enter phone number"
                    value={draft.customerPhone} onChange={(e) => updateDraft("customerPhone", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth size="small" label="Email" placeholder="Enter email address"
                    value={draft.customerEmail} onChange={(e) => updateDraft("customerEmail", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth size="small" label="City" placeholder="Enter city"
                    value={draft.customerCity} onChange={(e) => updateDraft("customerCity", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth size="small" label="Address" placeholder="Enter address" multiline rows={2}
                    value={draft.customerAddress} onChange={(e) => updateDraft("customerAddress", e.target.value)} />
                </Grid>
              </>
            )}
          </Grid>

          <Paper variant="outlined" sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: "background.default" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Add Item</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FormControlLabel control={<Switch size="small" checked={draft.separateRateAndMakingCharge}
                  onChange={(e) => updateDraft("separateRateAndMakingCharge", e.target.checked)} />} label="Separate Charge" sx={{ whiteSpace: "nowrap" }} />
                <Tooltip title="Add order line"><span><IconButton color="primary" onClick={addLineItem} disabled={!canAddLineItem}><AddIcon /></IconButton></span></Tooltip>
              </Box>
            </Box>
            {renderLineItemEditor(lineItemDraft, (field, value) => {
              setLineItemDraft((current) => updateLineItem(current, field, value));
            })}
          </Paper>
        </Paper>
      </Grid>

      {/* Right panel */}
      <Grid size={{ xs: 12, lg: 7 }}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Order review</Typography>
            <Chip label={`${preview.validItems.length} placed lines`} size="small" variant="outlined" />
          </Box>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell><TableCell>Product</TableCell><TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Gross Wt</TableCell><TableCell align="right">Stone Wt</TableCell>
                  <TableCell align="right">Net Wt</TableCell><TableCell align="right">Rate</TableCell>
                  {draft.separateRateAndMakingCharge && <TableCell align="right">Making</TableCell>}
                  <TableCell align="right">Other</TableCell><TableCell align="right">Amount</TableCell><TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {draft.items.map((item, index) => {
                  const product = data.products.find((entry) => entry.id === item.productId);
                  const isEditingLine = editingLineItemId === item.id && editingLineItemDraft;
                  return (
                    <Fragment key={item.id}>
                      <TableRow hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{product?.name || "Select product"}</TableCell>
                        <TableCell align="right">{item.quantity > 0 ? item.quantity : 1}</TableCell>
                        <TableCell align="right">{item.grossWeight > 0 ? formatWeight(item.grossWeight) : "--"}</TableCell>
                        <TableCell align="right">{item.stoneWeight > 0 ? formatWeight(item.stoneWeight) : "--"}</TableCell>
                        <TableCell align="right">{formatWeight(Math.max(item.grossWeight - item.stoneWeight, 0))}</TableCell>
                        <TableCell align="right">{formatMoney(item.unitPrice, data.shop.currency)}</TableCell>
                        {draft.separateRateAndMakingCharge && <TableCell align="right">{formatMoney(item.makingCharge, data.shop.currency)}</TableCell>}
                        <TableCell align="right">{formatMoney(item.otherCharges, data.shop.currency)}</TableCell>
                        <TableCell align="right">{formatMoney(getLineItemAmount(item, draft.separateRateAndMakingCharge), data.shop.currency)}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit order line"><IconButton size="small" onClick={() => startEditingLineItem(item.id)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete order line"><IconButton size="small" color="error" onClick={() => removeLineItem(item.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={draft.separateRateAndMakingCharge ? 11 : 10} sx={{ p: 0, border: 0 }}>
                          <Collapse in={Boolean(isEditingLine)} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: "action.hover" }}>
                              {isEditingLine && renderLineItemEditor(editingLineItemDraft, (field, value) => {
                                setEditingLineItemDraft((current) => current ? updateLineItem(current, field, value) : current);
                              })}
                              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
                                <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={saveEditingLineItem}>Save</Button>
                                <Button size="small" variant="outlined" startIcon={<CancelIcon />} onClick={cancelEditingLineItem}>Cancel</Button>
                              </Box>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
                {draft.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={draft.separateRateAndMakingCharge ? 11 : 10} align="center" sx={{ color: "text.secondary", py: 4 }}>
                      Add products to see rate, weight and amount breakdown.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, display: "grid", gap: 1 }}>
            <SummaryRow label="Subtotal" value={formatMoney(preview.subtotal, data.shop.currency)} />
            <SummaryRow label={`CGST (${splitTaxRate}%)`} value={formatMoney(preview.taxAmount / 2, data.shop.currency)} />
            <SummaryRow label={`SGST (${splitTaxRate}%)`} value={formatMoney(preview.taxAmount / 2, data.shop.currency)} />
            <SummaryRow label="Discount" value={formatMoney(preview.discount, data.shop.currency)} />
            <SummaryRow label="Paid" value={formatMoney(effectivePaidAmount, data.shop.currency)} />
            <SummaryRow label="Balance" value={formatMoney(Math.max(preview.total - effectivePaidAmount, 0), data.shop.currency)} />
            <SummaryRow label="Grand total" value={formatMoney(preview.total, data.shop.currency)} emphatic />
          </Box>

          <Grid container spacing={2} sx={{ mt: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment mode</InputLabel>
                <Select value={draft.paymentMode} label="Payment mode" onChange={(e) => updateDraft("paymentMode", e.target.value)}>
                  <MenuItem value="Cash">Cash</MenuItem>
                  <MenuItem value="UPI">UPI</MenuItem>
                  <MenuItem value="Card">Card</MenuItem>
                  <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                  <MenuItem value="Mixed">Mixed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Discount" type="number" placeholder="Enter discount"
                value={numberInputValue(draft.discount)} onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                onChange={(e) => updateDraft("discount", parseNumberInput(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Paid amount" type="number" placeholder="Enter paid amount"
                value={paidAmountInput} onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                onChange={(e) => updateDraft("paidAmount", e.target.value)} error={Boolean(paidAmountWarning)} helperText={paidAmountWarning} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" label="Notes" placeholder="Enter notes" multiline rows={2}
                value={draft.notes} onChange={(e) => updateDraft("notes", e.target.value)} />
            </Grid>
          </Grid>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 3 }}>
            <Tooltip title="Preview invoice"><span><IconButton color="primary" onClick={previewDraftInvoice} disabled={!canPreviewDraftInvoice}><VisibilityIcon /></IconButton></span></Tooltip>
            {isEditing && (
              <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={cancelEdit}>
                Cancel
              </Button>
            )}
            <Button variant="contained" onClick={submitOrder} disabled={preview.validItems.length === 0}>
              {isEditing ? "Update invoice" : "Generate invoice"}
            </Button>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}

function SummaryRow({ label, value, emphatic = false }: { label: string; value: string; emphatic?: boolean; }) {
  return (
    <Box sx={{ px: 2, py: 1.2, borderRadius: 2, bgcolor: emphatic ? "primary.main" : "action.hover",
      color: emphatic ? "primary.contrastText" : "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="body2" sx={{ color: emphatic ? "inherit" : "text.secondary" }}>{label}</Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

