-- Read-only diagnostics for canonical cloud Owner metadata resolution.
-- This intentionally excludes credentials, PIN hashes, tokens, and business data.
select u.id, u.name, u.username, u.role, u.status, u.deleted_at, u.owner_id,
  (u.role = 'admin' and u.status = 'active' and u.deleted_at is null) as qualifies_current_reset_query
from public.users u
order by u.owner_id nulls first, u.created_at, u.id;

select owner_id, created_at
from public.store_owners
order by created_at;

select u.id, u.name, u.username, u.role, u.status, u.deleted_at, u.owner_id,
  (select count(*) from public.sales s where s.cashier_id = u.id and s.owner_id = u.owner_id) as sales_refs,
  (select count(*) from public.stock_movements sm where sm.created_by = u.id and sm.owner_id = u.owner_id) as stock_refs,
  (select count(*) from public.credit_transactions ct where ct.created_by = u.id and ct.owner_id = u.owner_id) as credit_refs,
  (select count(*) from public.credit_payments cp where cp.received_by = u.id and cp.owner_id = u.owner_id) as payment_refs,
  (select count(*) from public.sale_voids sv where sv.created_by = u.id and sv.owner_id = u.owner_id) as void_refs,
  (select count(*) from public.sale_refunds sr where sr.created_by = u.id and sr.owner_id = u.owner_id) as refund_refs
from public.users u
order by u.created_at, u.id;
