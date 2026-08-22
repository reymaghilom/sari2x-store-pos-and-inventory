-- Authenticated single-owner cloud isolation and privileged snapshot administration.
-- Existing rows remain unowned until the allowlisted Owner explicitly claims them
-- through the store-admin Edge Function. This migration never deletes business data.

create table if not exists public.store_owners (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.store_owners enable row level security;
revoke all on public.store_owners from public, anon;
grant select on public.store_owners to authenticated;
drop policy if exists owner_select on public.store_owners;
create policy owner_select on public.store_owners for select to authenticated using (owner_id = auth.uid());

do $$ declare table_name text; begin
  foreach table_name in array array[
    'users','categories','products','customers','sales','sale_items','stock_movements',
    'credit_transactions','credit_payments','sale_voids','sale_refunds','sale_refund_items','settings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I add column if not exists owner_id uuid references auth.users(id)', table_name);
    execute format('alter table public.%I alter column owner_id set default auth.uid()', table_name);
    execute format('create index if not exists %I on public.%I(owner_id)', table_name || '_owner_idx', table_name);
    execute format('drop policy if exists dev_shared_select on public.%I', table_name);
    execute format('drop policy if exists dev_shared_insert on public.%I', table_name);
    execute format('drop policy if exists dev_shared_update on public.%I', table_name);
    execute format('drop policy if exists owner_select on public.%I', table_name);
    execute format('create policy owner_select on public.%I for select to authenticated using (owner_id = auth.uid() and exists (select 1 from public.store_owners so where so.owner_id = auth.uid()))', table_name);
    execute format('drop policy if exists owner_insert on public.%I', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (owner_id = auth.uid() and exists (select 1 from public.store_owners so where so.owner_id = auth.uid()))', table_name);
  end loop;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['users','categories','products','customers','credit_transactions','settings','sales'] loop
    execute format('drop policy if exists owner_update on public.%I', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using (owner_id = auth.uid() and exists (select 1 from public.store_owners so where so.owner_id = auth.uid())) with check (owner_id = auth.uid() and exists (select 1 from public.store_owners so where so.owner_id = auth.uid()))', table_name);
  end loop;
end $$;

revoke all on public.users, public.categories, public.products, public.customers, public.sales,
  public.sale_items, public.stock_movements, public.credit_transactions, public.credit_payments,
  public.settings, public.sale_voids, public.sale_refunds, public.sale_refund_items from public, anon;
grant select, insert, update on public.users, public.categories, public.products, public.customers,
  public.credit_transactions, public.settings, public.sales to authenticated;
grant select, insert on public.sale_items, public.stock_movements, public.sale_voids,
  public.sale_refunds, public.sale_refund_items, public.credit_payments to authenticated;

-- Immutable history remains protected for ordinary clients. Only a transaction
-- entered by a service-role-only RPC can activate the private administration flag.
create or replace function public.keep_newest_write() returns trigger language plpgsql as $$
begin
  if current_setting('app.store_admin', true) = '1' then return new; end if;
  if new.updated_at <= old.updated_at then return old; end if;
  return new;
end $$;

create or replace function public.prevent_history_mutation() returns trigger language plpgsql as $$
begin
  if current_setting('app.store_admin', true) = '1' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'Historical records are immutable';
end $$;

create or replace function public.guard_sale_reversal() returns trigger language plpgsql as $$
begin
  if current_setting('app.store_admin', true) = '1' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'Historical sales cannot be deleted'; end if;
  if (to_jsonb(new) - array['status','updated_at','origin_device_id']) is distinct from (to_jsonb(old) - array['status','updated_at','origin_device_id']) then
    raise exception 'Only sale reversal status may change';
  end if;
  if not (new.status = old.status or (old.status = 'completed' and new.status in ('voided','refunded','partially_refunded'))) then
    raise exception 'Invalid sale status transition';
  end if;
  return new;
end $$;

create or replace function public.admin_claim_unowned_store(p_owner_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare table_name text; conflicting bigint;
begin
  if p_owner_id is null then raise exception 'Owner is required'; end if;
  perform set_config('app.store_admin', '1', true);
  foreach table_name in array array[
    'users','categories','products','customers','sales','sale_items','stock_movements',
    'credit_transactions','credit_payments','sale_voids','sale_refunds','sale_refund_items','settings'
  ] loop
    execute format('select count(*) from public.%I where owner_id is not null and owner_id <> $1', table_name) into conflicting using p_owner_id;
    if conflicting > 0 then raise exception 'Another Owner already has cloud data'; end if;
    execute format('update public.%I set owner_id = $1 where owner_id is null', table_name) using p_owner_id;
  end loop;
end $$;

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
    select id,name,username,role,status,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'users','[]'::jsonb)) as x(id text,name text,username text,role text,status text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.categories (id,name,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,name,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'categories','[]'::jsonb)) as x(id text,name text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.customers (id,full_name,phone,address,credit_limit,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,full_name,phone,address,credit_limit,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'customers','[]'::jsonb)) as x(id text,full_name text,phone text,address text,credit_limit numeric,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.products (id,name,category_id,selling_price,cost_price,barcode,low_stock_threshold,description,image_uri,is_active,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,name,category_id,selling_price,cost_price,barcode,low_stock_threshold,description,null,is_active,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'products','[]'::jsonb)) as x(id text,name text,category_id text,selling_price numeric,cost_price numeric,barcode text,low_stock_threshold integer,description text,is_active integer,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sales (id,transaction_number,customer_id,cashier_id,payment_method,subtotal,discount,total,cash_received,change_amount,reference_number,status,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,transaction_number,customer_id,cashier_id,payment_method,subtotal,discount,total,cash_received,change_amount,reference_number,status,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sales','[]'::jsonb)) as x(id text,transaction_number text,customer_id text,cashier_id text,payment_method text,subtotal numeric,discount numeric,total numeric,cash_received numeric,change_amount numeric,reference_number text,status text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sale_items (id,sale_id,product_id,product_name_snapshot,quantity,unit_price,cost_price,subtotal,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,sale_id,product_id,product_name_snapshot,quantity,unit_price,cost_price,subtotal,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sale_items','[]'::jsonb)) as x(id text,sale_id text,product_id text,product_name_snapshot text,quantity integer,unit_price numeric,cost_price numeric,subtotal numeric,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.stock_movements (id,product_id,type,quantity,reason,reference,notes,created_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,product_id,type,quantity,reason,reference,notes,created_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'stock_movements','[]'::jsonb)) as x(id text,product_id text,type text,quantity integer,reason text,reference text,notes text,created_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.credit_transactions (id,customer_id,sale_id,amount,due_date,description,notes,status,created_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,customer_id,sale_id,amount,due_date,description,notes,status,created_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'credit_transactions','[]'::jsonb)) as x(id text,customer_id text,sale_id text,amount numeric,due_date text,description text,notes text,status text,created_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.credit_payments (id,credit_transaction_id,customer_id,amount,payment_method,reference,notes,received_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,credit_transaction_id,customer_id,amount,payment_method,reference,notes,received_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'credit_payments','[]'::jsonb)) as x(id text,credit_transaction_id text,customer_id text,amount numeric,payment_method text,reference text,notes text,received_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sale_voids (id,sale_id,amount,reason,created_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,sale_id,amount,reason,created_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sale_voids','[]'::jsonb)) as x(id text,sale_id text,amount numeric,reason text,created_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sale_refunds (id,sale_id,refund_number,amount,refund_method,reason,created_by,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,sale_id,refund_number,amount,refund_method,reason,created_by,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sale_refunds','[]'::jsonb)) as x(id text,sale_id text,refund_number text,amount numeric,refund_method text,reason text,created_by text,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.sale_refund_items (id,refund_id,sale_item_id,product_id,quantity,unit_price,subtotal,created_at,updated_at,deleted_at,origin_device_id,owner_id)
    select id,refund_id,sale_item_id,product_id,quantity,unit_price,subtotal,created_at,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'sale_refund_items','[]'::jsonb)) as x(id text,refund_id text,sale_item_id text,product_id text,quantity integer,unit_price numeric,subtotal numeric,created_at timestamptz,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
  insert into public.settings (key,value,updated_at,deleted_at,origin_device_id,owner_id)
    select key,value,updated_at,deleted_at,origin_device_id,p_owner_id
    from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'settings','[]'::jsonb)) as x(key text,value text,updated_at timestamptz,deleted_at timestamptz,origin_device_id text);
end $$;

revoke all on function public.admin_claim_unowned_store(uuid) from public, anon, authenticated;
revoke all on function public.admin_replace_owned_store(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_claim_unowned_store(uuid) to service_role;
grant execute on function public.admin_replace_owned_store(uuid, jsonb) to service_role;
