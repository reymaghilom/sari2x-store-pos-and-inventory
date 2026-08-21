"""Validate the TypeScript migration SQL with Python's in-memory SQLite engine."""
from pathlib import Path
import sqlite3

source = Path(__file__).parents[1].joinpath("src", "database", "schema.ts").read_text(encoding="utf-8")
marker = chr(96)
blocks = source.split(marker)
schema = blocks[1]
migration_v2 = blocks[3]
database = sqlite3.connect(":memory:")
database.executescript(schema)
database.executescript(migration_v2)
tables = [row[0] for row in database.execute("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name", ("table",))]
expected = {"users", "categories", "products", "stock_movements", "customers", "sales", "sale_items", "credit_transactions", "credit_payments", "settings", "sync_queue"}
missing = expected.difference(tables)
if missing:
    raise SystemExit(f"Missing tables: {', '.join(sorted(missing))}")

required_sync_columns = {"updated_at", "deleted_at", "origin_device_id"}
for table in expected.difference({"sync_queue"}):
    columns = {row[1] for row in database.execute(f"PRAGMA table_info({table})")}
    missing_columns = required_sync_columns.difference(columns)
    if missing_columns:
        raise SystemExit(f"{table} missing sync columns: {', '.join(sorted(missing_columns))}")

# Two devices' immutable movements coexist, and retrying the same UUID is idempotent.
timestamp = "2026-08-21T00:00:00.000Z"
database.execute("INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", ("category", "Test", timestamp, timestamp))
database.execute("INSERT INTO products (id, name, category_id, selling_price, cost_price, barcode, cached_stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ("product", "Test product", "category", 10, 5, "12345678", 10, timestamp, timestamp))
try:
    database.execute("INSERT INTO products (id, name, category_id, selling_price, cost_price, barcode, cached_stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ("duplicate-product", "Duplicate barcode", "category", 10, 5, "12345678", 1, timestamp, timestamp))
except sqlite3.IntegrityError:
    pass
else:
    raise SystemExit("Product barcode uniqueness validation failed")
database.execute("INSERT INTO stock_movements (id, product_id, type, quantity, created_at, updated_at, origin_device_id) VALUES (?, ?, ?, ?, ?, ?, ?)", ("device-a-sale", "product", "sale", 3, timestamp, timestamp, "device-a"))
database.execute("INSERT INTO stock_movements (id, product_id, type, quantity, created_at, updated_at, origin_device_id) VALUES (?, ?, ?, ?, ?, ?, ?)", ("device-b-sale", "product", "sale", 2, timestamp, timestamp, "device-b"))
database.execute("INSERT OR IGNORE INTO stock_movements (id, product_id, type, quantity, created_at, updated_at, origin_device_id) VALUES (?, ?, ?, ?, ?, ?, ?)", ("device-a-sale", "product", "sale", 3, timestamp, timestamp, "device-a"))
movement_count, sold = database.execute("SELECT COUNT(*), SUM(quantity) FROM stock_movements WHERE product_id = ?", ("product",)).fetchone()
if (movement_count, sold) != (2, 5):
    raise SystemExit("Movement convergence/idempotency validation failed")

# Credit and payment history coexist instead of overwriting a final balance.
database.execute("INSERT INTO users (id, name, username, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ("user", "User", "user", "local-only-hash", "admin", "active", timestamp, timestamp))
database.execute("INSERT INTO customers (id, full_name, phone, credit_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("customer", "Customer", "0", 1000, timestamp, timestamp))
database.execute("INSERT INTO credit_transactions (id, customer_id, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("credit", "customer", 500, "Due", timestamp, timestamp))
database.execute("INSERT INTO credit_payments (id, credit_transaction_id, customer_id, amount, payment_method, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ("payment", "credit", "customer", 200, "Cash", timestamp, timestamp))
balance = database.execute("SELECT (SELECT SUM(amount) FROM credit_transactions) - (SELECT SUM(amount) FROM credit_payments)").fetchone()[0]
if balance != 300:
    raise SystemExit("Credit/payment derivation validation failed")

# Failed writes remain retryable and retain their queue row.
database.execute("INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, retry_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ("queue", "products", "product", "update", "pending", 0, timestamp, timestamp))
database.execute("UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id = 'queue'")
queue_status = database.execute("SELECT status, retry_count FROM sync_queue WHERE id = 'queue'").fetchone()
if queue_status != ("failed", 1):
    raise SystemExit("Failed queue retention validation failed")

print(f"Schema OK: {len(expected)} tables, sync columns, barcode uniqueness, movement idempotency, utang derivation, and retry retention validated")
