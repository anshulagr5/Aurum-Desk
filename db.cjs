const fs = require('node:fs/promises')
const path = require('node:path')
const { app } = require('electron')

const DB_FILE_NAME = 'aurum-desk.sqlite'

let sqlJsPromise
let databasePromise

function getDatabasePath() {
  return path.join(app.getPath('userData'), DB_FILE_NAME)
}

function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = import('sql.js').then(async ({ default: initSqlJs }) => {
      const wasmFilePath = require.resolve('sql.js/dist/sql-wasm.wasm')
      return initSqlJs({
        locateFile: () => wasmFilePath,
      })
    })
  }

  return sqlJsPromise
}

function runStatement(statement, rows, mapRow) {
  try {
    rows.forEach((row) => {
      statement.run(mapRow(row))
    })
  } finally {
    statement.free()
  }
}

function queryRows(database, sql, params = {}) {
  const statement = database.prepare(sql)

  try {
    statement.bind(params)
    const rows = []
    while (statement.step()) {
      rows.push(statement.getAsObject())
    }
    return rows
  } finally {
    statement.free()
  }
}

function ensureSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS shop_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      gstin TEXT NOT NULL,
      currency TEXT NOT NULL,
      invoice_prefix TEXT NOT NULL,
      invoice_sequence INTEGER NOT NULL,
      default_tax_rate REAL NOT NULL,
      invoice_terms TEXT NOT NULL,
      invoice_logo_data_url TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      hsn TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      purity TEXT NOT NULL,
      gross_weight REAL NOT NULL,
      stone_weight REAL NOT NULL,
      stock_qty REAL NOT NULL,
      location TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      loyalty_id TEXT NOT NULL,
      outstanding REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      gstin TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      bill_number TEXT NOT NULL,
      date TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      notes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      date TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL DEFAULT '',
      customer_address TEXT NOT NULL DEFAULT '',
      subtotal REAL NOT NULL,
      discount REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      balance_amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      notes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      sale_id TEXT NOT NULL,
      line_index INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      hsn TEXT NOT NULL,
      quantity REAL NOT NULL,
      gross_weight REAL NOT NULL,
      total_weight REAL NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      PRIMARY KEY (sale_id, line_index),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );
  `)

  const shopProfileColumns = queryRows(database, 'PRAGMA table_info(shop_profile)').map((row) => row.name)
  if (!shopProfileColumns.includes('invoice_logo_data_url')) {
    database.exec("ALTER TABLE shop_profile ADD COLUMN invoice_logo_data_url TEXT NOT NULL DEFAULT '';")
  }

  const salesColumns = queryRows(database, 'PRAGMA table_info(sales)').map((row) => row.name)
  if (!salesColumns.includes('customer_phone')) {
    database.exec("ALTER TABLE sales ADD COLUMN customer_phone TEXT NOT NULL DEFAULT '';")
  }
  if (!salesColumns.includes('customer_address')) {
    database.exec("ALTER TABLE sales ADD COLUMN customer_address TEXT NOT NULL DEFAULT '';")
  }
}

async function openDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const SQL = await getSqlJs()
      let database

      try {
        const fileBuffer = await fs.readFile(getDatabasePath())
        database = new SQL.Database(fileBuffer)
      } catch {
        database = new SQL.Database()
      }

      ensureSchema(database)
      return database
    })()
  }

  return databasePromise
}

async function persistDatabase(database) {
  await fs.mkdir(path.dirname(getDatabasePath()), { recursive: true })
  await fs.writeFile(getDatabasePath(), Buffer.from(database.export()))
}

function mapShop(row) {
  if (!row) {
    return null
  }

  return {
    shopName: row.shop_name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    gstin: row.gstin,
    currency: row.currency,
    invoicePrefix: row.invoice_prefix,
    invoiceSequence: Number(row.invoice_sequence),
    defaultTaxRate: Number(row.default_tax_rate),
    invoiceTerms: row.invoice_terms,
    invoiceLogoDataUrl: row.invoice_logo_data_url ?? '',
  }
}

async function loadData() {
  const database = await openDatabase()
  const shop = mapShop(queryRows(database, 'SELECT * FROM shop_profile WHERE id = 1')[0])

  if (!shop) {
    return null
  }

  const products = queryRows(database, 'SELECT * FROM products ORDER BY name ASC').map((row) => ({
    id: row.id,
    hsn: row.hsn,
    name: row.name,
    category: row.category,
    purity: row.purity,
    grossWeight: Number(row.gross_weight),
    stoneWeight: Number(row.stone_weight),
    stockQty: Number(row.stock_qty),
    location: row.location,
  }))

  const customers = queryRows(database, 'SELECT * FROM customers ORDER BY name ASC').map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    address: row.address,
    loyaltyId: row.loyalty_id,
    outstanding: Number(row.outstanding),
  }))

  const customerMap = new Map(customers.map((customer) => [customer.id, customer]))

  const suppliers = queryRows(database, 'SELECT * FROM suppliers ORDER BY name ASC').map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    address: row.address,
    gstin: row.gstin,
  }))

  const purchases = queryRows(database, 'SELECT * FROM purchases ORDER BY date DESC, bill_number DESC').map((row) => ({
    id: row.id,
    billNumber: row.bill_number,
    date: row.date,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    totalCost: Number(row.total_cost),
    notes: row.notes,
  }))

  const sales = queryRows(database, 'SELECT * FROM sales ORDER BY date DESC, invoice_number DESC').map((row) => ({
    customer: customerMap.get(row.customer_id),
    id: row.id,
    invoiceNumber: row.invoice_number,
    date: row.date,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || customerMap.get(row.customer_id)?.phone || '',
    customerAddress: row.customer_address || customerMap.get(row.customer_id)?.address || '',
    items: queryRows(
      database,
      'SELECT * FROM sale_items WHERE sale_id = $saleId ORDER BY line_index ASC',
      { $saleId: row.id },
    ).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      hsn: item.hsn,
      quantity: Number(item.quantity),
      grossWeight: Number(item.gross_weight),
      totalWeight: Number(item.total_weight),
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    })),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    paidAmount: Number(row.paid_amount),
    balanceAmount: Number(row.balance_amount),
    paymentMode: row.payment_mode,
    notes: row.notes,
  })).map(({ customer: _customer, ...sale }) => sale)

  return {
    shop,
    products,
    customers,
    suppliers,
    purchases,
    sales,
  }
}

async function saveData(data) {
  const database = await openDatabase()

  database.run('BEGIN TRANSACTION')

  try {
    database.run('DELETE FROM sale_items')
    database.run('DELETE FROM sales')
    database.run('DELETE FROM purchases')
    database.run('DELETE FROM suppliers')
    database.run('DELETE FROM customers')
    database.run('DELETE FROM products')
    database.run('DELETE FROM shop_profile')

    database.run(
      `
        INSERT INTO shop_profile (
          id,
          shop_name,
          owner_name,
          address,
          phone,
          email,
          gstin,
          currency,
          invoice_prefix,
          invoice_sequence,
          default_tax_rate,
          invoice_terms,
          invoice_logo_data_url
        ) VALUES (
          1,
          $shopName,
          $address,
          $phone,
          $email,
          $gstin,
          $currency,
          $invoicePrefix,
          $invoiceSequence,
          $defaultTaxRate,
          $invoiceTerms,
          $invoiceLogoDataUrl
        )
      `,
      {
        $shopName: data.shop.shopName,
        $address: data.shop.address,
        $phone: data.shop.phone,
        $email: data.shop.email,
        $gstin: data.shop.gstin,
        $currency: data.shop.currency,
        $invoicePrefix: data.shop.invoicePrefix,
        $invoiceSequence: data.shop.invoiceSequence,
        $defaultTaxRate: data.shop.defaultTaxRate,
        $invoiceTerms: data.shop.invoiceTerms,
        $invoiceLogoDataUrl: data.shop.invoiceLogoDataUrl,
      },
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO products (id, hsn, name, category, purity, gross_weight, stone_weight, stock_qty, location)
          VALUES ($id, $hsn, $name, $category, $purity, $grossWeight, $stoneWeight, $stockQty, $location)
        `,
      ),
      data.products,
      (product) => ({
        $id: product.id,
        $hsn: product.hsn,
        $name: product.name,
        $category: product.category,
        $purity: product.purity,
        $grossWeight: product.grossWeight,
        $stoneWeight: product.stoneWeight,
        $stockQty: product.stockQty,
        $location: product.location,
      }),
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO customers (id, name, phone, email, city, address, loyalty_id, outstanding)
          VALUES ($id, $name, $phone, $email, $city, $address, $loyaltyId, $outstanding)
        `,
      ),
      data.customers,
      (customer) => ({
        $id: customer.id,
        $name: customer.name,
        $phone: customer.phone,
        $email: customer.email,
        $city: customer.city,
        $address: customer.address,
        $loyaltyId: customer.loyaltyId,
        $outstanding: customer.outstanding,
      }),
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO suppliers (id, name, phone, email, city, address, gstin)
          VALUES ($id, $name, $phone, $email, $city, $address, $gstin)
        `,
      ),
      data.suppliers,
      (supplier) => ({
        $id: supplier.id,
        $name: supplier.name,
        $phone: supplier.phone,
        $email: supplier.email,
        $city: supplier.city,
        $address: supplier.address,
        $gstin: supplier.gstin,
      }),
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO purchases (
            id,
            bill_number,
            date,
            supplier_id,
            supplier_name,
            product_id,
            product_name,
            quantity,
            unit_cost,
            total_cost,
            notes
          ) VALUES (
            $id,
            $billNumber,
            $date,
            $supplierId,
            $supplierName,
            $productId,
            $productName,
            $quantity,
            $unitCost,
            $totalCost,
            $notes
          )
        `,
      ),
      data.purchases,
      (purchase) => ({
        $id: purchase.id,
        $billNumber: purchase.billNumber,
        $date: purchase.date,
        $supplierId: purchase.supplierId,
        $supplierName: purchase.supplierName,
        $productId: purchase.productId,
        $productName: purchase.productName,
        $quantity: purchase.quantity,
        $unitCost: purchase.unitCost,
        $totalCost: purchase.totalCost,
        $notes: purchase.notes,
      }),
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO sales (
            id,
            invoice_number,
            date,
            customer_id,
            customer_name,
            customer_phone,
            customer_address,
            subtotal,
            discount,
            tax_amount,
            total,
            paid_amount,
            balance_amount,
            payment_mode,
            notes
          ) VALUES (
            $id,
            $invoiceNumber,
            $date,
            $customerId,
            $customerName,
            $customerPhone,
            $customerAddress,
            $subtotal,
            $discount,
            $taxAmount,
            $total,
            $paidAmount,
            $balanceAmount,
            $paymentMode,
            $notes
          )
        `,
      ),
      data.sales,
      (sale) => ({
        $id: sale.id,
        $invoiceNumber: sale.invoiceNumber,
        $date: sale.date,
        $customerId: sale.customerId,
        $customerName: sale.customerName,
        $customerPhone: sale.customerPhone,
        $customerAddress: sale.customerAddress,
        $subtotal: sale.subtotal,
        $discount: sale.discount,
        $taxAmount: sale.taxAmount,
        $total: sale.total,
        $paidAmount: sale.paidAmount,
        $balanceAmount: sale.balanceAmount,
        $paymentMode: sale.paymentMode,
        $notes: sale.notes,
      }),
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO sale_items (
            sale_id,
            line_index,
            product_id,
            product_name,
            hsn,
            quantity,
            gross_weight,
            total_weight,
            unit_price,
            line_total
          ) VALUES (
            $saleId,
            $lineIndex,
            $productId,
            $productName,
            $hsn,
            $quantity,
            $grossWeight,
            $totalWeight,
            $unitPrice,
            $lineTotal
          )
        `,
      ),
      data.sales.flatMap((sale) => sale.items.map((item, lineIndex) => ({ saleId: sale.id, lineIndex, item }))),
      ({ saleId, lineIndex, item }) => ({
        $saleId: saleId,
        $lineIndex: lineIndex,
        $productId: item.productId,
        $productName: item.productName,
        $hsn: item.hsn,
        $quantity: item.quantity,
        $grossWeight: item.grossWeight,
        $totalWeight: item.totalWeight,
        $unitPrice: item.unitPrice,
        $lineTotal: item.lineTotal,
      }),
    )

    database.run('COMMIT')
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  }

  await persistDatabase(database)
}

module.exports = {
  getDatabasePath,
  loadData,
  saveData,
}