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

function getColumnNames(database, tableName) {
  return queryRows(database, `PRAGMA table_info(${tableName})`).map((row) => row.name)
}

function hasForeignKey(database, tableName, fromColumn, referencedTable) {
  return queryRows(database, `PRAGMA foreign_key_list(${tableName})`).some(
    (row) => row.from === fromColumn && row.table === referencedTable,
  )
}

function rebuildCoreTables(database, schemaState) {
  database.exec('PRAGMA foreign_keys = OFF;')
  database.run('BEGIN TRANSACTION')

  try {
    database.exec(`
      CREATE TABLE products_next (
        id TEXT PRIMARY KEY,
        hsn TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        purity TEXT NOT NULL,
        gross_weight REAL NOT NULL,
        stone_weight REAL NOT NULL,
        stock_qty REAL NOT NULL,
        location TEXT NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE customers_next (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        city TEXT NOT NULL,
        address TEXT NOT NULL,
        outstanding REAL NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE suppliers_next (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        city TEXT NOT NULL,
        address TEXT NOT NULL,
        gstin TEXT NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE purchases_next (
        id TEXT PRIMARY KEY,
        bill_number TEXT NOT NULL,
        date TEXT NOT NULL,
        supplier_id TEXT NOT NULL,
        supplier_name TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        making_charge REAL NOT NULL DEFAULT 0,
        total_weight REAL NOT NULL DEFAULT 0,
        unit_cost REAL NOT NULL,
        total_cost REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        notes TEXT NOT NULL,
        FOREIGN KEY (supplier_id) REFERENCES suppliers_next(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products_next(id) ON DELETE RESTRICT ON UPDATE CASCADE
      );

      CREATE TABLE sales_next (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL,
        date TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL DEFAULT '',
        customer_address TEXT NOT NULL DEFAULT '',
        tax_rate REAL NOT NULL DEFAULT 3,
        separate_rate_and_making_charge INTEGER NOT NULL DEFAULT 0,
        subtotal REAL NOT NULL,
        discount REAL NOT NULL,
        tax_amount REAL NOT NULL,
        total REAL NOT NULL,
        paid_amount REAL NOT NULL,
        balance_amount REAL NOT NULL,
        payment_mode TEXT NOT NULL,
        notes TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers_next(id) ON DELETE RESTRICT ON UPDATE CASCADE
      );

      CREATE TABLE sale_items_next (
        sale_id TEXT NOT NULL,
        line_index INTEGER NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        hsn TEXT NOT NULL,
        quantity REAL NOT NULL,
        gross_weight REAL NOT NULL,
        total_weight REAL NOT NULL,
        unit_price REAL NOT NULL,
        making_charge REAL NOT NULL DEFAULT 0,
        line_total REAL NOT NULL,
        PRIMARY KEY (sale_id, line_index),
        FOREIGN KEY (sale_id) REFERENCES sales_next(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products_next(id) ON DELETE RESTRICT ON UPDATE CASCADE
      );

      CREATE TABLE outstandings_next (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        date TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        balance_amount REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        settlements_json TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (sale_id) REFERENCES sales_next(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers_next(id) ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `)

    database.exec(`
      INSERT INTO products_next (id, hsn, name, category, purity, gross_weight, stone_weight, stock_qty, location, is_archived)
      SELECT id, hsn, name, category, purity, gross_weight, stone_weight, stock_qty, location, ${schemaState.productColumns.includes('is_archived') ? 'is_archived' : '0'}
      FROM products;

      INSERT INTO customers_next (id, name, phone, email, city, address, outstanding, is_archived)
      SELECT id, name, phone, email, city, address, outstanding, ${schemaState.customerColumns.includes('is_archived') ? 'is_archived' : '0'}
      FROM customers;

      INSERT INTO suppliers_next (id, name, phone, email, city, address, gstin, is_archived)
      SELECT id, name, phone, email, city, address, gstin, ${schemaState.supplierColumns.includes('is_archived') ? 'is_archived' : '0'}
      FROM suppliers;

      INSERT INTO purchases_next (id, bill_number, date, supplier_id, supplier_name, product_id, product_name, making_charge, total_weight, unit_cost, total_cost, paid_amount, notes)
      SELECT id, bill_number, date, supplier_id, supplier_name, product_id, product_name, making_charge, total_weight, unit_cost, total_cost, paid_amount, notes
      FROM purchases;

      INSERT INTO sales_next (id, invoice_number, date, customer_id, customer_name, customer_phone, customer_address, tax_rate, separate_rate_and_making_charge, subtotal, discount, tax_amount, total, paid_amount, balance_amount, payment_mode, notes)
      SELECT id, invoice_number, date, customer_id, customer_name, customer_phone, customer_address, tax_rate, separate_rate_and_making_charge, subtotal, discount, tax_amount, total, paid_amount, balance_amount, payment_mode, notes
      FROM sales;

      INSERT INTO sale_items_next (sale_id, line_index, product_id, product_name, hsn, quantity, gross_weight, total_weight, unit_price, making_charge, line_total)
      SELECT sale_id, line_index, product_id, product_name, hsn, quantity, gross_weight, total_weight, unit_price, making_charge, line_total
      FROM sale_items;

      INSERT INTO outstandings_next (id, sale_id, invoice_number, date, customer_id, customer_name, balance_amount, paid_amount, status, settlements_json)
      SELECT id, sale_id, invoice_number, date, customer_id, customer_name, balance_amount, paid_amount, status, settlements_json
      FROM outstandings;

      DROP TABLE sale_items;
      DROP TABLE sales;
      DROP TABLE purchases;
      DROP TABLE suppliers;
      DROP TABLE customers;
      DROP TABLE products;

      ALTER TABLE products_next RENAME TO products;
      ALTER TABLE customers_next RENAME TO customers;
      ALTER TABLE suppliers_next RENAME TO suppliers;
      ALTER TABLE purchases_next RENAME TO purchases;
      ALTER TABLE sales_next RENAME TO sales;
      ALTER TABLE sale_items_next RENAME TO sale_items;
      ALTER TABLE outstandings_next RENAME TO outstandings;
    `)

    database.run('COMMIT')
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  } finally {
    database.exec('PRAGMA foreign_keys = ON;')
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
      invoice_logo_data_url TEXT NOT NULL DEFAULT '',
      invoice_save_directory TEXT NOT NULL DEFAULT ''
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
      location TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      outstanding REAL NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      gstin TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      bill_number TEXT NOT NULL,
      date TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      making_charge REAL NOT NULL DEFAULT 0,
      total_weight REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      date TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL DEFAULT '',
      customer_address TEXT NOT NULL DEFAULT '',
      tax_rate REAL NOT NULL DEFAULT 3,
      separate_rate_and_making_charge INTEGER NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      balance_amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      notes TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE
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
      making_charge REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL,
      PRIMARY KEY (sale_id, line_index),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outstandings (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      date TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      balance_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      settlements_json TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `)

  const shopProfileColumns = getColumnNames(database, 'shop_profile')
  if (!shopProfileColumns.includes('invoice_logo_data_url')) {
    database.exec("ALTER TABLE shop_profile ADD COLUMN invoice_logo_data_url TEXT NOT NULL DEFAULT '';")
  }
  if (!shopProfileColumns.includes('invoice_save_directory')) {
    database.exec("ALTER TABLE shop_profile ADD COLUMN invoice_save_directory TEXT NOT NULL DEFAULT '';")
  }

  const salesColumns = getColumnNames(database, 'sales')
  if (!salesColumns.includes('customer_phone')) {
    database.exec("ALTER TABLE sales ADD COLUMN customer_phone TEXT NOT NULL DEFAULT '';")
  }
  if (!salesColumns.includes('customer_address')) {
    database.exec("ALTER TABLE sales ADD COLUMN customer_address TEXT NOT NULL DEFAULT '';")
  }
  if (!salesColumns.includes('tax_rate')) {
    database.exec("ALTER TABLE sales ADD COLUMN tax_rate REAL NOT NULL DEFAULT 3;")
  }
  if (!salesColumns.includes('separate_rate_and_making_charge')) {
    database.exec("ALTER TABLE sales ADD COLUMN separate_rate_and_making_charge INTEGER NOT NULL DEFAULT 0;")
  }

  const purchasesColumns = getColumnNames(database, 'purchases')
  if (!purchasesColumns.includes('making_charge')) {
    database.exec("ALTER TABLE purchases ADD COLUMN making_charge REAL NOT NULL DEFAULT 0;")
  }
  if (!purchasesColumns.includes('total_weight')) {
    database.exec("ALTER TABLE purchases ADD COLUMN total_weight REAL NOT NULL DEFAULT 0;")
    if (purchasesColumns.includes('quantity')) {
      database.exec('UPDATE purchases SET total_weight = quantity WHERE total_weight = 0;')
    }
  }
  if (!purchasesColumns.includes('paid_amount')) {
    database.exec("ALTER TABLE purchases ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0;")
    database.exec('UPDATE purchases SET paid_amount = total_cost WHERE paid_amount = 0;')
  }

  const saleItemsColumns = getColumnNames(database, 'sale_items')
  if (!saleItemsColumns.includes('making_charge')) {
    database.exec("ALTER TABLE sale_items ADD COLUMN making_charge REAL NOT NULL DEFAULT 0;")
  }

  const productColumns = getColumnNames(database, 'products')
  const customerColumns = getColumnNames(database, 'customers')
  const supplierColumns = getColumnNames(database, 'suppliers')
  const needsArchiveColumns = !productColumns.includes('is_archived') || !customerColumns.includes('is_archived') || !supplierColumns.includes('is_archived')
  const needsRelations = !hasForeignKey(database, 'purchases', 'supplier_id', 'suppliers')
    || !hasForeignKey(database, 'purchases', 'product_id', 'products')
    || !hasForeignKey(database, 'sales', 'customer_id', 'customers')
    || !hasForeignKey(database, 'sale_items', 'product_id', 'products')

  if (needsArchiveColumns || needsRelations) {
    rebuildCoreTables(database, {
      productColumns,
      customerColumns,
      supplierColumns,
    })
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
    invoiceSaveDirectory: row.invoice_save_directory ?? '',
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
    isArchived: Boolean(row.is_archived ?? 0),
  }))

  const customers = queryRows(database, 'SELECT * FROM customers ORDER BY name ASC').map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    address: row.address,
    outstanding: Number(row.outstanding),
    isArchived: Boolean(row.is_archived ?? 0),
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
    isArchived: Boolean(row.is_archived ?? 0),
  }))

  const purchases = queryRows(database, 'SELECT * FROM purchases ORDER BY date DESC, bill_number DESC').map((row) => ({
    id: row.id,
    billNumber: row.bill_number,
    date: row.date,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    productId: row.product_id,
    productName: row.product_name,
    makingCharge: Number(row.making_charge ?? 0),
    totalWeight: Number(row.total_weight ?? row.quantity ?? 0),
    unitCost: Number(row.unit_cost),
    totalCost: Number(row.total_cost),
    paidAmount: Number(row.paid_amount ?? row.total_cost ?? 0),
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
    taxRate: Number(row.tax_rate ?? shop.defaultTaxRate ?? 3),
    separateRateAndMakingCharge: Boolean(row.separate_rate_and_making_charge ?? 0),
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
      makingCharge: Number(item.making_charge ?? 0),
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

  const outstandings = queryRows(database, 'SELECT * FROM outstandings ORDER BY date DESC, invoice_number DESC').map((row) => {
    let settlements = []
    try {
      settlements = JSON.parse(row.settlements_json ?? '[]')
    } catch {
      settlements = []
    }
    return {
      id: row.id,
      saleId: row.sale_id,
      invoiceNumber: row.invoice_number,
      date: row.date,
      customerId: row.customer_id,
      customerName: row.customer_name,
      balanceAmount: Number(row.balance_amount),
      paidAmount: Number(row.paid_amount ?? 0),
      status: row.status === 'settled' ? 'settled' : 'pending',
      settlements: Array.isArray(settlements) ? settlements.map((s) => ({ amount: Number(s.amount ?? 0), date: String(s.date ?? '') })) : [],
    }
  })

  return {
    shop,
    products,
    customers,
    suppliers,
    purchases,
    sales,
    outstandings,
  }
}

async function saveData(data) {
  const database = await openDatabase()

  database.run('BEGIN TRANSACTION')

  try {
    database.run('DELETE FROM outstandings')
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
          invoice_logo_data_url,
          invoice_save_directory
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
          $invoiceLogoDataUrl,
          $invoiceSaveDirectory
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
        $invoiceSaveDirectory: data.shop.invoiceSaveDirectory ?? '',
      },
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO products (id, hsn, name, category, purity, gross_weight, stone_weight, stock_qty, location, is_archived)
          VALUES ($id, $hsn, $name, $category, $purity, $grossWeight, $stoneWeight, $stockQty, $location, $isArchived)
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
        $isArchived: product.isArchived ? 1 : 0,
      }),
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO customers (id, name, phone, email, city, address, outstanding, is_archived)
          VALUES ($id, $name, $phone, $email, $city, $address, $outstanding, $isArchived)
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
        $outstanding: customer.outstanding,
        $isArchived: customer.isArchived ? 1 : 0,
      }),
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO suppliers (id, name, phone, email, city, address, gstin, is_archived)
          VALUES ($id, $name, $phone, $email, $city, $address, $gstin, $isArchived)
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
        $isArchived: supplier.isArchived ? 1 : 0,
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
            making_charge,
            total_weight,
            unit_cost,
            total_cost,
            paid_amount,
            notes
          ) VALUES (
            $id,
            $billNumber,
            $date,
            $supplierId,
            $supplierName,
            $productId,
            $productName,
            $makingCharge,
            $totalWeight,
            $unitCost,
            $totalCost,
            $paidAmount,
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
        $makingCharge: purchase.makingCharge ?? 0,
        $totalWeight: purchase.totalWeight ?? 0,
        $unitCost: purchase.unitCost ?? 0,
        $totalCost: purchase.totalCost ?? 0,
        $paidAmount: purchase.paidAmount ?? purchase.totalCost ?? 0,
        $notes: purchase.notes ?? '',
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
            tax_rate,
            separate_rate_and_making_charge,
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
            $taxRate,
            $separateRateAndMakingCharge,
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
        $customerPhone: sale.customerPhone ?? '',
        $customerAddress: sale.customerAddress ?? '',
        $taxRate: sale.taxRate ?? 3,
        $separateRateAndMakingCharge: sale.separateRateAndMakingCharge ? 1 : 0,
        $subtotal: sale.subtotal ?? 0,
        $discount: sale.discount ?? 0,
        $taxAmount: sale.taxAmount ?? 0,
        $total: sale.total ?? 0,
        $paidAmount: sale.paidAmount ?? 0,
        $balanceAmount: sale.balanceAmount ?? 0,
        $paymentMode: sale.paymentMode,
        $notes: sale.notes ?? '',
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
            making_charge,
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
            $makingCharge,
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
        $makingCharge: item.makingCharge ?? 0,
        $lineTotal: item.lineTotal,
      }),
    )

    runStatement(
      database.prepare(
        `
          INSERT INTO outstandings (
            id,
            sale_id,
            invoice_number,
            date,
            customer_id,
            customer_name,
            balance_amount,
            paid_amount,
            status,
            settlements_json
          ) VALUES (
            $id,
            $saleId,
            $invoiceNumber,
            $date,
            $customerId,
            $customerName,
            $balanceAmount,
            $paidAmount,
            $status,
            $settlementsJson
          )
        `,
      ),
      data.outstandings,
      (entry) => ({
        $id: entry.id,
        $saleId: entry.saleId,
        $invoiceNumber: entry.invoiceNumber,
        $date: entry.date,
        $customerId: entry.customerId,
        $customerName: entry.customerName,
        $balanceAmount: entry.balanceAmount ?? 0,
        $paidAmount: entry.paidAmount ?? 0,
        $status: entry.status ?? 'pending',
        $settlementsJson: JSON.stringify(entry.settlements ?? []),
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