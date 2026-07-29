-- ALIÈ — product image ordering hygiene
--
-- Purely additive and optional: the Products → Images panel works without it.
-- No new tables, no new columns, no image is lost or moved between products.
--
-- What it does:
--   1. Gives every product's images a deterministic sort_order, so galleries
--      that predate the admin uploader (all rows sitting at the default 0)
--      don't render in whatever order PostgREST happens to return.
--   2. Collapses any product that somehow ended up with two primary images
--      down to one, keeping the earliest in sort order.
--   3. Adds the index the gallery query and the reorder upsert both use.
--
-- Safe to run more than once.

-- ── 1. Deterministic ordering for legacy rows ───────────────────────────────
-- Only touches products whose images are ALL at sort_order 0, i.e. rows that
-- were created before ordering existed. Anything the admin has already
-- arranged is left exactly as it is.

with legacy as (
  select product_id
  from alie_product_images
  group by product_id
  having count(*) > 1 and max(sort_order) = 0 and min(sort_order) = 0
),
numbered as (
  select
    i.id,
    row_number() over (
      partition by i.product_id
      -- primary first, then a stable, repeatable order
      order by i.is_primary desc, i.id
    ) - 1 as new_sort
  from alie_product_images i
  join legacy l on l.product_id = i.product_id
)
update alie_product_images i
set sort_order = n.new_sort
from numbered n
where i.id = n.id
  and i.sort_order is distinct from n.new_sort;

-- ── 2. One primary per product ──────────────────────────────────────────────
-- Demotes every extra primary, keeping the first by (sort_order, id).

with ranked as (
  select
    id,
    row_number() over (partition by product_id order by sort_order, id) as rn
  from alie_product_images
  where is_primary
)
update alie_product_images i
set is_primary = false
from ranked r
where i.id = r.id
  and r.rn > 1;

-- Promote a primary for any product that has images but none flagged, so the
-- storefront's "primary, else first" fallback and the admin badge agree.

with needs_primary as (
  select distinct product_id
  from alie_product_images
  where product_id not in (
    select product_id from alie_product_images where is_primary
  )
),
first_image as (
  select distinct on (i.product_id) i.id
  from alie_product_images i
  join needs_primary n on n.product_id = i.product_id
  order by i.product_id, i.sort_order, i.id
)
update alie_product_images i
set is_primary = true
from first_image f
where i.id = f.id;

-- ── 3. Index ────────────────────────────────────────────────────────────────

create index if not exists alie_product_images_product_sort_idx
  on alie_product_images (product_id, sort_order);

-- ── 4. Verify ───────────────────────────────────────────────────────────────
-- Expect zero rows: no product should have more than one primary image.
--
-- select product_id, count(*)
-- from alie_product_images
-- where is_primary
-- group by product_id
-- having count(*) > 1;
