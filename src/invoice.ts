import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { amountToWords } from "./lib/amountInWords";
import { formatMoney } from "./lib/format";
import type { Sale, ShopProfile } from "./types";

function getDesktopInvoiceApi() {
  return window.aurumDesktop?.invoice;
}

function sanitizeInvoiceFileName(invoiceNumber: string) {
  const baseName = invoiceNumber
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ");
  const fileName = baseName || "invoice";
  return `${fileName}.pdf`;
}

function buildInvoicePdf(sale: Sale, shop: ShopProfile) {
  // A5 portrait (148 x 210 mm)
  const pdf = new jsPDF("p", "mm", "a5");
  const splitTaxRate = sale.taxRate / 2;
  const splitTaxAmount = sale.taxAmount / 2;
  const roundedTotal = Math.ceil(sale.total);
  const totalGrossWeight = sale.items.reduce(
    (sum, item) => sum + item.grossWeight,
    0,
  );
  const totalNetWeight = sale.items.reduce(
    (sum, item) => sum + item.totalWeight,
    0,
  );
  const amountInWords = amountToWords(roundedTotal, shop.currency);
  const amountText = formatMoney(roundedTotal);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const rightEdge = pageWidth - 10;
  const leftMargin = 10;
  const customerBlockHeight = 26;
  const infoBlockY = 32;
  const titleY = infoBlockY + customerBlockHeight + 5;
  const showMakingChargeColumn = sale.separateRateAndMakingCharge;

  const lineCell = (content: string, bordered = true) => ({
    content,
    styles: {
      halign: "center" as const,
      lineWidth: bordered
        ? { top: 0, right: 0.2, bottom: 0, left: 0.2 }
        : { top: 0, right: 0, bottom: 0, left: 0 },
    },
  });

  const summaryCell = (
    content: string,
    fontStyle: "bold" | "normal",
    bordered = true,
  ) => ({
    content,
    styles: {
      halign: "center" as const,
      fontStyle,
      lineWidth: bordered
        ? { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 }
        : { top: 0, right: 0, bottom: 0, left: 0 },
    },
  });

  const summaryLabelCell = (content: string, fontStyle: "bold" | "normal") => ({
    content,
    styles: {
      halign: "center" as const,
      fontStyle,
      lineWidth: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    },
  });

  const totalsRowCell = (
    content: string,
    fontStyle: "bold" | "normal" = "normal",
  ) => ({
    content,
    styles: {
      halign: "center" as const,
      fontStyle,
      lineWidth: { top: 0.2, right: 0.2, bottom: 0.35, left: 0.2 },
    },
  });

  // Header
  pdf.setTextColor(34, 31, 28);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(shop.shopName, leftMargin, 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(pdf.splitTextToSize(shop.address, 80), leftMargin, 16);
  pdf.text(`Phone: ${shop.phone}`, leftMargin, 22);
  pdf.text(`GSTIN: ${shop.gstin}`, 55, 22);

  if (shop.invoiceLogoDataUrl) {
    pdf.addImage(
      shop.invoiceLogoDataUrl,
      getImageFormat(shop.invoiceLogoDataUrl),
      110,
      8,
      28,
      12,
    );
  }

  pdf.setDrawColor(90, 72, 58);
  pdf.setLineWidth(0.3);
  pdf.line(leftMargin, 25, pageWidth - 10, 25);

  // Customer block
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("To,", leftMargin + 2, infoBlockY + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(
    sale.customerName
      ? `Customer Name: ${sale.customerName}`
      : "Customer Name: -",
    leftMargin + 2,
    infoBlockY + 8,
  );
  pdf.text(
    sale.customerPhone ? `Mobile: ${sale.customerPhone}` : "Mobile: -",
    leftMargin + 2,
    infoBlockY + 12,
  );
  pdf.text(
    sale.customerAddress ? `Address: ${sale.customerAddress}` : "Address: N/A",
    leftMargin + 2,
    infoBlockY + 16,
  );

  // Invoice info block
  pdf.setFont("helvetica", "bold");
  pdf.text("Invoice No:", 100, infoBlockY + 5);
  pdf.text("Invoice Amt:", 100, infoBlockY + 10);
  pdf.text("Date:", 100, infoBlockY + 15);
  pdf.setFont("helvetica", "normal");
  pdf.text(sale.invoiceNumber, rightEdge, infoBlockY + 5, { align: "right" });
  pdf.text(amountText, rightEdge, infoBlockY + 10, { align: "right" });
  pdf.text(sale.date, rightEdge, infoBlockY + 15, { align: "right" });

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("TAX INVOICE", pageWidth / 2, titleY, { align: "center" });

  // Table setup
  const tableHead = showMakingChargeColumn
    ? [
        [
          "S.N.",
          "HSN",
          "Product",
          "Qty",
          "Gross Wt",
          "Net Wt",
          "Rate/Gm",
          "Making/Gm",
          "Other Chg.",
          "Amount",
        ],
      ]
    : [
        [
          "S.N.",
          "HSN",
          "Product",
          "Qty",
          "Gross Wt",
          "Net Wt",
          "Rate/Gm",
          "Other Chg.",
          "Amount",
        ],
      ];

  const tableBody = sale.items.map((item, index) => {
    const netWeight = Math.max(item.grossWeight - item.stoneWeight, 0);
    const baseRow = [
      lineCell(String(index + 1)),
      lineCell(item.hsn),
      lineCell(item.productName),
      lineCell(item.quantity.toFixed(0)),
      lineCell(`${item.grossWeight.toFixed(2)} g`),
      lineCell(`${netWeight.toFixed(2)} g`),
      lineCell(formatMoney(item.unitPrice)),
    ];

    if (showMakingChargeColumn) {
      return [
        ...baseRow,
        lineCell(formatMoney(item.makingCharge)),
        lineCell(formatMoney(item.otherCharges)),
        lineCell(formatMoney(item.lineTotal)),
      ];
    }

    return [
      ...baseRow,
      lineCell(formatMoney(item.otherCharges)),
      lineCell(formatMoney(item.lineTotal)),
    ];
  });

  const fillerRowCount = Math.max(0, 8 - sale.items.length);
  const fillerRows = Array.from({ length: fillerRowCount }, () =>
    Array.from({ length: tableHead[0].length }, () => lineCell("")),
  );

  const totalAmount = formatMoney(roundedTotal);

  const grandTotalsRow = (() => {
    const cols = tableHead[0].length;
    const row = Array.from({ length: cols }, () => totalsRowCell("", "bold"));

    row[2] = {
      content: "Total",
      colSpan: 2,
      styles: {
        halign: "center",
        fontStyle: "bold",
        lineWidth: { top: 0.3, right: 0, bottom: 0.4, left: 0.3 },
      },
    } as any;

    row[3] = totalsRowCell(`${totalGrossWeight.toFixed(2)} g`, "bold");
    row[4] = totalsRowCell(`${totalNetWeight.toFixed(2)} g`, "bold");

    row[cols - 1] = totalsRowCell(totalAmount, "bold");

    return row;
  })();

  const summaryRows = [
    ["SubTotal", formatMoney(sale.subtotal)],
    ["Discount", formatMoney(sale.discount)],
    [`CGST @${splitTaxRate}%`, formatMoney(splitTaxAmount)],
    [`SGST @${splitTaxRate}%`, formatMoney(splitTaxAmount)],
    ["Net Amount", formatMoney(roundedTotal)],
  ].map(([label, value], index, rows) => {
    const fontStyle: "bold" | "normal" =
      index === rows.length - 1 ? "bold" : "normal";
    const labelColIdx = showMakingChargeColumn
      ? tableHead[0].length - 2
      : tableHead[0].length - 2;
    const row = Array.from({ length: labelColIdx }, () =>
      summaryCell("", fontStyle, false),
    );
    row.push(summaryLabelCell(label, fontStyle));
    row.push(summaryCell(value, fontStyle));
    return row;
  });

  const columnStyles = showMakingChargeColumn
    ? {
        0: { cellWidth: 8, halign: "center" as const },
        1: { cellWidth: 9, halign: "center" as const },
        2: { cellWidth: 28, halign: "center" as const },
        3: { cellWidth: 8, halign: "center" as const },
        4: { cellWidth: 11, halign: "center" as const },
        5: { cellWidth: 11, halign: "center" as const },
        6: { cellWidth: 14, halign: "center" as const },
        7: { cellWidth: 12, halign: "center" as const },
        8: { cellWidth: 14, halign: "center" as const },
        9: { cellWidth: 14, halign: "center" as const },
      }
    : {
        0: { cellWidth: 8, halign: "center" as const },
        1: { cellWidth: 9, halign: "center" as const },
        2: { cellWidth: 32, halign: "center" as const },
        3: { cellWidth: 8, halign: "center" as const },
        4: { cellWidth: 11, halign: "center" as const },
        5: { cellWidth: 11, halign: "center" as const },
        6: { cellWidth: 14, halign: "center" as const },
        7: { cellWidth: 14, halign: "center" as const },
        8: { cellWidth: 14, halign: "center" as const },
      };

  const tableTotalWidth = Object.values(columnStyles).reduce(
    (sum: number, col: any) => sum + (col.cellWidth || 0),
    0,
  );

  const horizontalMargin = Math.max(10, (pageWidth - tableTotalWidth) / 2);

  autoTable(pdf, {
    startY: titleY + 4,
    theme: "grid",
    head: tableHead,
    body: [...tableBody, ...fillerRows, grandTotalsRow, ...summaryRows],
    headStyles: {
      fillColor: [235, 224, 205],
      textColor: [34, 31, 28],
      lineColor: [90, 72, 58],
      lineWidth: 0.2,
      fontStyle: "bold",
      halign: "center",
      fontSize: 7.5,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      lineColor: [90, 72, 58],
      lineWidth: 0.2,
      textColor: [34, 31, 28],
      halign: "center",
      valign: "middle",
    },
    columnStyles: columnStyles as any,

    margin: {
      left: horizontalMargin,
      right: horizontalMargin,
    },
  });

  const tableBottom =
    (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 110;

  const amountLabelY = tableBottom + 8;
  const amountLines = pdf.splitTextToSize(amountInWords, 80);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("Amount Chargeable (in words)", leftMargin, amountLabelY-20);
  pdf.setFont("helvetica", "normal");
  pdf.text(amountLines, leftMargin, amountLabelY -16);

  const termsLabelY = amountLabelY + 8 + amountLines.length * 3;
  const termsLines = pdf.splitTextToSize(shop.invoiceTerms, 80);

  pdf.setFont("helvetica", "bold");
  pdf.text("Terms & Conditions", leftMargin, termsLabelY-15);
  pdf.setFont("helvetica", "normal");
  pdf.text(termsLines, leftMargin, termsLabelY);

  const signatureY = Math.max(
    tableBottom + 12,
    termsLabelY + 10 + termsLines.length * 3,
  )-5;
  pdf.setFont("helvetica", "bold");
  pdf.text(`For ${shop.shopName}`, rightEdge-2, signatureY-10, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.text("Authorised Signatory", rightEdge-2, signatureY, { align: "right" });

  return pdf;
}

function getImageFormat(dataUrl: string) {
  if (dataUrl.startsWith("data:image/png")) {
    return "PNG";
  }
  return "JPEG";
}

export function generateInvoicePdf(sale: Sale, shop: ShopProfile) {
  const pdf = buildInvoicePdf(sale, shop);
  const desktopInvoiceApi = getDesktopInvoiceApi();

  if (desktopInvoiceApi && shop.invoiceSaveDirectory) {
    const buffer = pdf.output("arraybuffer") as ArrayBuffer;

    return desktopInvoiceApi
      .savePdf({
        directoryPath: shop.invoiceSaveDirectory,
        fileName: sanitizeInvoiceFileName(sale.invoiceNumber),
        buffer,
      })
      .catch(() => {
        pdf.save(sanitizeInvoiceFileName(sale.invoiceNumber));
        return undefined;
      });
  }

  pdf.save(sanitizeInvoiceFileName(sale.invoiceNumber));
  return Promise.resolve(undefined);
}

export function previewInvoicePdf(sale: Sale, shop: ShopProfile) {
  const pdf = buildInvoicePdf(sale, shop);
  const blobUrl = pdf.output("bloburl");
  window.open(blobUrl, "_blank", "noopener,noreferrer");
}
