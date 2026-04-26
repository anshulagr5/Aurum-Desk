import { useEffect, useState, type ChangeEvent } from "react";
import type { AppData } from "../../types";

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SettingsView({
  data,
  onSaveShop,
  onExport,
  onImportClick,
  onReset,
}: {
  data: AppData;
  onSaveShop: (shop: AppData["shop"]) => boolean;
  onExport: () => void;
  onImportClick: () => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<AppData["shop"]>(data.shop);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDraft(data.shop);
    setIsEditing(false);
  }, [data.shop]);

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      event.target.value = "";
      return;
    }

    const imageDataUrl = await readImageFile(file);
    setDraft((current) => ({ ...current, invoiceLogoDataUrl: imageDataUrl }));
    event.target.value = "";
  }

  function updateDraft(field: keyof AppData["shop"], value: string | number) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleChooseInvoiceFolder() {
    if (!isEditing) {
      return;
    }

    const selectedDirectory =
      await window.aurumDesktop?.invoice?.selectDirectory(
        draft.invoiceSaveDirectory,
      );
    if (selectedDirectory) {
      setDraft((current) => ({
        ...current,
        invoiceSaveDirectory: selectedDirectory,
      }));
    }
  }

  function handleSaveProfile() {
    const ok = onSaveShop(draft);
    if (ok) {
      setIsEditing(false);
    }
  }

  function handleCancelEdit() {
    setDraft(data.shop);
    setIsEditing(false);
  }

  function handleResetClick() {
    const confirmed = window.confirm(
      "Reset all data? This will permanently remove products, customers, vendors, purchases and invoices from this device.",
    );
    if (!confirmed) {
      return;
    }

    onReset();
  }

  return (
    <section className="panel-grid two-col-wide">
      <article className="panel form-panel">
        <div className="panel-heading">
          <h3>Shop profile</h3>
          {!isEditing && (
            <button
              className="secondary-button"
              onClick={() => setIsEditing(true)}
            >
              Edit profile
            </button>
          )}
        </div>
        <div className="form-grid">
          <label>
            <span>Shop name</span>
            <input
              disabled={!isEditing}
              value={draft.shopName}
              onChange={(event) => updateDraft("shopName", event.target.value)}
            />
          </label>
          <label>
            <span>Phone</span>
            <input
              disabled={!isEditing}
              value={draft.phone}
              onChange={(event) => updateDraft("phone", event.target.value)}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              disabled={!isEditing}
              value={draft.email}
              onChange={(event) => updateDraft("email", event.target.value)}
            />
          </label>
          <label>
            <span>GSTIN</span>
            <input
              disabled={!isEditing}
              value={draft.gstin}
              onChange={(event) => updateDraft("gstin", event.target.value)}
            />
          </label>
          <label>
            <span>Invoice prefix</span>
            <input
              disabled={!isEditing}
              value={draft.invoicePrefix}
              onChange={(event) =>
                updateDraft("invoicePrefix", event.target.value)
              }
            />
          </label>
          <label>
            <span>Total GST rate</span>
            <input
              disabled={!isEditing}
              type="number"
              value={draft.defaultTaxRate}
              onWheel={(event) => event.currentTarget.blur()}
              onChange={(event) =>
                updateDraft("defaultTaxRate", Number(event.target.value))
              }
            />
          </label>
          <div className="span-two settings-logo-block">
            <span>Invoice logo</span>
            <div className="settings-logo-actions">
              <input
                type="file"
                accept="image/png,image/jpeg"
                disabled={!isEditing}
                onChange={handleLogoChange}
              />
              {draft.invoiceLogoDataUrl && (
                <button
                  className="ghost-button"
                  disabled={!isEditing}
                  onClick={() => updateDraft("invoiceLogoDataUrl", "")}
                >
                  Remove logo
                </button>
              )}
            </div>
            <p className="settings-note">
              Upload a PNG or JPG logo. The selected image will appear at the
              top-right of the invoice.
            </p>
            {draft.invoiceLogoDataUrl && (
              <img
                className="settings-logo-preview"
                src={draft.invoiceLogoDataUrl}
                alt="Invoice logo preview"
              />
            )}
          </div>
          <div className="span-two settings-logo-block">
            <span>Invoice save folder</span>
            {window.aurumDesktop?.isDesktop ? (
              <>
                <div className="settings-folder-row">
                  <input
                    disabled
                    value={draft.invoiceSaveDirectory || "No folder selected"}
                  />
                  <button
                    className="secondary-button"
                    disabled={!isEditing}
                    onClick={() => void handleChooseInvoiceFolder()}
                  >
                    Choose folder
                  </button>
                  {draft.invoiceSaveDirectory && (
                    <button
                      className="ghost-button"
                      disabled={!isEditing}
                      onClick={() => updateDraft("invoiceSaveDirectory", "")}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="settings-note">
                  When this folder is set, every generated invoice PDF is saved
                  there automatically.
                </p>
              </>
            ) : (
              <p className="settings-note">
                Desktop-only feature. In the browser build, invoice PDFs use the
                regular download flow.
              </p>
            )}
          </div>
          <label className="span-two">
            <span>Address</span>
            <textarea
              disabled={!isEditing}
              value={draft.address}
              onChange={(event) => updateDraft("address", event.target.value)}
            />
          </label>
          <label className="span-two">
            <span>Invoice terms</span>
            <textarea
              disabled={!isEditing}
              value={draft.invoiceTerms}
              onChange={(event) =>
                updateDraft("invoiceTerms", event.target.value)
              }
            />
          </label>
        </div>
        {isEditing && (
          <div className="action-row">
            <button className="primary-button" onClick={handleSaveProfile}>
              Save profile
            </button>
            <button className="ghost-button" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        )}
      </article>

      <article className="panel form-panel">
        <div className="panel-heading">
          <h3>Backup and transfer</h3>
        </div>
        <div className="settings-actions">
          <button className="primary-button" onClick={onExport}>
            Download full backup
          </button>
          <button className="secondary-button" onClick={onImportClick}>
            Restore from backup
          </button>
          <button
            className="ghost-button danger-button"
            onClick={handleResetClick}
          >
            Reset all data
          </button>
        </div>
        <div className="notes-block">
          <p>
            The application runs without internet and keeps data on the local
            device.
          </p>
          <p>
            Use backup export and restore to move customers, vendors, products,
            purchases and invoices to another computer.
          </p>
          <p>
            Backup includes the latest saved profile details only. Profile
            history is not stored.
          </p>
        </div>
      </article>
    </section>
  );
}
