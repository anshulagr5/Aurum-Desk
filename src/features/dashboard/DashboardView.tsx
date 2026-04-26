import type { AppData, Sale } from "../../types";
import { formatMoney } from "../../lib/format";
import { SalesChartContainer } from "../../components/ui/SalesChartContainer";

export function DashboardView({ data }: { data: AppData }) {
  return (
    <section className="panel-grid two-col">
      <article className="panel">
        <div className="panel-heading">
          <h3>Recent invoices</h3>
          <span>{data.sales.length} total</span>
        </div>
        <div className="table-wrap tall">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.slice(0, 6).map((sale: Sale) => (
                <tr key={sale.id}>
                  <td>{sale.invoiceNumber}</td>
                  <td>{sale.customerName}</td>
                  <td>{formatMoney(sale.total, data.shop.currency)}</td>
                  <td>{formatMoney(sale.balanceAmount, data.shop.currency)}</td>
                </tr>
              ))}
              {data.sales.length === 0 && (
                <tr>
                  <td colSpan={4}>No invoices yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      <article className="panel">
        <div className="panel-heading">
          <h3>Sales Overview</h3>
        </div>
        <SalesChartContainer data={data} />
      </article>
    </section>
  );
}
