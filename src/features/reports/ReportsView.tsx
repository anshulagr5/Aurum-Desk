import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { ReportMetric } from "../../components/ui/ReportMetric";
import { formatMoney, formatWeight } from "../../lib/format";
import { buildReportSnapshot } from "../../lib/reports";
import type { AppData } from "../../types";
import { SalesChartContainer } from "../../components/ui/SalesChartContainer";

type RangePreset =
  | "today"
  | "last-7-days"
  | "last-30-days"
  | "this-month"
  | "last-90-days"
  | "this-year"
  | "custom";

function getRangeFromPreset(preset: RangePreset) {
  const today = dayjs();

  switch (preset) {
    case "today":
      return {
        startDate: today.format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
    case "last-7-days":
      return {
        startDate: today.subtract(6, "day").format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
    case "this-month":
      return {
        startDate: today.startOf("month").format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
    case "last-90-days":
      return {
        startDate: today.subtract(89, "day").format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
    case "this-year":
      return {
        startDate: today.startOf("year").format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
    case "custom":
      return {
        startDate: today.subtract(29, "day").format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
    case "last-30-days":
    default:
      return {
        startDate: today.subtract(29, "day").format("YYYY-MM-DD"),
        endDate: today.format("YYYY-MM-DD"),
      };
  }
}

export function ReportsView({ data }: { data: AppData }) {
  const [rangePreset] = useState<RangePreset>("last-30-days");
  const defaultRange = getRangeFromPreset("last-30-days");
  const [customStartDate] = useState(defaultRange.startDate);
  const [customEndDate] = useState(defaultRange.endDate);

  const activeRange = useMemo(() => {
    if (rangePreset === "custom") {
      const fallback = getRangeFromPreset("last-30-days");
      return {
        startDate: customStartDate || fallback.startDate,
        endDate: customEndDate || fallback.endDate,
      };
    }

    return getRangeFromPreset(rangePreset);
  }, [customEndDate, customStartDate, rangePreset]);

  const snapshot = useMemo(
    () => buildReportSnapshot(data, activeRange),
    [activeRange, data],
  );

  return (
    <section className="panel-grid two-col">
      <article className="panel">
        <div className="panel-heading">
          <h3>Sales Overview</h3>
        </div>
        <SalesChartContainer data={data} />
      </article>

      <article className="panel">
        <div className="panel-heading">
          <h3>Business summary</h3>
        </div>
        <div className="report-grid">
          <ReportMetric
            label="Sales value"
            value={formatMoney(snapshot.totalSales, data.shop.currency)}
          />
          <ReportMetric
            label="Purchase value"
            value={formatMoney(snapshot.totalPurchases, data.shop.currency)}
          />
          <ReportMetric
            label="Gross spread"
            value={formatMoney(snapshot.grossMargin, data.shop.currency)}
          />
          <ReportMetric
            label="Open receivables"
            value={formatMoney(snapshot.openReceivables, data.shop.currency)}
          />
          <ReportMetric
            label="Stock weight"
            value={formatWeight(snapshot.stockWeight)}
          />
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <h3>Product Weight Movement</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Purchased weight</th>
                <th>Sold weight</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.productWeightFlow.slice(0, 12).map((entry) => (
                <tr key={entry.product}>
                  <td>{entry.product}</td>
                  <td>{formatWeight(entry.purchasedWeight)}</td>
                  <td>{formatWeight(entry.soldWeight)}</td>
                </tr>
              ))}
              {snapshot.productWeightFlow.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    No product-wise purchase or sales weight recorded for the
                    selected range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <h3>Sales by Product</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.salesByProduct.slice(0, 12).map(([product, value]) => (
                <tr key={product}>
                  <td>{product}</td>
                  <td>{formatMoney(value, data.shop.currency)}</td>
                </tr>
              ))}
              {snapshot.salesByProduct.length === 0 && (
                <tr>
                  <td colSpan={2}>
                    No product sales recorded in the report yet.
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
