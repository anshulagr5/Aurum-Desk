import { useDeferredValue, useMemo, useState, useRef, useEffect } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DeleteIcon } from "../../components/ui/ActionIcons";
import { formatMoney, formatNumber } from "../../lib/format";
import type { AppData, OutstandingSettlement } from "../../types";

type OutstandingFilterId =
  | "dateFrom"
  | "dateTo"
  | "customerName"
  | "invoiceNumber"
  | "status";

const outstandingFilterOptions: Array<{
  id: OutstandingFilterId;
  label: string;
  placeholder?: string;
  inputType: "date" | "text" | "select";
}> = [
  { id: "dateFrom", label: "Start", inputType: "date" },
  { id: "dateTo", label: "End", inputType: "date" },
  {
    id: "customerName",
    label: "Customer",
    placeholder: "Customer",
    inputType: "text",
  },
  {
    id: "invoiceNumber",
    label: "Invoice",
    placeholder: "Invoice",
    inputType: "text",
  },
  { id: "status", label: "Status", inputType: "select" },
];

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

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return "—";
  const d = dayjs(isoDate);
  if (!d.isValid()) return isoDate;
  return d.format("MMMM D, YYYY");
}

function formatSettlementList(settlements: OutstandingSettlement[]): string {
  if (settlements.length === 0) return "—";
  return settlements
    .map(
      (s) =>
        `${formatDisplayDate(s.date)} — ${s.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    )
    .join(" | ");
}

interface OutstandingTableRow {
  serialNumber: number;
  date: string;
  invoiceNumber: string;
  customerName: string;
  balanceAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  settlements: string;
}

function getOutstandingTotals(rows: OutstandingTableRow[]) {
  return rows.reduce(
    (summary, row) => ({
      balanceAmount: summary.balanceAmount + row.balanceAmount,
      paidAmount: summary.paidAmount + row.paidAmount,
      remainingAmount: summary.remainingAmount + row.remainingAmount,
    }),
    { balanceAmount: 0, paidAmount: 0, remainingAmount: 0 },
  );
}

function applyWorksheetStyles(worksheet: XLSX.WorkSheet, rowCount: number) {
  const border = {
    top: { style: "thin", color: { rgb: "8A6D52" } },
    bottom: { style: "thin", color: { rgb: "8A6D52" } },
    left: { style: "thin", color: { rgb: "8A6D52" } },
    right: { style: "thin", color: { rgb: "8A6D52" } },
  };
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");

  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 40 },
  ];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[cellAddress];

      if (!cell) {
        continue;
      }

      const isHeaderRow = rowIndex === 0;
      const isTotalRow = rowIndex === rowCount + 1;
      const isNumericColumn =
        colIndex === 0 || (colIndex >= 4 && colIndex <= 6);

      cell.s = {
        font: { bold: isHeaderRow || isTotalRow, color: { rgb: "221F1C" } },
        fill: {
          fgColor: {
            rgb: isHeaderRow ? "EBE0CD" : isTotalRow ? "F1E7D7" : "FFFFFF",
          },
        },
        border,
        alignment: {
          vertical: "center",
          horizontal: isNumericColumn ? "center" : "left",
          wrapText: true,
        },
      };
    }
  }
}

function exportOutstandingsAsXlsx(rows: OutstandingTableRow[]) {
  const totals = getOutstandingTotals(rows);
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      "S.N",
      "Date",
      "Invoice Number",
      "Customer Name",
      "Balance (Rs.)",
      "Paid (Rs.)",
      "Remaining (Rs.)",
      "Status",
      "Settlements",
    ],
    ...rows.map((row) => [
      String(row.serialNumber),
      row.date,
      row.invoiceNumber,
      row.customerName,
      formatNumber(row.balanceAmount),
      formatNumber(row.paidAmount),
      formatNumber(row.remainingAmount),
      row.status,
      row.settlements,
    ]),
    [
      "",
      "",
      "",
      "Total",
      formatNumber(totals.balanceAmount),
      formatNumber(totals.paidAmount),
      formatNumber(totals.remainingAmount),
      "",
      "",
    ],
  ]);
  applyWorksheetStyles(worksheet, rows.length);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Outstandings");
  const workbookBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  downloadBlob(
    new Blob([workbookBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `outstandings-${createExportStamp()}.xlsx`,
  );
}

function exportOutstandingsAsPdf(rows: OutstandingTableRow[]) {
  const totals = getOutstandingTotals(rows);
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Customer Outstandings", 14, 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Generated on ${new Date().toLocaleString("en-IN")}`, 14, 22);

  autoTable(pdf, {
    startY: 28,
    theme: "grid",
    head: [
      [
        "S.N.",
        "Date",
        "Invoice Number",
        "Customer Name",
        "Balance (Rs.)",
        "Paid (Rs.)",
        "Remaining (Rs.)",
        "Status",
        "Settlements",
      ],
    ],
    body: [
      ...rows.map((row) => [
        String(row.serialNumber),
        row.date,
        row.invoiceNumber,
        row.customerName,
        formatNumber(row.balanceAmount),
        formatNumber(row.paidAmount),
        formatNumber(row.remainingAmount),
        row.status,
        row.settlements,
      ]),
      [
        "",
        "",
        "",
        "Total",
        formatNumber(totals.balanceAmount),
        formatNumber(totals.paidAmount),
        formatNumber(totals.remainingAmount),
        "",
        "",
      ],
    ],
    headStyles: {
      fillColor: [235, 224, 205],
      textColor: [34, 31, 28],
      lineColor: [90, 72, 58],
      lineWidth: 0.25,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [90, 72, 58],
      lineWidth: 0.25,
      textColor: [34, 31, 28],
      valign: "middle",
    },
    didParseCell: (hookData) => {
      const isTotalRow =
        hookData.section === "body" && hookData.row.index === rows.length;
      if (isTotalRow && hookData.column.index === 4) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 26 },
      2: { cellWidth: 30 },
      3: { cellWidth: 44 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28 },
      6: { cellWidth: 28 },
      7: { cellWidth: 22 },
      8: { cellWidth: 50 },
    },
  });

  pdf.save(`outstandings-${createExportStamp()}.pdf`);
}

function CheckIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 13l4 4L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 7.5v5l3.5 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettlementPopover({
  settlements,
  currency,
}: {
  settlements: OutstandingSettlement[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (settlements.length === 0) {
    return <span style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>—</span>;
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        className="ghost-button"
        onClick={() => setOpen((s) => !s)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          fontSize: "0.78rem",
          fontWeight: 600,
          padding: "0.25rem 0.6rem",
          borderRadius: "999px",
          background: "#F3F4F6",
          border: "1px solid #E5E7EB",
          color: "#4B5563",
          cursor: "pointer",
        }}
        title="View settlement history"
      >
        <HistoryIcon />
        {settlements.length} payment{settlements.length > 1 ? "s" : ""}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            top: "calc(100% + 0.5rem)",
            left: 0,
            minWidth: "16rem",
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: "0.5rem",
            boxShadow:
              "0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -4px rgba(0,0,0,0.08)",
            padding: "0.75rem",
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#9CA3AF",
              marginBottom: "0.5rem",
              paddingBottom: "0.35rem",
              borderBottom: "1px solid #F3F4F6",
            }}
          >
            Settlement History
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
          >
            {settlements.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.35rem 0.5rem",
                  borderRadius: "0.375rem",
                  background: i % 2 === 0 ? "#F9FAFB" : "#fff",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                  {formatDisplayDate(s.date)}
                </span>
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "#065F46",
                  }}
                >
                  {formatMoney(s.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function OutstandingsView({
  data,
  onSettle,
  onDelete,
}: {
  data: AppData;
  onSettle?: (entryId: string) => void;
  onDelete?: (entryId: string) => boolean;
}) {
  const [activeFilters, setActiveFilters] = useState<OutstandingFilterId[]>([]);
  const [filterValues, setFilterValues] = useState<
    Record<OutstandingFilterId, string>
  >({
    dateFrom: "",
    dateTo: "",
    customerName: "",
    invoiceNumber: "",
    status: "",
  });
  const deferredCustomerNameFilter = useDeferredValue(
    filterValues.customerName,
  );
  const deferredInvoiceNumberFilter = useDeferredValue(
    filterValues.invoiceNumber,
  );
  const activeFilterSet = useMemo(
    () => new Set(activeFilters),
    [activeFilters],
  );

  function addFilter(filterId: OutstandingFilterId) {
    setActiveFilters((current) =>
      current.includes(filterId) ? current : [...current, filterId],
    );
  }

  function removeFilter(filterId: OutstandingFilterId) {
    setActiveFilters((current) =>
      current.filter((entry) => entry !== filterId),
    );
    setFilterValues((current) => ({ ...current, [filterId]: "" }));
  }

  function updateFilterValue(filterId: OutstandingFilterId, value: string) {
    setFilterValues((current) => ({ ...current, [filterId]: value }));
  }

  function clearAllFilters() {
    setActiveFilters([]);
    setFilterValues({
      dateFrom: "",
      dateTo: "",
      customerName: "",
      invoiceNumber: "",
      status: "",
    });
  }

  const filteredOutstandings = useMemo(() => {
    const customerQuery = deferredCustomerNameFilter.trim().toLowerCase();
    const invoiceQuery = deferredInvoiceNumberFilter.trim().toLowerCase();

    return data.outstandings.filter((entry) => {
      if (
        activeFilterSet.has("dateFrom") &&
        filterValues.dateFrom &&
        entry.date < filterValues.dateFrom
      ) {
        return false;
      }

      if (
        activeFilterSet.has("dateTo") &&
        filterValues.dateTo &&
        entry.date > filterValues.dateTo
      ) {
        return false;
      }

      if (
        activeFilterSet.has("customerName") &&
        customerQuery &&
        !entry.customerName.toLowerCase().includes(customerQuery)
      ) {
        return false;
      }

      if (
        activeFilterSet.has("invoiceNumber") &&
        invoiceQuery &&
        !entry.invoiceNumber.toLowerCase().includes(invoiceQuery)
      ) {
        return false;
      }

      if (
        activeFilterSet.has("status") &&
        filterValues.status &&
        entry.status !== filterValues.status
      ) {
        return false;
      }

      return true;
    });
  }, [
    activeFilterSet,
    data.outstandings,
    deferredCustomerNameFilter,
    deferredInvoiceNumberFilter,
    filterValues.dateFrom,
    filterValues.dateTo,
    filterValues.status,
  ]);

  const filteredRows = useMemo<OutstandingTableRow[]>(
    () =>
      filteredOutstandings.map((entry, index) => ({
        serialNumber: index + 1,
        date: formatDisplayDate(entry.date),
        invoiceNumber: entry.invoiceNumber,
        customerName: entry.customerName,
        balanceAmount: entry.balanceAmount,
        paidAmount: entry.paidAmount,
        remainingAmount: Math.max(0, entry.balanceAmount - entry.paidAmount),
        status: entry.status,
        settlements: formatSettlementList(entry.settlements),
      })),
    [filteredOutstandings],
  );

  function handleExport(format: "xlsx" | "pdf") {
    if (filteredRows.length === 0) {
      return;
    }

    if (format === "xlsx") {
      exportOutstandingsAsXlsx(filteredRows);
      return;
    }

    exportOutstandingsAsPdf(filteredRows);
  }

  const totalPending = useMemo(
    () =>
      data.outstandings
        .filter((e) => e.status === "pending")
        .reduce(
          (sum, e) => sum + Math.max(0, e.balanceAmount - e.paidAmount),
          0,
        ),
    [data.outstandings],
  );

  const totalPaid = useMemo(
    () => data.outstandings.reduce((sum, e) => sum + e.paidAmount, 0),
    [data.outstandings],
  );

  return (
    <section className="panel-grid two-col">
      <article className="panel span-panel-two">
        <div className="panel-heading">
          <h3>Customer Outstandings</h3>
          <span>
            {filteredOutstandings.length} of {data.outstandings.length} entries
          </span>
        </div>
        <div className="summary-row top-gap">
          <div className="summary-chip">
            <span className="summary-label">Total Pending</span>
            <strong className="summary-value">
              {formatMoney(totalPending, data.shop.currency)}
            </strong>
          </div>
          <div className="summary-chip">
            <span className="summary-label">Total Paid</span>
            <strong className="summary-value">
              {formatMoney(totalPaid, data.shop.currency)}
            </strong>
          </div>
        </div>
        <div className="issued-invoice-filter-bar top-gap">
          <div className="issued-invoice-filters">
            <select
              value=""
              onChange={(event) => {
                const filterId = event.target.value as OutstandingFilterId;
                if (filterId) {
                  addFilter(filterId);
                }
              }}
              aria-label="Add filter"
            >
              <option value="">Add filter</option>
              {outstandingFilterOptions
                .filter((option) => !activeFilterSet.has(option.id))
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="issued-invoice-applied-filters">
            {activeFilters.map((filterId) => {
              const option = outstandingFilterOptions.find(
                (entry) => entry.id === filterId,
              );
              if (!option) {
                return null;
              }

              return (
                <div key={filterId} className="issued-invoice-filter-chip">
                  {(option.label === "Start" || option.label === "End") && (
                    <span className="filter-chip-label">{option.label}</span>
                  )}{" "}
                  <div className="issued-invoice-filter-input-wrap">
                    {option.inputType === "select" ? (
                      <select
                        value={filterValues[filterId]}
                        onChange={(event) =>
                          updateFilterValue(filterId, event.target.value)
                        }
                        aria-label={`Filter by ${option.label.toLowerCase()}`}
                      >
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="settled">Settled</option>
                      </select>
                    ) : (
                      <input
                        className={
                          option.inputType === "text"
                            ? "search-input"
                            : undefined
                        }
                        type={option.inputType}
                        placeholder={option.placeholder}
                        value={filterValues[filterId]}
                        onChange={(event) =>
                          updateFilterValue(filterId, event.target.value)
                        }
                        aria-label={`Filter by ${option.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                  <button
                    className="issued-invoice-filter-remove"
                    onClick={() => removeFilter(filterId)}
                    aria-label={`Remove ${option.label} filter`}
                    title={`Remove ${option.label} filter`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <button
            className="ghost-button issued-invoice-clear-button"
            onClick={clearAllFilters}
            disabled={activeFilters.length === 0}
          >
            Clear all
          </button>
        </div>
        <div className="issued-invoice-export-row top-gap">
          <button
            className="secondary-button"
            onClick={() => handleExport("xlsx")}
            disabled={filteredRows.length === 0}
          >
            Export Excel
          </button>
          <button
            className="ghost-button"
            onClick={() => handleExport("pdf")}
            disabled={filteredRows.length === 0}
          >
            Export PDF
          </button>
        </div>
        <div className="table-wrap tall top-gap">
          <table>
            <thead>
              <tr>
                <th>S.N</th>
                <th>Date</th>
                <th>Invoice Number</th>
                <th>Customer Name</th>
                <th>Balance</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Settlements</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutstandings.map((entry, index) => (
                <tr key={entry.id}>
                  <td>{index + 1}</td>
                  <td>{formatDisplayDate(entry.date)}</td>
                  <td>{entry.invoiceNumber}</td>
                  <td>{entry.customerName}</td>
                  <td>
                    {formatMoney(entry.balanceAmount, data.shop.currency)}
                  </td>
                  <td>{formatMoney(entry.paidAmount, data.shop.currency)}</td>
                  <td>
                    <strong>
                      {formatMoney(
                        Math.max(0, entry.balanceAmount - entry.paidAmount),
                        data.shop.currency,
                      )}
                    </strong>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${entry.status}`}
                      style={{
                        textTransform: "capitalize",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background:
                          entry.status === "pending" ? "#FEF3C7" : "#D1FAE5",
                        color:
                          entry.status === "pending" ? "#92400E" : "#065F46",
                      }}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td>
                    <SettlementPopover
                      settlements={entry.settlements}
                      currency={data.shop.currency}
                    />
                  </td>
                  <td>
                    {entry.status === "pending" && (
                      <button
                        className="ghost-button icon-button-shell"
                        onClick={() => {
                          if (
                            confirm(
                              `Settle outstanding for ${entry.invoiceNumber}?\nRemaining: ${formatMoney(Math.max(0, entry.balanceAmount - entry.paidAmount), data.shop.currency)}`,
                            )
                          ) {
                            onSettle?.(entry.id);
                          }
                        }}
                        aria-label={`Settle ${entry.invoiceNumber}`}
                        title="Settle"
                      >
                        <CheckIcon />
                      </button>
                    )}
                    <button
                      className="ghost-button icon-button-shell"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete outstanding entry for ${entry.invoiceNumber}? This will ${entry.status === "pending" ? "revert the customer balance" : "remove the record"}.`,
                          )
                        ) {
                          onDelete?.(entry.id);
                        }
                      }}
                      aria-label={`Delete ${entry.invoiceNumber}`}
                      title="Delete"
                      disabled={entry.status == "settled"}
                    >
                      <DeleteIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOutstandings.length === 0 && (
            <p className="empty-state issued-invoice-empty-state">
              No outstanding entries match the selected filters.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
