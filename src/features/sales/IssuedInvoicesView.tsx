import { useDeferredValue, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import {
  Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { generateInvoicePdf, previewInvoicePdf } from "../../invoice";
import { formatMoney, formatNumber } from "../../lib/format";
import type { AppData } from "../../types";

type InvoiceFilterId = "dateFrom" | "dateTo" | "customerName" | "mobileNumber" | "invoiceNumber";

const invoiceFilterOptions: Array<{ id: InvoiceFilterId; label: string; placeholder?: string; inputType: "date" | "text" }> = [
  { id: "dateFrom", label: "Start", inputType: "date" },
  { id: "dateTo", label: "End", inputType: "date" },
  { id: "customerName", label: "Customer", placeholder: "Customer", inputType: "text" },
  { id: "mobileNumber", label: "Mobile", placeholder: "Phone", inputType: "text" },
  { id: "invoiceNumber", label: "Invoice", placeholder: "Invoice", inputType: "text" },
];

interface InvoiceTableRow {
  serialNumber: number;
  date: string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  paidAmount: number;
  balanceAmount: number;
}

function createExportStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getInvoiceTotals(rows: InvoiceTableRow[]) {
  return rows.reduce((summary, row) => ({
    paidAmount: summary.paidAmount + row.paidAmount,
    balanceAmount: summary.balanceAmount + row.balanceAmount,
  }), { paidAmount: 0, balanceAmount: 0 });
}

function applyWorksheetStyles(worksheet: XLSX.WorkSheet, rowCount: number) {
  const border = {
    top: { style: "thin", color: { rgb: "8A6D52" } },
    bottom: { style: "thin", color: { rgb: "8A6D52" } },
    left: { style: "thin", color: { rgb: "8A6D52" } },
    right: { style: "thin", color: { rgb: "8A6D52" } },
  };
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  worksheet["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 18 }];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[cellAddress];
      if (!cell) continue;
      const isHeaderRow = rowIndex === 0;
      const isTotalRow = rowIndex === rowCount + 1;
      const isNumericColumn = colIndex === 0 || colIndex >= 4;
      cell.s = {
        font: { bold: isHeaderRow || isTotalRow, color: { rgb: "221F1C" } },
        fill: { fgColor: { rgb: isHeaderRow ? "EBE0CD" : isTotalRow ? "F1E7D7" : "FFFFFF" } },
        border,
        alignment: { vertical: "center", horizontal: isNumericColumn ? "center" : "left", wrapText: true },
      };
    }
  }
}

function exportInvoicesAsXlsx(rows: InvoiceTableRow[]) {
  const totals = getInvoiceTotals(rows);
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["S.N", "Date", "Customer Name", "Customer Mobile Number", "Invoice Number", "Paid Amount (Rs.)", "Balance Amount (Rs.)"],
    ...rows.map((row) => [String(row.serialNumber), row.date, row.customerName, row.customerPhone, row.invoiceNumber, formatNumber(row.paidAmount), formatNumber(row.balanceAmount)]),
    ["", "", "", "", "Total", formatNumber(totals.paidAmount), formatNumber(totals.balanceAmount)],
  ]);
  applyWorksheetStyles(worksheet, rows.length);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Issued Invoices");
  const workbookBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([workbookBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `issued-invoices-${createExportStamp()}.xlsx`);
}

function exportInvoicesAsPdf(rows: InvoiceTableRow[]) {
  const totals = getInvoiceTotals(rows);
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Issued invoices", 14, 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Generated on ${new Date().toLocaleString("en-IN")}`, 14, 22);
  autoTable(pdf, {
    startY: 28, theme: "grid",
    head: [["S.N.", "Date", "Customer Name", "Customer Mobile Number", "Invoice Number", "Paid Amount (Rs.)", "Balance Amount (Rs.)"]],
    body: [
      ...rows.map((row) => [String(row.serialNumber), row.date, row.customerName, row.customerPhone, row.invoiceNumber, formatNumber(row.paidAmount), formatNumber(row.balanceAmount)]),
      ["", "", "", "", "Total", formatNumber(totals.paidAmount), formatNumber(totals.balanceAmount)],
    ],
    headStyles: { fillColor: [235, 224, 205], textColor: [34, 31, 28], lineColor: [90, 72, 58], lineWidth: 0.25, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3, lineColor: [90, 72, 58], lineWidth: 0.25, textColor: [34, 31, 28], valign: "middle" },
    didParseCell: (hookData) => {
      const isTotalRow = hookData.section === "body" && hookData.row.index === rows.length;
      if (isTotalRow && hookData.column.index === 4) hookData.cell.styles.fontStyle = "bold";
    },
    columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 28 }, 2: { cellWidth: 56 }, 3: { cellWidth: 46 }, 4: { cellWidth: 34 }, 5: { cellWidth: 42 }, 6: { cellWidth: 42 } },
  });
  pdf.save(`issued-invoices-${createExportStamp()}.pdf`);
}

export function IssuedInvoicesView({ data, deleteSale }: { data: AppData; deleteSale?: (saleId: string) => boolean; }) {
  const [activeFilters, setActiveFilters] = useState<InvoiceFilterId[]>([]);
  const [filterValues, setFilterValues] = useState<Record<InvoiceFilterId, string>>({ dateFrom: "", dateTo: "", customerName: "", mobileNumber: "", invoiceNumber: "" });
  const deferredCustomerNameFilter = useDeferredValue(filterValues.customerName);
  const deferredMobileNumberFilter = useDeferredValue(filterValues.mobileNumber);
  const deferredInvoiceNumberFilter = useDeferredValue(filterValues.invoiceNumber);
  const activeFilterSet = useMemo(() => new Set(activeFilters), [activeFilters]);

  function addFilter(filterId: InvoiceFilterId) {
    setActiveFilters((current) => current.includes(filterId) ? current : [...current, filterId]);
  }
  function removeFilter(filterId: InvoiceFilterId) {
    setActiveFilters((current) => current.filter((entry) => entry !== filterId));
    setFilterValues((current) => ({ ...current, [filterId]: "" }));
  }
  function updateFilterValue(filterId: InvoiceFilterId, value: string) {
    setFilterValues((current) => ({ ...current, [filterId]: value }));
  }
  function clearAllFilters() {
    setActiveFilters([]);
    setFilterValues({ dateFrom: "", dateTo: "", customerName: "", mobileNumber: "", invoiceNumber: "" });
  }

  const filteredIssuedInvoices = useMemo(() => {
    const customerQuery = deferredCustomerNameFilter.trim().toLowerCase();
    const mobileQuery = deferredMobileNumberFilter.trim().toLowerCase();
    const invoiceQuery = deferredInvoiceNumberFilter.trim().toLowerCase();
    return data.sales.filter((sale) => {
      if (activeFilterSet.has("dateFrom") && filterValues.dateFrom && sale.date < filterValues.dateFrom) return false;
      if (activeFilterSet.has("dateTo") && filterValues.dateTo && sale.date > filterValues.dateTo) return false;
      if (activeFilterSet.has("customerName") && customerQuery && !sale.customerName.toLowerCase().includes(customerQuery)) return false;
      if (activeFilterSet.has("mobileNumber") && mobileQuery && !sale.customerPhone.toLowerCase().includes(mobileQuery)) return false;
      if (activeFilterSet.has("invoiceNumber") && invoiceQuery && !sale.invoiceNumber.toLowerCase().includes(invoiceQuery)) return false;
      return true;
    });
  }, [activeFilterSet, data.sales, deferredCustomerNameFilter, deferredInvoiceNumberFilter, deferredMobileNumberFilter, filterValues.dateFrom, filterValues.dateTo]);

  const filteredRows = useMemo<InvoiceTableRow[]>(() =>
    filteredIssuedInvoices.map((sale, index) => ({
      serialNumber: index + 1, date: sale.date, customerName: sale.customerName,
      customerPhone: sale.customerPhone || "No mobile", invoiceNumber: sale.invoiceNumber,
      paidAmount: sale.paidAmount, balanceAmount: sale.balanceAmount,
    })), [filteredIssuedInvoices]);

  function handleExport(format: "xlsx" | "pdf") {
    if (filteredRows.length === 0) return;
    if (format === "xlsx") { exportInvoicesAsXlsx(filteredRows); return; }
    exportInvoicesAsPdf(filteredRows);
  }

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">Issued invoices</Typography>
        <Chip label={`${filteredIssuedInvoices.length} of ${data.sales.length} invoices`} size="small" variant="outlined" />
      </Box>

      {/* Filter Bar */}
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Add filter</InputLabel>
          <Select value="" label="Add filter" onChange={(e) => { const filterId = e.target.value as InvoiceFilterId; if (filterId) addFilter(filterId); }}>
            <MenuItem value=""><em>Add filter</em></MenuItem>
            {invoiceFilterOptions.filter((option) => !activeFilterSet.has(option.id)).map((option) => (
              <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {activeFilters.map((filterId) => {
          const option = invoiceFilterOptions.find((entry) => entry.id === filterId);
          if (!option) return null;
          return (
            <Chip
              key={filterId}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {(option.label === "Start" || option.label === "End") && (
                    <Typography component="span" variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.04 }}>{option.label}</Typography>
                  )}
                  <TextField
                    size="small"
                    type={option.inputType}
                    placeholder={option.placeholder}
                    value={filterValues[filterId]}
                    onChange={(e) => updateFilterValue(filterId, e.target.value)}
                    sx={{ minWidth: option.inputType === "date" ? 130 : 100 }}
                    slotProps={{ htmlInput: { style: { padding: 0, fontSize: "0.85rem" } }, input: { disableUnderline: true } }}
                    variant="standard"
                  />
                </Box>
              }
              onDelete={() => removeFilter(filterId)}
              sx={{ height: "auto", py: 0.5, backgroundColor: "transparent", border: "1px solid", borderColor: "divider" }}
            />
          );
        })}
        <Button size="small" variant="text" startIcon={<ClearAllIcon />} onClick={clearAllFilters} disabled={activeFilters.length === 0} sx={{ ml: "auto" }}>
          Clear all
        </Button>
      </Paper>

      {/* Export Buttons */}
      <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
        <Button size="small" variant="outlined" onClick={() => handleExport("xlsx")} disabled={filteredRows.length === 0}>Export Excel</Button>
        <Button size="small" variant="outlined" onClick={() => handleExport("pdf")} disabled={filteredRows.length === 0}>Export PDF</Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 2, maxHeight: 520 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>S.N</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Customer Name</TableCell>
              <TableCell>Customer Mobile Number</TableCell>
              <TableCell>Invoice Number</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredIssuedInvoices.map((sale, index) => (
              <TableRow key={sale.id} hover>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{sale.date}</TableCell>
                <TableCell>{sale.customerName}</TableCell>
                <TableCell>{sale.customerPhone || "No mobile"}</TableCell>
                <TableCell>{sale.invoiceNumber}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "grid", gap: 0.3, minWidth: 130 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Paid</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatMoney(sale.paidAmount, data.shop.currency)}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Balance</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatMoney(sale.balanceAmount, data.shop.currency)}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View PDF"><IconButton size="small" onClick={() => previewInvoicePdf(sale, data.shop)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Download PDF"><IconButton size="small" onClick={() => void generateInvoicePdf(sale, data.shop)}><PictureAsPdfIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Edit invoice"><IconButton size="small" onClick={() => { sessionStorage.setItem("editSaleId", sale.id); window.location.hash = "#/sales"; }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Delete invoice"><IconButton size="small" color="error" onClick={() => {
                    if (confirm(`Delete invoice ${sale.invoiceNumber}? This cannot be undone.`)) deleteSale?.(sale.id);
                  }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredIssuedInvoices.length === 0 && (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">No issued invoices match the selected filters.</Typography>
          </Box>
        )}
      </TableContainer>
    </Paper>
  );
}

