-- Customer classification/default discounts and immutable sale presentation snapshots.
alter table public.customers add column if not exists customer_type text not null default 'regular';
alter table public.customers add column if not exists discount_type text not null default 'none';
alter table public.customers add column if not exists discount_value numeric(12,2) not null default 0;
alter table public.customers drop constraint if exists customers_customer_type_check;
alter table public.customers add constraint customers_customer_type_check check (customer_type in ('regular', 'suki'));
alter table public.customers drop constraint if exists customers_discount_type_check;
alter table public.customers add constraint customers_discount_type_check check (discount_type in ('none', 'percentage', 'fixed'));
alter table public.customers drop constraint if exists customers_discount_value_check;
alter table public.customers add constraint customers_discount_value_check check (discount_value >= 0 and (discount_type <> 'percentage' or discount_value <= 100));

alter table public.sales add column if not exists discount_type text not null default 'none';
alter table public.sales add column if not exists discount_value numeric(12,2) not null default 0;
alter table public.sales add column if not exists cashier_name_snapshot text not null default 'Owner';
alter table public.sales add column if not exists customer_name_snapshot text;
alter table public.sales drop constraint if exists sales_discount_type_check;
alter table public.sales add constraint sales_discount_type_check check (discount_type in ('none', 'percentage', 'fixed'));
alter table public.sales drop constraint if exists sales_discount_value_check;
alter table public.sales add constraint sales_discount_value_check check (discount_value >= 0 and (discount_type <> 'percentage' or discount_value <= 100));

-- Migration-only bypass for the existing immutable-history trigger while the
-- newly added display snapshots are backfilled. The setting is local to this block.
do $$ begin
  perform set_config('app.store_admin', '1', true);
  update public.sales s set cashier_name_snapshot = coalesce(nullif(trim(u.name), ''), 'Owner')
  from public.users u where u.id = s.cashier_id and (s.cashier_name_snapshot is null or s.cashier_name_snapshot = 'Owner');
  update public.sales s set customer_name_snapshot = c.full_name
  from public.customers c where c.id = s.customer_id and s.customer_name_snapshot is null;
end $$;

create index if not exists customers_type_idx on public.customers(customer_type, deleted_at);
create index if not exists sales_transaction_number_idx on public.sales(transaction_number);

-- Recreate the service-role replacement RPC with the V7 record shapes. All
-- tables are still replaced together inside this one PostgreSQL transaction.
create or replace function public.admin_replace_owned_store(p_owner_id uuid, p_snapshot jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_owner_id is null or jsonb_typeof(p_snapshot) <> 'object' then raise exception 'Invalid cloud snapshot'; end if;
  perform set_config('app.store_admin', '1', true);

  delete from public.sale_refund_items where owner_id = p_owner_id;
  delete from public.sale_refunds where owner_id = p_owner_id;
  delete from public.sale_voids where owner_id = p_owner_id;
  delete from public.credit_payments where owner_id = p_owner_id;
  delete from public.credit_transactions where owner_id = p_owner_id;
  delete from public.sale_items where owner_id = p_owner_id;
  delete from public.stock_movements where owner_id = p_owner_id;
  delete from public.sales where owner_id = p_owner_id;
  delete from public.products where owner_id = p_owner_id;
  delete from public.categories where owner_id = p_owner_id;
  delete from public.customers where owner_id = p_owner_id;
  delete from public.users where owner_id = p_owner_id;
  delete from public.settings where owner_id = p_owner_id;

  insert into public.users (id,name,username,role,status,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,name,username,role,status,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'users','[]'::jsonb)) as x(id text,name text,username text,role text,status text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.categories (id,name,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,name,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'categories','[]'::jsonb)) as x(id text,name text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.customers (id,full_name,phone,address,customer_type,discount_type,discount_value,credit_limit,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,full_name,phone,address,customer_type,discount_type,discount_value,credit_limit,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'customers','[]'::jsonb)) as x(id text,full_name text,phone text,address text,customer_type text,discount_type text,discount_value numeric,credit_limit numeric,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.products (id,name,category_id,selling_price,cost_price,barcode,low_stock_threshold,description,image_uri,is_active,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,name,category_id,selling_price,cost_price,barcode,low_stock_threshold,description,null,is_active,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'products','[]'::jsonb)) as x(id text,name text,category_id text,selling_price numeric,cost_price numeric,barcode text,low_stock_threshold integer,description text,is_active integer,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sales (id,transaction_number,customer_id,cashier_id,payment_method,subtotal,discount_type,discount_value,discount,total,cash_received,change_amount,reference_number,cashier_name_snapshot,customer_name_snapshot,status,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,transaction_number,customer_id,cashier_id,payment_method,subtotal,discount_type,discount_value,discount,total,cash_received,change_amount,reference_number,cashier_name_snapshot,customer_name_snapshot,status,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sales','[]'::jsonb)) as x(id text,transaction_number text,customer_id text,cashier_id text,payment_method text,subtotal numeric,discount_type text,discount_value numeric,discount numeric,total numeric,cash_received numeric,change_amount numeric,reference_number text,cashier_name_snapshot text,customer_name_snapshot text,status text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sale_items (id,sale_id,product_id,product_name_snapshot,quantity,unit_price,cost_price,subtotal,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,sale_id,product_id,product_name_snapshot,quantity,unit_price,cost_price,subtotal,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sale_items','[]'::jsonb)) as x(id text,sale_id text,product_id text,product_name_snapshot text,quantity integer,unit_price numeric,cost_price numeric,subtotal numeric,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.stock_movements (id,product_id,type,quantity,reason,reference,notes,created_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,product_id,type,quantity,reason,reference,notes,created_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'stock_movements','[]'::jsonb)) as x(id text,product_id text,type text,quantity integer,reason text,reference text,notes text,created_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.credit_transactions (id,customer_id,sale_id,amount,due_date,description,notes,status,created_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,customer_id,sale_id,amount,due_date,description,notes,status,created_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'credit_transactions','[]'::jsonb)) as x(id text,customer_id text,sale_id text,amount numeric,due_date text,description text,notes text,status text,created_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.credit_payments (id,credit_transaction_id,customer_id,amount,payment_method,reference,notes,received_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,credit_transaction_id,customer_id,amount,payment_method,reference,notes,received_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'credit_payments','[]'::jsonb)) as x(id text,credit_transaction_id text,customer_id text,amount numeric,payment_method text,reference text,notes text,received_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sale_voids (id,sale_id,amount,reason,created_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,sale_id,amount,reason,created_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sale_voids','[]'::jsonb)) as x(id text,sale_id text,amount numeric,reason text,created_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sale_refunds (id,sale_id,refund_number,amount,refund_method,reason,created_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,sale_id,refund_number,amount,refund_method,reason,created_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sale_refunds','[]'::jsonb)) as x(id text,sale_id text,refund_number text,amount numeric,refund_method text,reason text,created_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sale_refund_items (id,refund_id,sale_item_id,product_id,quantity,unit_price,subtotal,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,refund_id,sale_item_id,product_id,quantity,unit_price,subtotal,created_at,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sale_refund_items','[]'::jsonb)) as x(id text,refund_id text,sale_item_id text,product_id text,quantity integer,unit_price numeric,subtotal numeric,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.settings (key,value,updated_at,deleted_at,origin_device_id,owner_id)
    select key,value,updated_at,deleted_at,origin_device_id,p_owner_id from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'settings','[]'::jsonb)) as x(key text,value text,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
end $$;

revoke all on function public.admin_replace_owned_store(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_replace_owned_store(uuid, jsonb) to service_role;
