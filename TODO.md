# TODO: Implement Actual CRUD Operations on Actions in UI

## Plan Overview
Replace in-memory CRUD with actual database operations for persistence, improving data integrity and performance.

## Current Architecture Issues
- Every CRUD operation loads all data from DB, modifies in-memory, and saves everything back
- Using `setData()` + auto-save via `useEffect` is wasteful and can lead to race conditions

## Implementation Steps

### Step 1: Extend db.cjs with individual CRUD functions
- [ ] Add `addProduct(product)` - Insert a single product
- [ ] Add `updateProduct(product)` - Update a single product  
- [ ] Add `deleteProduct(productId)` - Delete/archive a product
- [ ] Add `addCustomer(customer)` - Insert a single customer
- [ ] Add `updateCustomer(customer)` - Update a single customer
- [ ] Add `deleteCustomer(customerId)` - Delete/archive a customer
- [ ] Add `addSupplier(supplier)` - Insert a single supplier
- [ ] Add `updateSupplier(supplier)` - Update a single supplier
- [ ] Add `deleteSupplier(supplierId)` - Delete/archive a supplier
- [ ] Add `recordPurchase(purchase)` - Insert a single purchase
- [ ] Add `updatePurchase(purchase)` - Update a single purchase
- [ ] Add `deletePurchase(purchaseId)` - Delete a purchase
- [ ] Add `createSale(sale, items)` - Insert a sale with items
- [ ] Add `updateSale(sale, items)` - Update a sale with items
- [ ] Add `deleteSale(saleId)` - Delete a sale and associated data
- [ ] Add `settleOutstanding(entryId, amount, date)` - Settle partial/full amount
- [ ] Add `deleteOutstanding(entryId)` - Delete outstanding entry
- [ ] Add `updateShopProfile(shop)` - Update shop profile

### Step 2: Extend preload.cjs with individual CRUD methods
- [ ] Expose all CRUD methods via `window.aurumDesktop.data` API

### Step 3: Add IPC handlers in main.cjs
- [ ] Register CRUD IPC handlers for all operations

### Step 4: Update storage.ts to support direct CRUD
- [ ] Add optional CRUD method exports alongside load/save
- [ ] Handle both desktop and browser modes

### Step 5: Rewrite useShopData.ts for direct CRUD
- [ ] Remove auto-save useEffect dependency
- [ ] Each CRUD function calls database directly
- [ ] Keep in-memory state for UI reactivity but no auto-save

## Verification
- [ ] Rebuild Electron app
- [ ] Test all CRUD operations
- [ ] Verify data persists after app restart
- [ ] Verify offline mode still works with localStorage fallback
