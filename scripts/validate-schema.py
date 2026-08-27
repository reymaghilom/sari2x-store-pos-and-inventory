"""Validate the TypeScript migration SQL with Python's in-memory SQLite engine."""
from pathlib import Path
import sqlite3

source = Path(__file__).parents[1].joinpath("src", "database", "schema.ts").read_text(encoding="utf-8")
reports_source = Path(__file__).parents[1].joinpath("src", "database", "repositories", "reports.ts").read_text(encoding="utf-8")
marker = chr(96)
blocks = source.split(marker)
schema = blocks[1]
migration_v2 = blocks[3]
migration_v3 = blocks[5]
migration_v4 = blocks[7]
migration_v5 = blocks[9]
migration_v6 = blocks[11]
migration_v7 = blocks[13]
migration_v8 = blocks[15]
financial_summary_sql = reports_source.split("export const financialSummarySql = `", 1)[1].split("`;", 1)[0]
database = sqlite3.connect(":memory:")
database.executescript(schema)
database.executescript(migration_v2)
database.execute("PRAGMA foreign_keys = OFF")
database.execute("PRAGMA legacy_alter_table = ON")
database.executescript(migration_v3)
database.execute("PRAGMA legacy_alter_table = OFF")
database.execute("PRAGMA foreign_keys = ON")
database.executescript(migration_v4)
database.executescript(migration_v5)
database.executescript(migration_v6)
database.executescript(migration_v7)
compatibility_timestamp = "2026-08-20T00:00:00.000Z"
database.execute("INSERT INTO customers (id, full_name, phone, credit_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("migration-limit", "Limit Customer", "1", 1000, compatibility_timestamp, compatibility_timestamp))
database.execute("INSERT INTO customers (id, full_name, phone, credit_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("migration-debt", "Debt Customer", "2", 0, compatibility_timestamp, compatibility_timestamp))
database.execute("INSERT INTO customers (id, full_name, phone, credit_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("migration-disabled", "No Credit Customer", "3", 0, compatibility_timestamp, compatibility_timestamp))
database.execute("INSERT INTO credit_transactions (id, customer_id, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("migration-credit", "migration-debt", 100, "Due", compatibility_timestamp, compatibility_timestamp))
database.execute("INSERT INTO credit_payments (id, credit_transaction_id, customer_id, amount, payment_method, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ("migration-payment", "migration-credit", "migration-debt", 20, "Cash", compatibility_timestamp, compatibility_timestamp))
database.executescript(migration_v8)
sale_item_parents = {row[2] for row in database.execute("PRAGMA foreign_key_list(sale_items)")}
if "sales" not in sale_item_parents:
    raise SystemExit("Migration did not preserve the sale_items -> sales foreign key")
tables = [row[0] for row in database.execute("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name", ("table",))]
expected = {"users", "categories", "products", "stock_movements", "customers", "sales", "sale_items", "sale_voids", "sale_refunds", "sale_refund_items", "credit_transactions", "credit_payments", "settings", "sync_queue", "pending_sales", "pending_sale_items"}
missing = expected.difference(tables)
if missing:
    raise SystemExit(f"Missing tables: {', '.join(sorted(missing))}")

payment_indexes = {row[1] for row in database.execute("PRAGMA index_list(credit_payments)")}
if "idx_payments_credit" not in payment_indexes:
    raise SystemExit("Credit-payment transaction lookup index migration failed")

customer_columns = {row[1] for row in database.execute("PRAGMA table_info(customers)")}
sale_columns = {row[1] for row in database.execute("PRAGMA table_info(sales)")}
if not {"customer_type", "discount_type", "discount_value"}.issubset(customer_columns):
    raise SystemExit("V7 customer classification/discount columns are missing")
if not {"discount_type", "discount_value", "cashier_name_snapshot", "customer_name_snapshot"}.issubset(sale_columns):
    raise SystemExit("V7 immutable sale snapshot columns are missing")
if "allow_utang" not in customer_columns:
    raise SystemExit("V8 Allow Utang column is missing")
permission_rows = dict(database.execute("SELECT id, allow_utang FROM customers WHERE id LIKE 'migration-%'"))
if permission_rows != {"migration-limit": 1, "migration-debt": 1, "migration-disabled": 0}:
    raise SystemExit(f"V8 Allow Utang compatibility inference failed: {permission_rows}")

lock_timeout = database.execute("SELECT value FROM settings WHERE key = 'security_lock_timeout_ms'").fetchone()
if lock_timeout != ("300000",):
    raise SystemExit("Owner security settings migration failed")

setting_defaults = dict(database.execute("SELECT key, value FROM settings WHERE key IN ('store_name', 'payment_methods', 'scanner_preferences', 'appearance_preference')"))
if setting_defaults.get("store_name") != "Sari-sari Store" or setting_defaults.get("appearance_preference") != "system":
    raise SystemExit("App preference defaults migration failed")

required_sync_columns = {"updated_at", "deleted_at", "origin_device_id"}
for table in expected.difference({"sync_queue", "pending_sales", "pending_sale_items"}):
    columns = {row[1] for row in database.execute(f"PRAGMA table_info({table})")}
    missing_columns = required_sync_columns.difference(columns)
    if missing_columns:
        raise SystemExit(f"{table} missing sync columns: {', '.join(sorted(missing_columns))}")

def financial_summary(start_at, end_at):
    cursor = database.execute(financial_summary_sql, (start_at, end_at))
    row = cursor.fetchone()
    return dict(zip((column[0] for column in cursor.description), row))

empty_financials = financial_summary("2026-08-21T00:00:00.000Z", "2026-08-22T00:00:00.000Z")
if empty_financials["today_sales"] != 0 or empty_financials["today_profit"] != 0:
    raise SystemExit("Empty store financial aggregates did not return zero")

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
database.execute("INSERT INTO stock_movements (id, product_id, type, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("void-return", "product", "void_return", 2, timestamp, timestamp))

# Saving or deleting a pending sale never changes inventory.
stock_before = database.execute("SELECT cached_stock FROM products WHERE id = 'product'").fetchone()[0]
database.execute("INSERT INTO pending_sales (id, discount, created_at, updated_at) VALUES (?, ?, ?, ?)", ("pending", 0, timestamp, timestamp))
database.execute("INSERT INTO pending_sale_items (id, pending_sale_id, product_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)", ("pending-item", "pending", "product", 4, timestamp))
stock_after_save = database.execute("SELECT cached_stock FROM products WHERE id = 'product'").fetchone()[0]
database.execute("DELETE FROM pending_sales WHERE id = 'pending'")
pending_items = database.execute("SELECT COUNT(*) FROM pending_sale_items WHERE pending_sale_id = 'pending'").fetchone()[0]
if stock_before != stock_after_save or pending_items != 0:
    raise SystemExit("Pending sale inventory isolation or cascade deletion failed")

# Credit and payment history coexist instead of overwriting a final balance.
def remaining_credit(credit_limit, outstanding_balance):
    return max(credit_limit - outstanding_balance, 0)

credit_cases = [
    (1000, 200, 800),
    (1000, 0, 1000),
    (1000, 1000, 0),
    (1000, 1200, 0),
    (1000, 300, 700),
]
for credit_limit, outstanding_balance, expected_remaining in credit_cases:
    actual_remaining = remaining_credit(credit_limit, outstanding_balance)
    if actual_remaining != expected_remaining:
        raise SystemExit(f"Remaining-credit formula failed for limit={credit_limit}, outstanding={outstanding_balance}")

database.execute("INSERT INTO users (id, name, username, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ("user", "User", "user", "local-only-hash", "admin", "active", timestamp, timestamp))
database.execute("INSERT INTO customers (id, full_name, phone, credit_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("customer", "Customer", "0", 1000, timestamp, timestamp))
database.execute("INSERT INTO credit_transactions (id, customer_id, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", ("credit", "customer", 500, "Due", timestamp, timestamp))
database.execute("INSERT INTO credit_payments (id, credit_transaction_id, customer_id, amount, payment_method, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ("payment", "credit", "customer", 200, "Cash", timestamp, timestamp))
balance = database.execute("""SELECT MAX(0,
    COALESCE((SELECT SUM(amount) FROM credit_transactions WHERE customer_id = 'customer' AND deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(amount) FROM credit_payments WHERE customer_id = 'customer' AND deleted_at IS NULL), 0)
)""").fetchone()[0]
if balance != 300 or remaining_credit(1000, balance) != 700:
    raise SystemExit("Credit/payment derivation validation failed")
if not (700 <= remaining_credit(1000, balance)) or 701 <= remaining_credit(1000, balance):
    raise SystemExit("Utang checkout credit-boundary validation failed")

# Soft-deleted payments and reversed (soft-deleted) Utang transactions do not
# affect the live outstanding balance.
database.execute("INSERT INTO credit_payments (id, credit_transaction_id, customer_id, amount, payment_method, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ("deleted-payment", "credit", "customer", 50, "Cash", timestamp, timestamp, timestamp))
balance_after_deleted_payment = database.execute("""SELECT MAX(0,
    COALESCE((SELECT SUM(amount) FROM credit_transactions WHERE customer_id = 'customer' AND deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(amount) FROM credit_payments WHERE customer_id = 'customer' AND deleted_at IS NULL), 0)
)""").fetchone()[0]
if balance_after_deleted_payment != 300:
    raise SystemExit("Soft-deleted payment changed the outstanding balance")
database.execute("UPDATE credit_transactions SET deleted_at = ? WHERE id = 'credit'", (timestamp,))
if database.execute("SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE customer_id = 'customer' AND deleted_at IS NULL").fetchone()[0] != 0:
    raise SystemExit("Reversed Utang remained in the outstanding balance")
database.execute("UPDATE credit_transactions SET deleted_at = NULL WHERE id = 'credit'")

# Full refund history is append-only and duplicate restoration is constrained.
database.execute("INSERT INTO sales (id, transaction_number, cashier_id, payment_method, subtotal, discount, total, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("sale", "#TXN-TEST", "user", "Cash", 20, 0, 20, "completed", timestamp, timestamp))
database.execute("INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, quantity, unit_price, cost_price, subtotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("sale-item", "sale", "product", "Test product", 2, 10, 5, 20, timestamp, timestamp))
normal_sale = financial_summary("2026-08-21T00:00:00.000Z", "2026-08-22T00:00:00.000Z")
if normal_sale["today_sales"] != 20 or normal_sale["today_profit"] != 10:
    raise SystemExit("Normal sale revenue-minus-COGS calculation failed")
database.execute("INSERT INTO sale_refunds (id, sale_id, refund_number, amount, refund_method, reason, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ("refund", "sale", "#REF-TEST", 20, "Cash", "Test refund", "user", timestamp, timestamp))
database.execute("INSERT INTO sale_refund_items (id, refund_id, sale_item_id, product_id, quantity, unit_price, subtotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ("refund-item", "refund", "sale-item", "product", 2, 10, 20, timestamp, timestamp))
database.execute("UPDATE sales SET status = 'refunded' WHERE id = 'sale'")
refunded_sale = financial_summary("2026-08-21T00:00:00.000Z", "2026-08-22T00:00:00.000Z")
if refunded_sale["today_sales"] != 0 or refunded_sale["today_profit"] != 0:
    raise SystemExit("Same-day refund was double-counted in profit")
database.execute("UPDATE sale_refunds SET created_at = '2026-08-22T08:00:00.000Z' WHERE id = 'refund'")
refund_day = financial_summary("2026-08-22T00:00:00.000Z", "2026-08-23T00:00:00.000Z")
if refund_day["today_sales"] != -20 or refund_day["today_profit"] != -10:
    raise SystemExit("Later-day refund did not preserve legitimate negative profit")

database.execute("INSERT INTO sales (id, transaction_number, cashier_id, payment_method, subtotal, discount, total, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("void-sale", "#TXN-VOID", "user", "GCash", 30, 0, 30, "voided", timestamp, timestamp))
database.execute("INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, quantity, unit_price, cost_price, subtotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("void-item", "void-sale", "product", "Test product", 3, 10, 4, 30, timestamp, timestamp))
database.execute("INSERT INTO sale_voids (id, sale_id, amount, reason, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ("void", "void-sale", 30, "Test void", "user", "2026-08-23T08:00:00.000Z", "2026-08-23T08:00:00.000Z"))
void_day = financial_summary("2026-08-23T00:00:00.000Z", "2026-08-24T00:00:00.000Z")
if void_day["today_sales"] != -30 or void_day["today_profit"] != -18:
    raise SystemExit("Later-day void revenue/COGS reversal failed")

database.execute("INSERT INTO sales (id, transaction_number, cashier_id, payment_method, subtotal, discount, total, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("utang-sale", "#TXN-UTANG", "user", "Utang", 50, 0, 50, "completed", "2026-08-24T08:00:00.000Z", "2026-08-24T08:00:00.000Z"))
database.execute("INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, quantity, unit_price, cost_price, subtotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("utang-item", "utang-sale", "product", "Test product", 1, 50, 30, 50, "2026-08-24T08:00:00.000Z", "2026-08-24T08:00:00.000Z"))
utang_day = financial_summary("2026-08-24T00:00:00.000Z", "2026-08-25T00:00:00.000Z")
if utang_day["today_sales"] != 50 or utang_day["today_profit"] != 20:
    raise SystemExit("Utang sale profit calculation failed")

# A discount reduces revenue and profit, while COGS remains the immutable item cost.
discounted_at = "2026-08-25T08:00:00.000Z"
database.execute("INSERT INTO sales (id, transaction_number, cashier_id, payment_method, subtotal, discount_type, discount_value, discount, total, cashier_name_snapshot, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("discount-sale", "TXN-082526-001", "user", "Cash", 100, "percentage", 10, 10, 90, "Store Owner", "completed", discounted_at, discounted_at))
database.execute("INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, quantity, unit_price, cost_price, subtotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("discount-item", "discount-sale", "product", "Test product", 2, 50, 30, 100, discounted_at, discounted_at))
discount_day = financial_summary("2026-08-25T00:00:00.000Z", "2026-08-26T00:00:00.000Z")
if discount_day["today_sales"] != 90 or discount_day["today_profit"] != 30:
    raise SystemExit("Discounted net revenue/profit calculation failed")
try:
    database.execute("INSERT INTO sale_refunds (id, sale_id, refund_number, amount, refund_method, reason, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ("refund-duplicate", "sale", "#REF-DUP", 20, "Cash", "Duplicate", "user", timestamp, timestamp))
except sqlite3.IntegrityError:
    pass
else:
    raise SystemExit("Duplicate full-refund protection failed")
if database.execute("SELECT COUNT(*) FROM sale_items WHERE sale_id = 'sale'").fetchone()[0] != 1:
    raise SystemExit("Original sale item history was not preserved")

# Failed writes remain retryable and retain their queue row.
database.execute("INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, retry_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ("queue", "products", "product", "update", "pending", 0, timestamp, timestamp))
database.execute("UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id = 'queue'")
queue_status = database.execute("SELECT status, retry_count FROM sync_queue WHERE id = 'queue'").fetchone()
if queue_status != ("failed", 1):
    raise SystemExit("Failed queue retention validation failed")

# Complete local reset removes business rows in reverse dependency order while
# retaining the exact current Owner credential row and required security state.
database.execute("INSERT INTO users (id, name, username, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ("old-user", "Old user", "old-user", "old-hash", "staff", "disabled", timestamp, timestamp))
database.execute("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)", ("owner_user_id", "user", timestamp))
database.execute("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)", ("manual_backup_last_created_at", timestamp, timestamp))
database.execute("INSERT INTO pending_sales (id, customer_id, discount, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", ("pending-reset", "customer", 0, timestamp, timestamp))
database.execute("INSERT INTO pending_sale_items (id, pending_sale_id, product_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)", ("pending-reset-item", "pending-reset", "product", 1, timestamp))
owner_hash = database.execute("SELECT password_hash FROM users WHERE id = 'user'").fetchone()[0]
database.executescript("""
DELETE FROM sale_refund_items;
DELETE FROM sale_refunds;
DELETE FROM sale_voids;
DELETE FROM credit_payments;
DELETE FROM credit_transactions;
DELETE FROM sale_items;
DELETE FROM stock_movements;
DELETE FROM sales;
DELETE FROM pending_sale_items;
DELETE FROM pending_sales;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM customers;
DELETE FROM sync_queue;
DELETE FROM users WHERE id <> 'user';
DELETE FROM settings WHERE key NOT IN ('owner_user_id', 'owner_pin_needs_change', 'security_lock_timeout_ms', 'sync_device_id');
""")
business_tables = expected.difference({"users", "settings"})
if any(database.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in business_tables):
    raise SystemExit("Complete store reset left business records behind")
owner_after_reset = database.execute("SELECT id, password_hash FROM users").fetchall()
if owner_after_reset != [("user", owner_hash)]:
    raise SystemExit("Complete store reset did not preserve only the current Owner PIN hash")
if database.execute("PRAGMA foreign_key_check").fetchall():
    raise SystemExit("Complete store reset left foreign-key violations")

print(f"Schema OK: {len(expected)} tables, V8 Allow Utang compatibility inference, credit-limit/outstanding/remaining-credit cases and permission boundary, payment/reversal balance handling, zero/normal/refund/void/Utang profit aggregates, sync columns, pending-sale stock isolation/cascade, reversal constraints, history preservation, movement idempotency, retry retention, and Owner-safe complete reset validated")
