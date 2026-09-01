-- ALIÈ — TZS-first pricing
--
-- STATUS: already applied directly against production (2026-09-01) via the
-- Supabase MCP connector during the pricing conversion conversation. This file
-- exists so the migration history in the repo matches the live database — it
-- is idempotent-safe to re-run (the UPDATE ... WHERE id = ... statements are
-- harmless no-ops if the prices already match), but do NOT run it expecting
-- it to convert anything: there is nothing left in USD to convert.
--
-- Adds explicit currency columns to alie_products and alie_orders, converts
-- the (at-the-time) USD catalogue to TZS at a fixed rate of 1 USD = 2,650 TZS
-- rounded to the nearest 1,000, and backfills the 7 orders that existed before
-- this migration as USD so their historical financial record is preserved
-- exactly as originally recorded.

-- ---------- alie_products: make currency explicit ----------
alter table alie_products
  add column if not exists currency text not null default 'TZS' check (currency = 'TZS');

-- ---------- alie_orders: make currency explicit, default TZS for new orders ----------
alter table alie_orders
  add column if not exists currency text not null default 'TZS' check (currency in ('TZS','USD'));

-- Backfill the 7 orders placed before ALIÈ went TZS-first — they were quoted
-- and confirmed in USD, so their currency, subtotal, and items are left
-- exactly as recorded. This statement only sets the currency label; it does
-- not touch subtotal or items on any row.
update alie_orders
set currency = 'USD'
where id in (
  '70d9b96c-871e-4a48-b94d-887000067bba',
  '5ff1aad2-382f-4a48-90fb-0db382032d75',
  'ddd81b2c-780c-4ffa-a682-f37727474e87',
  'f4530179-64a8-4444-a586-c1c36b88a57b',
  '20035f2f-a84a-4771-ae91-9c7787b02717',
  'a67a98e5-887c-46a1-a5e0-5ad3eb170952',
  '00438352-2c94-49fc-bd01-dc99a3dfac0f'
)
and currency <> 'USD';

-- ---------- alie_products: convert the 11 products that existed at migration time ----------
-- Explicit per-row updates, keyed by id — not a blanket price * 2650 formula —
-- so this can never accidentally reconvert a row that's already correct, and
-- so a product created after this migration (already TZS) is never touched.
update alie_products set price = 133000.00 where id = '2ef97fbd-f515-4d46-b8ce-fe2443d282f3' and price <> 133000.00; -- Naseem Abaya, was 50.00 USD
update alie_products set price = 133000.00 where id = '3e6d0301-068c-4a72-97d1-37c9c0ff829d' and price <> 133000.00; -- Alie' dune, was 50.00 USD
update alie_products set price = 119000.00 where id = '6d8c322d-5b76-4bd9-a2bc-0f222bbd63d8' and price <> 119000.00; -- Sculpty, was 45.00 USD
update alie_products set price = 106000.00 where id = '4f1146ac-260f-4720-a883-68cbf2d6dc25' and price <> 106000.00; -- Haze, was 40.00 USD
update alie_products set price = 114000.00 where id = '095279b2-acd0-491e-9e84-150f62c05c83' and price <> 114000.00; -- atlas, was 43.00 USD
update alie_products set price =  32000.00 where id = 'f5b250ba-7463-46ed-a537-2abe05d85321' and price <>  32000.00; -- whisper scarves, was 12.00 USD
update alie_products set price =  34000.00 where id = '4c85e5b3-ad97-4315-b1c9-ab66c4ff003a' and price <>  34000.00; -- core caps, was 13.00 USD
update alie_products set price =  48000.00 where id = '3e99f1ca-d2c6-417f-a80c-9d3ddbec55d0' and price <>  48000.00; -- Off duty tote, was 18.00 USD
update alie_products set price =  69000.00 where id = '770372d7-7e61-404a-a1f5-bbf3fcee349e' and price <>  69000.00; -- Coral tote, was 26.00 USD
update alie_products set price =  48000.00 where id = 'a6e5b96e-560f-4d60-bf02-4c362554441c' and price <>  48000.00; -- Sahara primark, was 18.00 USD
update alie_products set price =  69000.00 where id = '2252c597-f146-4829-80e7-026003084a23' and price <>  69000.00; -- Sandstone flops, was 26.00 USD

comment on column alie_products.currency is 'ALIÈ is a fixed TZS storefront; this column exists to make that explicit rather than assumed.';
comment on column alie_orders.currency is 'Currency the order was actually placed in. Orders before the TZS migration (see this file) are USD and must never be reconverted; all new orders are TZS.';
