-- Manual migration for an existing Sari-sari Store Supabase project.
-- Run once in the Supabase SQL Editor. Safe to retry.
alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales add constraint sales_status_check check (status in ('completed', 'held', 'voided', 'refunded', 'partially_refunded', 'cancelled'));
alter table public.stock_movements drop constraint if exists stock_movements_type_check;
alter table public.stock_movements add constraint stock_movements_type_check check (type in ('stock_in', 'sale', 'damaged', 'expired', 'personal_use', 'correction', 'stock_out', 'void_return', 'refund_return'));

create table if not exists public.sale_voids (
  id text primary key, sale_id text not null unique references public.sales(id), amount numeric(12,2) not null check (amount >= 0),
  reason text not null check (length(trim(reason)) > 0), created_by text not null references public.users(id),
  created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz, origin_device_id text
);
create table if not exists public.sale_refunds (
  id text primary key, sale_id text not null unique references public.sales(id), refund_number text not null unique,
  amount numeric(12,2) not null check (amount > 0), refund_method text not null check (refund_method in ('Cash', 'GCash', 'Maya', 'Credit reversal')),
  reason text not null check (length(trim(reason)) > 0), created_by text not null references public.users(id),
  created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz, origin_device_id text
);
create table if not exists public.sale_refund_items (
  id text primary key, refund_id text not null references public.sale_refunds(id), sale_item_id text not null unique references public.sale_items(id),
  product_id text not null references public.products(id), quantity integer not null check (quantity > 0), unit_price numeric(12,2) not null,
  subtotal numeric(12,2) not null, created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz, origin_device_id text
);
create index if not exists sale_voids_updated_idx on public.sale_voids(updated_at);
create index if not exists sale_refunds_updated_idx on public.sale_refunds(updated_at);
create index if not exists sale_refund_items_updated_idx on public.sale_refund_items(updated_at);

drop trigger if exists sales_immutable on public.sales;
create or replace function public.guard_sale_reversal() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Historical sales cannot be deleted'; end if;
  if (to_jsonb(new) - array['status','updated_at','origin_device_id']) is distinct from (to_jsonb(old) - array['status','updated_at','origin_device_id']) then raise exception 'Only sale reversal status may change'; end if;
  if not (new.status = old.status or (old.status = 'completed' and new.status in ('voided','refunded','partially_refunded'))) then raise exception 'Invalid sale status transition'; end if;
  return new;
end $$;
drop trigger if exists sales_reversal_guard on public.sales;
create trigger sales_reversal_guard before update or delete on public.sales for each row execute function public.guard_sale_reversal();
drop trigger if exists sale_voids_immutable on public.sale_voids;
create trigger sale_voids_immutable before update or delete on public.sale_voids for each row execute function public.prevent_history_mutation();
drop trigger if exists sale_refunds_immutable on public.sale_refunds;
create trigger sale_refunds_immutable before update or delete on public.sale_refunds for each row execute function public.prevent_history_mutation();
drop trigger if exists sale_refund_items_immutable on public.sale_refund_items;
create trigger sale_refund_items_immutable before update or delete on public.sale_refund_items for each row execute function public.prevent_history_mutation();
alter table public.sale_voids enable row level security;
alter table public.sale_refunds enable row level security;
alter table public.sale_refund_items enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['sale_voids','sale_refunds','sale_refund_items'] loop
    execute format('drop policy if exists dev_shared_select on public.%I', table_name);
    execute format('create policy dev_shared_select on public.%I for select to anon, authenticated using (true)', table_name);
    execute format('drop policy if exists dev_shared_insert on public.%I', table_name);
    execute format('create policy dev_shared_insert on public.%I for insert to anon, authenticated with check (true)', table_name);
  end loop;
end $$;
drop policy if exists dev_shared_update on public.sales;
create policy dev_shared_update on public.sales for update to anon, authenticated using (true) with check (true);
grant select, insert on public.sale_voids, public.sale_refunds, public.sale_refund_items to anon, authenticated;
grant update on public.sales to anon, authenticated;

create or replace view public.product_stock as
select p.id as product_id,
  coalesce(sum(case when sm.type in ('stock_in', 'void_return', 'refund_return') then sm.quantity else -sm.quantity end), 0)::bigint as quantity
from public.products p left join public.stock_movements sm on sm.product_id = p.id and sm.deleted_at is null
where p.deleted_at is null group by p.id;
