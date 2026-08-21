-- Sari-sari Store cloud schema. Run once in a new Supabase project's SQL Editor.
-- All client timestamps are ISO-8601 UTC values. IDs remain text-compatible with SQLite.

create table if not exists public.users (
  id text primary key, name text not null, username text not null unique,
  role text not null check (role in ('admin', 'staff')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.categories (
  id text primary key, name text not null unique,
  created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.products (
  id text primary key, name text not null, category_id text references public.categories(id),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  barcode text unique, low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  description text, image_uri text, is_active integer not null default 1 check (is_active in (0, 1)),
  created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.customers (
  id text primary key, full_name text not null, phone text not null, address text,
  credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.sales (
  id text primary key, transaction_number text not null unique,
  customer_id text references public.customers(id), cashier_id text not null references public.users(id),
  payment_method text not null check (payment_method in ('Cash', 'GCash', 'Maya', 'Utang')),
  subtotal numeric(12,2) not null, discount numeric(12,2) not null default 0,
  total numeric(12,2) not null, cash_received numeric(12,2), change_amount numeric(12,2),
  reference_number text, status text not null check (status in ('completed', 'held', 'voided')),
  created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.sale_items (
  id text primary key, sale_id text not null references public.sales(id),
  product_id text not null references public.products(id), product_name_snapshot text not null,
  quantity integer not null check (quantity > 0), unit_price numeric(12,2) not null,
  cost_price numeric(12,2) not null, subtotal numeric(12,2) not null,
  created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.stock_movements (
  id text primary key, product_id text not null references public.products(id),
  type text not null check (type in ('stock_in', 'sale', 'damaged', 'expired', 'personal_use', 'correction', 'stock_out')),
  quantity integer not null check (quantity > 0), reason text, reference text, notes text,
  created_by text references public.users(id), created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.credit_transactions (
  id text primary key, customer_id text not null references public.customers(id),
  sale_id text references public.sales(id), amount numeric(12,2) not null check (amount > 0),
  due_date text, description text, notes text,
  status text not null check (status in ('Due', 'Overdue', 'Paid')),
  created_by text references public.users(id), created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.credit_payments (
  id text primary key, credit_transaction_id text references public.credit_transactions(id),
  customer_id text not null references public.customers(id), amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Cash', 'GCash', 'Maya')),
  reference text, notes text, received_by text references public.users(id),
  created_at timestamptz not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);
create table if not exists public.settings (
  key text primary key, value text not null, updated_at timestamptz not null,
  deleted_at timestamptz, origin_device_id text
);

create index if not exists categories_updated_idx on public.categories(updated_at);
create index if not exists products_updated_idx on public.products(updated_at);
create index if not exists customers_updated_idx on public.customers(updated_at);
create index if not exists users_updated_idx on public.users(updated_at);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id, created_at);
create index if not exists stock_movements_updated_idx on public.stock_movements(updated_at);
create index if not exists sales_updated_idx on public.sales(updated_at);
create index if not exists sale_items_sale_idx on public.sale_items(sale_id);
create index if not exists sale_items_updated_idx on public.sale_items(updated_at);
create index if not exists credit_transactions_customer_idx on public.credit_transactions(customer_id, created_at);
create index if not exists credit_transactions_updated_idx on public.credit_transactions(updated_at);
create index if not exists credit_payments_customer_idx on public.credit_payments(customer_id, created_at);
create index if not exists credit_payments_updated_idx on public.credit_payments(updated_at);
create index if not exists settings_updated_idx on public.settings(updated_at);

-- Last-write-wins guard: a delayed device cannot replace a newer editable row.
create or replace function public.keep_newest_write() returns trigger language plpgsql as $$
begin
  if new.updated_at <= old.updated_at then return old; end if;
  return new;
end $$;
drop trigger if exists users_keep_newest on public.users;
create trigger users_keep_newest before update on public.users for each row execute function public.keep_newest_write();
drop trigger if exists categories_keep_newest on public.categories;
create trigger categories_keep_newest before update on public.categories for each row execute function public.keep_newest_write();
drop trigger if exists products_keep_newest on public.products;
create trigger products_keep_newest before update on public.products for each row execute function public.keep_newest_write();
drop trigger if exists customers_keep_newest on public.customers;
create trigger customers_keep_newest before update on public.customers for each row execute function public.keep_newest_write();
drop trigger if exists credit_transactions_keep_newest on public.credit_transactions;
create trigger credit_transactions_keep_newest before update on public.credit_transactions for each row execute function public.keep_newest_write();
drop trigger if exists settings_keep_newest on public.settings;
create trigger settings_keep_newest before update on public.settings for each row execute function public.keep_newest_write();

-- Completed history is append-only. Idempotent inserts use the stable primary key and ON CONFLICT DO NOTHING.
create or replace function public.prevent_history_mutation() returns trigger language plpgsql as $$
begin raise exception 'Historical records are immutable'; end $$;
drop trigger if exists stock_movements_immutable on public.stock_movements;
create trigger stock_movements_immutable before update or delete on public.stock_movements for each row execute function public.prevent_history_mutation();
drop trigger if exists sales_immutable on public.sales;
create trigger sales_immutable before update or delete on public.sales for each row execute function public.prevent_history_mutation();
drop trigger if exists sale_items_immutable on public.sale_items;
create trigger sale_items_immutable before update or delete on public.sale_items for each row execute function public.prevent_history_mutation();
drop trigger if exists credit_payments_immutable on public.credit_payments;
create trigger credit_payments_immutable before update or delete on public.credit_payments for each row execute function public.prevent_history_mutation();

create or replace view public.product_stock as
select p.id as product_id,
  coalesce(sum(case when sm.type = 'stock_in' then sm.quantity else -sm.quantity end), 0)::bigint as quantity
from public.products p left join public.stock_movements sm on sm.product_id = p.id and sm.deleted_at is null
where p.deleted_at is null group by p.id;

-- DEVELOPMENT-ONLY access for the mobile publishable/anon key while Supabase Auth is intentionally deferred.
-- Do not ship these shared anonymous policies to production; replace them with authenticated store-membership policies.
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.credit_payments enable row level security;
alter table public.settings enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['users','categories','products','customers','credit_transactions','settings'] loop
    execute format('drop policy if exists dev_shared_select on public.%I', table_name);
    execute format('create policy dev_shared_select on public.%I for select to anon, authenticated using (true)', table_name);
    execute format('drop policy if exists dev_shared_insert on public.%I', table_name);
    execute format('create policy dev_shared_insert on public.%I for insert to anon, authenticated with check (true)', table_name);
    execute format('drop policy if exists dev_shared_update on public.%I', table_name);
    execute format('create policy dev_shared_update on public.%I for update to anon, authenticated using (true) with check (true)', table_name);
  end loop;
  foreach table_name in array array['sales','sale_items','stock_movements','credit_payments'] loop
    execute format('drop policy if exists dev_shared_select on public.%I', table_name);
    execute format('create policy dev_shared_select on public.%I for select to anon, authenticated using (true)', table_name);
    execute format('drop policy if exists dev_shared_insert on public.%I', table_name);
    execute format('create policy dev_shared_insert on public.%I for insert to anon, authenticated with check (true)', table_name);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.users, public.categories, public.products, public.customers, public.credit_transactions, public.settings to anon, authenticated;
grant select, insert on public.sales, public.sale_items, public.stock_movements, public.credit_payments to anon, authenticated;
grant select on public.product_stock to anon, authenticated;

-- Production policy template (implement after Supabase Auth and store membership exist):
-- using (exists (select 1 from store_members where user_id = auth.uid() and store_id = <table>.store_id))
-- with check (exists (select 1 from store_members where user_id = auth.uid() and store_id = <table>.store_id));
