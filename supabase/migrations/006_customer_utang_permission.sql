-- Borrowing permission is independent from Regular/Suki loyalty status.
alter table public.customers add column if not exists allow_utang integer not null default 0;
alter table public.customers drop constraint if exists customers_allow_utang_check;
alter table public.customers add constraint customers_allow_utang_check check (allow_utang in (0, 1));

-- Existing V7 customers retain borrowing access only when their saved limit or
-- current outstanding balance demonstrates prior credit use. The trigger bypass
-- is local to this migration block and does not weaken client permissions.
do $$ begin
  perform set_config('app.store_admin', '1', true);
  update public.customers c
  set allow_utang = 1
  where c.credit_limit > 0
     or greatest(0,
       coalesce((select sum(ct.amount) from public.credit_transactions ct where ct.customer_id = c.id and ct.deleted_at is null), 0)
       - coalesce((select sum(cp.amount) from public.credit_payments cp where cp.customer_id = c.id and cp.deleted_at is null), 0)
     ) > 0;
end $$;

create index if not exists customers_allow_utang_idx on public.customers(allow_utang, deleted_at);

-- Keep the V7 all-table replacement implementation intact, then wrap it to
-- restore the V8 field within the same service-role-only transaction.
alter function public.admin_replace_owned_store(uuid, jsonb) rename to admin_replace_owned_store_v7;
revoke all on function public.admin_replace_owned_store_v7(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_replace_owned_store_v7(uuid, jsonb) to service_role;

create function public.admin_replace_owned_store(p_owner_id uuid, p_snapshot jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_owner_id is null or jsonb_typeof(p_snapshot) <> 'object' then raise exception 'Invalid cloud snapshot'; end if;
  perform public.admin_replace_owned_store_v7(p_owner_id, p_snapshot);
  update public.customers c
  set allow_utang = coalesce(x.allow_utang, 0)
  from jsonb_to_recordset(coalesce(p_snapshot->'tables'->'customers','[]'::jsonb)) as x(id text, allow_utang integer)
  where c.owner_id = p_owner_id and c.id = x.id;
end $$;

revoke all on function public.admin_replace_owned_store(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_replace_owned_store(uuid, jsonb) to service_role;
