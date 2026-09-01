-- ALIÈ — public order tracking, without customer accounts
--
-- STATUS: already applied directly against production (2026-09-01) via the
-- Supabase MCP connector. This file exists so the migration history in the
-- repo matches the live database. Safe to re-run — every statement is
-- idempotent (`if not exists`, `create or replace`, backfill only touches
-- null tokens).
--
-- Customers need to check their order status later without logging in. A
-- sequential id or the human-readable order_number (which has only ~24 bits
-- of randomness in its suffix) isn't safe to expose as a lookup key — so this
-- adds a separate, high-entropy token and a SECURITY DEFINER function that
-- returns only order-summary fields, never customer contact details.
--
-- Additive only: no existing column, policy, or row is touched. The 7
-- historical USD orders and their amounts are untouched by this migration.

alter table alie_orders add column if not exists tracking_token text;

update alie_orders set tracking_token = encode(gen_random_bytes(16), 'hex') where tracking_token is null;

alter table alie_orders alter column tracking_token set default encode(gen_random_bytes(16), 'hex');
alter table alie_orders alter column tracking_token set not null;
create unique index if not exists alie_orders_tracking_token_idx on alie_orders (tracking_token);

comment on column alie_orders.tracking_token is
  'High-entropy public lookup key for customer order tracking (see alie_track_order()). Not the same as order_number, which is human-readable but not secret.';

-- Returns ONLY what a customer needs to see their own order status — no name,
-- phone, or email. SECURITY DEFINER so anon can call it without any RLS
-- policy on alie_orders itself being weakened (none of the existing INSERT/
-- SELECT/UPDATE/DELETE policies on alie_orders change).
create or replace function alie_track_order(p_token text)
returns table (
  order_number text,
  status text,
  currency text,
  subtotal numeric,
  items jsonb,
  created_at timestamptz
)
language sql
security definer
stable
as $$
  select order_number, status, currency, subtotal, items, created_at
  from alie_orders
  where tracking_token = p_token;
$$;

revoke execute on function alie_track_order(text) from public;
grant execute on function alie_track_order(text) to anon, authenticated;
