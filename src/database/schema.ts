export const DATABASE_NAME = 'sari-sari-store.db';
export const CURRENT_SCHEMA_VERSION = 2;

export const migrationV1 = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT,
  selling_price REAL NOT NULL CHECK (selling_price >= 0),
  cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  barcode TEXT UNIQUE,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  description TEXT,
  image_uri TEXT,
  cached_stock INTEGER NOT NULL DEFAULT 0 CHECK (cached_stock >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('stock_in', 'sale', 'damaged', 'expired', 'personal_use', 'correction', 'stock_out')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT,
  reference TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  credit_limit REAL NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_number TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  cashier_id TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'GCash', 'Maya', 'Utang')),
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  cash_received REAL,
  change_amount REAL,
  reference_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed', 'held', 'voided')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (cashier_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL,
  cost_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL,
  sale_id TEXT,
  amount REAL NOT NULL CHECK (amount > 0),
  due_date TEXT,
  description TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('Due', 'Overdue', 'Paid')),
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS credit_payments (
  id TEXT PRIMARY KEY NOT NULL,
  credit_transaction_id TEXT,
  customer_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'GCash', 'Maya')),
  reference TEXT,
  notes TEXT,
  received_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (credit_transaction_id) REFERENCES credit_transactions(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (received_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_credit_customer ON credit_transactions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON credit_payments(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status, created_at);
`;

export const migrationV2 = `
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE users ADD COLUMN origin_device_id TEXT;
ALTER TABLE categories ADD COLUMN deleted_at TEXT;
ALTER TABLE categories ADD COLUMN origin_device_id TEXT;
ALTER TABLE products ADD COLUMN deleted_at TEXT;
ALTER TABLE products ADD COLUMN origin_device_id TEXT;
ALTER TABLE stock_movements ADD COLUMN updated_at TEXT;
ALTER TABLE stock_movements ADD COLUMN deleted_at TEXT;
ALTER TABLE stock_movements ADD COLUMN origin_device_id TEXT;
ALTER TABLE customers ADD COLUMN deleted_at TEXT;
ALTER TABLE customers ADD COLUMN origin_device_id TEXT;
ALTER TABLE sales ADD COLUMN updated_at TEXT;
ALTER TABLE sales ADD COLUMN deleted_at TEXT;
ALTER TABLE sales ADD COLUMN origin_device_id TEXT;
ALTER TABLE sale_items ADD COLUMN updated_at TEXT;
ALTER TABLE sale_items ADD COLUMN deleted_at TEXT;
ALTER TABLE sale_items ADD COLUMN origin_device_id TEXT;
ALTER TABLE credit_transactions ADD COLUMN deleted_at TEXT;
ALTER TABLE credit_transactions ADD COLUMN origin_device_id TEXT;
ALTER TABLE credit_payments ADD COLUMN updated_at TEXT;
ALTER TABLE credit_payments ADD COLUMN deleted_at TEXT;
ALTER TABLE credit_payments ADD COLUMN origin_device_id TEXT;
ALTER TABLE settings ADD COLUMN deleted_at TEXT;
ALTER TABLE settings ADD COLUMN origin_device_id TEXT;
UPDATE stock_movements SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE sales SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE sale_items SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE credit_payments SET updated_at = created_at WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_updated ON users(updated_at);
CREATE INDEX IF NOT EXISTS idx_categories_updated ON categories(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_updated ON stock_movements(updated_at);
CREATE INDEX IF NOT EXISTS idx_customers_updated ON customers(updated_at);
CREATE INDEX IF NOT EXISTS idx_sales_updated ON sales(updated_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_updated ON sale_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_credit_updated ON credit_transactions(updated_at);
CREATE INDEX IF NOT EXISTS idx_payments_updated ON credit_payments(updated_at);
`;
