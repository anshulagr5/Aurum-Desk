# Aurum Desk

Aurum Desk is an offline-first jewellery shop management application for desktop use. It stores data locally on the device, supports portable JSON backups, and includes desktop packaging through Electron.

## Core modules

- Dashboard with sales, purchase, stock and receivable metrics
- Product management with HSN, purity, weight and stock location
- Customer management with contact details, loyalty tier, address and dues
- Vendor management with GST, specialty, city and address details
- Purchase management for vendor-wise stock intake and rate updates
- Order and billing flow with line-wise rate, weight and amount calculation
- Invoice PDF generation with HSN, split CGST and SGST, and amount in words
- Reporting for category sales, customer ranking, vendor spend and top products
- Settings for invoice profile, GST rate and backup portability

## Storage

- Desktop app: data is stored in a local SQLite database through Electron.
- Browser preview: data falls back to browser localStorage.
- JSON backup export and restore remain available for portability.

On macOS, the SQLite database file is typically stored at:

```text
~/Library/Application Support/Aurum Desk/aurum-desk.sqlite
```

## Project structure

- [src/app/AppShell.tsx](src/app/AppShell.tsx): main application shell and navigation
- [src/hooks/useShopData.ts](src/hooks/useShopData.ts): central business logic and persistence integration
- [src/features/dashboard/DashboardView.tsx](src/features/dashboard/DashboardView.tsx): dashboard view
- [src/features/inventory/InventoryView.tsx](src/features/inventory/InventoryView.tsx): product module
- [src/features/customers/CustomersView.tsx](src/features/customers/CustomersView.tsx): customer module
- [src/features/suppliers/SuppliersView.tsx](src/features/suppliers/SuppliersView.tsx): vendor module
- [src/features/purchases/PurchasesView.tsx](src/features/purchases/PurchasesView.tsx): procurement module
- [src/features/sales/SalesView.tsx](src/features/sales/SalesView.tsx): order placing and invoicing module
- [src/features/reports/ReportsView.tsx](src/features/reports/ReportsView.tsx): reporting module
- [src/features/settings/SettingsView.tsx](src/features/settings/SettingsView.tsx): shop settings and backup module
- [src/storage.ts](src/storage.ts): storage normalization, backup import/export, browser fallback
- [electron/db.cjs](electron/db.cjs): SQLite database file and Electron main-process persistence
- [electron/main.cjs](electron/main.cjs): Electron window and IPC wiring
- [electron/preload.cjs](electron/preload.cjs): safe desktop bridge exposed to the renderer

## Development

Install dependencies:

```bash
npm install
```

Run the browser preview:

```bash
npm run dev
```

The browser preview is useful for UI work, but it uses browser localStorage instead of the desktop SQLite database.

Run the desktop shell:

```bash
npm run desktop
```

The desktop shell uses the Electron runtime and the local SQLite database.

Build the application:

```bash
npm run build
```

Package installers:

```bash
npm run dist
```

Installer and package output is written to the `release` directory.

## Publish and install

### Generate a release build

1. Install dependencies:

```bash
npm install
```

2. Build the renderer bundle:

```bash
npm run build
```

3. Package the desktop app and installers:

```bash
npm run dist
```

4. Collect the generated artifacts from the `release` directory.

Expected targets from the current configuration:

- macOS: `.dmg` and `.zip`
- Windows: NSIS `.exe`
- Linux: `.AppImage`

### Install the app

macOS:

1. Open the generated `.dmg`.
2. Drag `Aurum Desk.app` into `Applications`.
3. Launch the app from `Applications`.
4. If macOS blocks first launch because the app is unsigned, allow it from System Settings > Privacy & Security.

Windows:

1. Run the generated `.exe` installer.
2. Follow the setup wizard.
3. Launch Aurum Desk from the Start menu or desktop shortcut.

Linux:

1. Mark the generated `.AppImage` as executable.
2. Run the `.AppImage` file.

### Publish the app

For private distribution:

1. Generate the release artifacts with the platform-specific packaging command:

```bash
# macOS (zip)
npm run dist:mac

# Windows installer
npm run dist:win

# Linux AppImage
npm run dist:linux
```

2. Upload the installer files from `release` to your website, Google Drive, OneDrive, Dropbox, or a GitHub Release.
3. Share the appropriate installer per operating system.

For public distribution:

1. Add code signing for macOS and Windows.
2. Build signed installers.
3. Publish them through GitHub Releases, your website, or another release channel.

### Current packaging status on this machine

A packaging run was validated on this machine with:

```bash
npx electron-builder --mac zip
```

The macOS zip build now completes successfully and writes the desktop package to `release/Aurum Desk-1.0.0-arm64-mac.zip`.

The DMG target was removed from the macOS build on this machine because the network environment was returning HTTP `403` during the DMG packaging stage. Zip packaging remains valid for installation and private distribution.

The application now includes dedicated platform icons from the `build` folder:

1. `build/icon.icns` for macOS.
2. `build/icon.ico` for Windows.
3. `build/icon.png` for Linux.

### Install the packaged app

On macOS:

1. Run `npm run dist:mac`.
2. Open the generated zip from `release`.
3. Drag `Aurum Desk.app` into `Applications`.
4. On first launch, if Gatekeeper warns because the app is ad-hoc signed, right-click the app and choose Open.

On Windows:

1. Run `npm run dist:win` on a Windows machine.
2. Open the generated `.exe` installer from `release`.
3. Follow the installer prompts.

On Linux:

1. Run `npm run dist:linux` on a Linux machine.
2. Mark the generated `.AppImage` as executable.
3. Run the `.AppImage` file.

## Data portability

All business records are stored locally. To move the application to another device:

1. Install the application on the other computer.
2. Export a backup JSON file from the current device.
3. Restore that backup inside the new installation.
