import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MetricCard } from "../components/ui/MetricCard";
import { DashboardView } from "../features/dashboard/DashboardView";
import { CustomersView } from "../features/customers/CustomersView";
import { InventoryView } from "../features/inventory/InventoryView";
import { PurchasesView } from "../features/purchases/PurchasesView";
import { OutstandingsView } from "../features/outstandings/OutstandingsView";
import { ReportsView } from "../features/reports/ReportsView";
import { IssuedInvoicesView } from "../features/sales/IssuedInvoicesView";
import { SalesView } from "../features/sales/SalesView";
import { SettingsView } from "../features/settings/SettingsView";
import { SuppliersView } from "../features/suppliers/SuppliersView";
import { useShopData } from "../hooks/useShopData";
import { formatMoney } from "../lib/format";
import { getViewFromHash, getViewRoute, views } from "../lib/navigation";
import type { ViewId } from "../types";

const pageContent: Record<ViewId, { eyebrow: string }> = {
  dashboard: {
    eyebrow: "Dashboard",
  },
  inventory: {
    eyebrow: "Product Management",
  },
  customers: {
    eyebrow: "Customer Management",
  },
  suppliers: {
    eyebrow: "Vendor Management",
  },
  purchases: {
    eyebrow: "Purchase Entries",
  },
  sales: {
    eyebrow: "Orders & Billing",
  },
  "issued-invoices": {
    eyebrow: "Issued Invoices",
  },
  outstandings: {
    eyebrow: "Customer Outstandings",
  },
  reports: {
    eyebrow: "Business Reports",
  },
  settings: {
    eyebrow: "Shop Settings",
  },
};

function updateHashRoute(route: string) {
  window.location.hash = route;
}

function getShopInitials(shopName: string) {
  const words = shopName.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (words.length === 0) {
    return "AD";
  }

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function HamburgerIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 7h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M4 12h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NavigationIcon({ viewId }: { viewId: ViewId }) {
  switch (viewId) {
    case "dashboard":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 13.5h6.5V20H4zM13.5 4H20v7.5h-6.5zM13.5 13.5H20V20h-6.5zM4 4h6.5v6.5H4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "inventory":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M5 7.5 12 4l7 3.5-7 3.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M5 7.5V16.5L12 20l7-3.5V7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M12 11v9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "customers":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="12"
            cy="8"
            r="3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M5.5 19c1.4-3 4-4.5 6.5-4.5s5.1 1.5 6.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "suppliers":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M7 8.5h10a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 7 8.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M9 8.5V7a3 3 0 0 1 6 0v1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.5 13h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "purchases":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M7 7h12l-1.2 6.5H8.3L7 7Zm0 0L6.2 4.8H4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="18" r="1.2" fill="currentColor" />
          <circle cx="16.5" cy="18" r="1.2" fill="currentColor" />
        </svg>
      );
    case "sales":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6 8.5h9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M12.5 5.5 15.5 8.5l-3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18 15.5H8.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M11.5 12.5 8.5 15.5l3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "issued-invoices":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 4.5h8l3 3v12h-14v-15Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M16 4.5v3h3M9 11h6M9 14.5h6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "outstandings":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M7 2h10l3 3v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a3 3 0 0 1 3-3Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M17 2v3h3M8 7h8M8 10.5h5M8 14h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="16.5"
            cy="16.5"
            r="3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M16.5 14.5v2l1.5 1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "reports":
      return (
        <svg
          className="nav-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6 19V9M12 19V5M18 19v-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M4.5 19.5h15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "settings":
      return <SettingsIcon className="nav-icon" />;
  }
}

function SettingsIcon({ className = "button-icon" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.3 3.6h3.4l.4 2.4c.6.2 1.2.5 1.7.9l2.3-.9 1.7 3-2 1.6c.1.6.1 1.2 0 1.8l2 1.6-1.7 3-2.3-.9c-.5.4-1.1.7-1.7.9l-.4 2.4h-3.4l-.4-2.4c-.6-.2-1.2-.5-1.7-.9l-2.3.9-1.7-3 2-1.6c-.1-.6-.1-1.2 0-1.8l-2-1.6 1.7-3 2.3.9c.5-.4 1.1-.7 1.7-.9l.4-2.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function AppShell() {
  const [activeView, setActiveView] = useState<ViewId>(() =>
    getViewFromHash(window.location.hash),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth > 1180);
  const importRef = useRef<HTMLInputElement | null>(null);
  const {
    data,
    isReady,
    dashboardMetrics,
    exportData,
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
  } = useShopData();

  const currentPage = pageContent[activeView];
  const shopInitials = getShopInitials(data.shop.shopName);
  const startupTitle = window.aurumDesktop?.isDesktop
    ? "Loading business data from the local SQLite database."
    : "Loading business data from local device storage.";

  useEffect(() => {
    const syncViewFromHash = () => {
      setActiveView(getViewFromHash(window.location.hash));
      if (!isDesktop) {
        setSidebarOpen(false);
      }
    };

    syncViewFromHash();
    window.addEventListener("hashchange", syncViewFromHash);

    if (!window.location.hash) {
      window.location.hash = getViewRoute("sales");
    }

    return () => {
      window.removeEventListener("hashchange", syncViewFromHash);
    };
  }, [isDesktop]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1181px)");

    const syncDesktopState = (matches: boolean) => {
      setIsDesktop(matches);
      if (matches) {
        setSidebarOpen(false);
      } else {
        setSidebarHovered(false);
      }
    };

    syncDesktopState(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncDesktopState(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  function navigateToView(viewId: ViewId) {
    const route = getViewRoute(viewId);
    if (!isDesktop) {
      setSidebarOpen(false);
    }

    if (window.location.hash === route) {
      setActiveView(viewId);
      return;
    }

    updateHashRoute(route);
  }

  const sidebarExpanded = isDesktop
    ? !sidebarCollapsed || sidebarHovered
    : sidebarOpen;
  const shellClassName = [
    "shell",
    isDesktop && sidebarCollapsed ? "sidebar-collapsed" : "",
    isDesktop && sidebarExpanded ? "sidebar-expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const sidebarClassName = [
    "sidebar",
    !isDesktop && sidebarOpen ? "open" : "",
    isDesktop && sidebarCollapsed ? "collapsed" : "",
    isDesktop && sidebarExpanded ? "hover-expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const toggleSidebar = () => {
    if (isDesktop) {
      setSidebarCollapsed((current) => !current);
      setSidebarHovered(false);
      return;
    }

    setSidebarOpen((current) => !current);
  };

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await restoreFromFile(file);
    event.target.value = "";
  }

  return (
    <div className={shellClassName}>
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
        title="Toggle navigation"
      >
        <HamburgerIcon />
      </button>

      {!isDesktop && sidebarOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={sidebarClassName}
        onMouseEnter={() => {
          if (isDesktop && sidebarCollapsed) {
            setSidebarHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (isDesktop) {
            setSidebarHovered(false);
          }
        }}
      >
        <div className="sidebar-head">
          <button
            className="sidebar-brand-card"
            type="button"
            aria-hidden={isDesktop && sidebarCollapsed ? "true" : "false"}
            aria-label={isDesktop ? "Toggle navigation" : "Shop identity"}
            title={isDesktop ? "Toggle navigation" : data.shop.shopName}
            onClick={() => {
              if (isDesktop) {
                toggleSidebar();
              }
            }}
          >
            {data.shop.invoiceLogoDataUrl ? (
              <img
                className="sidebar-logo"
                src={data.shop.invoiceLogoDataUrl}
                alt={`${data.shop.shopName} logo`}
              />
            ) : (
              <div className="sidebar-logo sidebar-logo-fallback">
                {shopInitials}
              </div>
            )}
            <h1>{data.shop.shopName}</h1>
          </button>

          {isDesktop && sidebarCollapsed && !sidebarHovered && (
            <button
              className="sidebar-toggle sidebar-toggle-inline"
              onClick={toggleSidebar}
              aria-label="Toggle navigation"
              title="Toggle navigation"
            >
              <HamburgerIcon />
            </button>
          )}
        </div>

        <nav className="nav-list">
          {views.map((view) => (
            <button
              key={view.id}
              className={
                activeView === view.id ? "nav-item active" : "nav-item"
              }
              onClick={() => navigateToView(view.id)}
              aria-label={view.label}
              title={view.label}
            >
              <NavigationIcon viewId={view.id} />
              <span className="nav-label">{view.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        {!isReady && (
          <section className="hero-panel">
            <div>
              <p className="eyebrow">Database startup</p>
              <h2>{startupTitle}</h2>
            </div>
          </section>
        )}

        {isReady && (
          <section className="hero-panel">
            <div>
              <p className="hero-title">{currentPage.eyebrow}</p>
            </div>
            <div className="hero-actions">
              {activeView === "dashboard" && (
                <button
                  className="ghost-button icon-button-shell"
                  onClick={() => navigateToView("settings")}
                  aria-label="Open settings"
                  title="Open settings"
                >
                  <SettingsIcon />
                </button>
              )}
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                hidden
                onChange={handleImport}
              />
            </div>
          </section>
        )}

        {isReady && activeView === "dashboard" && (
          <section className="stats-grid">
            <MetricCard
              label="This month sales"
              value={formatMoney(
                dashboardMetrics.monthSales,
                data.shop.currency,
              )}
              hint={`${data.sales.length} invoices`}
            />
            <MetricCard
              label="This month purchases"
              value={formatMoney(
                dashboardMetrics.monthPurchases,
                data.shop.currency,
              )}
              hint={`${data.purchases.length} purchase entries`}
            />
            <MetricCard
              label="Stock weight"
              value={`${dashboardMetrics.stockWeight.toFixed(2)} g`}
              hint={`${data.products.length} products in stock`}
            />
            <MetricCard
              label="Receivables"
              value={formatMoney(
                dashboardMetrics.receivables,
                data.shop.currency,
              )}
              hint={`${data.customers.filter((customer) => customer.outstanding > 0).length} customers due`}
            />
          </section>
        )}

        {isReady && activeView === "dashboard" && <DashboardView data={data} />}
        {isReady && activeView === "dashboard" && (
          <footer className="dashboard-footer-minimal">
            <span>
              {new Date().getFullYear()} {data.shop.shopName || "Aurum Desk"}.
              All rights reserved.
            </span>
          </footer>
        )}
        {isReady && activeView === "inventory" && (
          <InventoryView
            data={data}
            onAddProduct={addProduct}
            onUpdateProduct={updateProduct}
            onDeleteProduct={deleteProduct}
          />
        )}
        {isReady && activeView === "customers" && (
          <CustomersView
            data={data}
            onAddCustomer={addCustomer}
            onUpdateCustomer={updateCustomer}
            onDeleteCustomer={deleteCustomer}
          />
        )}
        {isReady && activeView === "suppliers" && (
          <SuppliersView
            data={data}
            onAddSupplier={addSupplier}
            onUpdateSupplier={updateSupplier}
            onDeleteSupplier={deleteSupplier}
          />
        )}
        {isReady && activeView === "purchases" && (
          <PurchasesView
            data={data}
            onRecordPurchase={recordPurchase}
            onUpdatePurchase={updatePurchase}
            onDeletePurchase={deletePurchase}
          />
        )}
        {isReady && activeView === "sales" && (
          <SalesView
            data={data}
            onCreateSale={(draft, editSaleId) => createSale(draft, editSaleId)}
          />
        )}
        {isReady && activeView === "issued-invoices" && (
          <IssuedInvoicesView data={data} deleteSale={deleteSale} />
        )}
        {isReady && activeView === "outstandings" && (
          <OutstandingsView
            data={data}
            onSettle={(id: string) => {
              const entry = data.outstandings.find((o) => o.id === id);
              if (!entry) return;
              const remaining = entry.balanceAmount - entry.paidAmount;
              const input = window.prompt(
                `Settle outstanding for ${entry.invoiceNumber}\nRemaining: ${formatMoney(remaining, data.shop.currency)}\n\nEnter settlement amount:`,
                String(remaining),
              );
              if (input === null) return;
              const amount = Number(input.trim());
              if (Number.isNaN(amount) || amount <= 0) {
                window.alert("Invalid amount entered.");
                return;
              }
              settleOutstanding(id, amount);
            }}
            onDelete={deleteOutstanding}
          />
        )}
        {isReady && activeView === "reports" && <ReportsView data={data} />}
        {isReady && activeView === "settings" && (
          <SettingsView
            data={data}
            onSaveShop={saveShop}
            onExport={exportData}
            onImportClick={() => importRef.current?.click()}
            onReset={resetAllData}
          />
        )}
      </main>
    </div>
  );
}
