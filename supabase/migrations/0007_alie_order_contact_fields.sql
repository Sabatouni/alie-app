-- ALIÈ — separate WhatsApp / mobile contact fields on orders
--
-- STATUS: already applied directly against production (2026-09-01) via the
-- Supabase MCP connector. This file exists so the migration history in the
-- repo matches the live database. `add column if not exists` makes it a safe
-- no-op if run again.
--
-- alie_orders had a single customer_phone column. The order form requires
-- WhatsApp number and mobile number as two independent fields (a customer may
-- enter the same number in both, but nothing copies one into the other), so
-- customer_phone can no longer represent both.
--
-- Additive only: customer_phone is left in place, unused going forward, so
-- the 7 orders that existed before this migration (all with customer_phone =
-- null already) are untouched and nothing that reads that column breaks.

alter table alie_orders add column if not exists customer_whatsapp text;
alter table alie_orders add column if not exists customer_mobile text;

comment on column alie_orders.customer_phone is
  'Deprecated — superseded by customer_whatsapp and customer_mobile. Left in place for backward compatibility; no longer written to by the storefront.';
comment on column alie_orders.customer_whatsapp is 'Customer-provided WhatsApp number, required on every new order.';
comment on column alie_orders.customer_mobile is 'Customer-provided mobile number, required on every new order and independent of customer_whatsapp.';
